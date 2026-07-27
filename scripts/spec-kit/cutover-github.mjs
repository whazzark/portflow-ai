#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { changedActions, planCutover, summarizeActions } from './github-cutover-model.mjs'

const repository = process.env.GITHUB_REPOSITORY ?? 'whazzark/portflow-ai'
const [owner, repo] = repository.split('/')
const baseBranch = process.env.GITHUB_BASE_REF ?? 'master'
const projectNumber = 5
const apply = process.argv.includes('--apply')
const fullJson = process.argv.includes('--json')
const deleteLabelDefinitions = process.argv.includes('--delete-label-definitions')
const root = process.cwd()
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'specs', '.migration-manifest.json'), 'utf8'),
)
const manifestIssueNumbers = new Set(manifest.mappings.map((mapping) => mapping.issue))

if (deleteLabelDefinitions && !apply) {
  throw new Error('--delete-label-definitions requires --apply')
}

const state = fetchState()
const actions = planCutover({
  manifest,
  issues: state.issues,
  projectItems: state.project.items,
  repository,
  baseBranch,
})
const changes = changedActions(actions)
const report = {
  mode: apply ? 'apply' : 'dry-run',
  repository,
  project: {
    number: projectNumber,
    id: state.project.id,
    title: state.project.title,
  },
  summary: summarizeActions(actions),
  labelDefinitions: {
    deleteRequested: deleteLabelDefinitions,
    obsolete: state.labelAudit.definitions,
    outOfScopeUses: state.labelAudit.outOfScopeUses,
  },
  actions: fullJson ? changes.map(compactAction) : changes.slice(0, 10).map(compactAction),
  actionsTruncated: !fullJson && changes.length > 10,
}

if (!apply) {
  process.stdout.write(
    `${JSON.stringify(report, null, 2)}\n\nNo GitHub state changed. Review the plan, then re-run with --apply.\n`,
  )
  process.exit(0)
}

const backupDir = path.join(
  root,
  '.specify',
  'migration-backup',
  new Date().toISOString().replaceAll(':', '-'),
)
fs.mkdirSync(backupDir, { recursive: true })
fs.writeFileSync(
  path.join(backupDir, 'snapshot.json'),
  `${JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      repository,
      baseBranch,
      project: state.project,
      labelDefinitions: state.labelAudit,
      actions,
    },
    null,
    2,
  )}\n`,
)

for (const action of changes) {
  applyAction(action, state.project)
}

if (deleteLabelDefinitions) {
  const labelAudit = fetchLabelAudit(fetchRepositoryItems())
  const remainingUses = labelAudit.definitions.flatMap((label) =>
    label.usedBy.map((item) => ({ label: label.name, ...item })),
  )
  if (remainingUses.length > 0) {
    throw new Error(
      `Refusing to delete label definitions still in use: ${JSON.stringify(remainingUses)}`,
    )
  }
  deleteObsoleteLabelDefinitions(labelAudit)
}

const verificationState = fetchState()
const verificationActions = planCutover({
  manifest,
  issues: verificationState.issues,
  projectItems: verificationState.project.items,
  repository,
  baseBranch,
})
const remaining = changedActions(verificationActions)

process.stdout.write(
  `${JSON.stringify(
    {
      mode: 'verification',
      backup: path.relative(root, backupDir),
      summary: summarizeActions(verificationActions),
      remaining: remaining.slice(0, 10).map(compactAction),
    },
    null,
    2,
  )}\n`,
)

if (remaining.length > 0) {
  process.stderr.write(
    `GitHub cutover is incomplete: ${remaining.length} issue(s) still require changes.\n`,
  )
  process.exit(1)
}

function fetchState() {
  const repositoryItems = fetchRepositoryItems()
  const issues = repositoryItems.filter((item) => !item.pull_request)
  const project = fetchProject()
  const labelAudit = fetchLabelAudit(repositoryItems)
  return { issues, project, labelAudit }
}

function fetchRepositoryItems() {
  const output = execFileSync(
    'gh',
    ['api', '--paginate', '--slurp', `repos/${owner}/${repo}/issues?state=all&per_page=100`],
    { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 },
  )
  return JSON.parse(output).flat()
}

function fetchProject() {
  const projects = ghJson(['project', 'list', '--owner', owner, '--format', 'json'])
  const project = projects.projects.find((candidate) => candidate.number === projectNumber)
  if (!project) {
    throw new Error(`GitHub Project #${projectNumber} is missing for ${owner}`)
  }

  const fields = ghJson([
    'project',
    'field-list',
    String(projectNumber),
    '--owner',
    owner,
    '--format',
    'json',
  ])
  const specStatus = fields.fields.find((field) => field.name === 'Spec Status')
  if (!specStatus || !Array.isArray(specStatus.options)) {
    throw new Error(`Project #${projectNumber} is missing the Spec Status field`)
  }

  const itemPayload = ghJson([
    'project',
    'item-list',
    String(projectNumber),
    '--owner',
    owner,
    '--limit',
    '500',
    '--format',
    'json',
  ])
  const items = itemPayload.items
    .filter((item) => item.content?.type === 'Issue' && item.content.repository === repository)
    .map((item) => ({
      id: item.id,
      number: item.content.number,
      specStatus: fieldValue(item, 'Spec Status'),
    }))

  return {
    id: project.id,
    number: projectNumber,
    title: project.title,
    fieldId: specStatus.id,
    options: Object.fromEntries(specStatus.options.map((option) => [option.name, option.id])),
    items,
  }
}

function fieldValue(item, fieldName) {
  const key = Object.keys(item).find(
    (candidate) => candidate.toLowerCase() === fieldName.toLowerCase(),
  )
  return key ? item[key] : null
}

function applyAction(action, project) {
  if (action.body.change) {
    execFileSync(
      'gh',
      ['issue', 'edit', String(action.issue), '--repo', repository, '--body', action.body.target],
      { stdio: 'inherit' },
    )
  }

  let projectItemId = action.project.itemId
  if (action.project.operation === 'add') {
    const item = ghJson([
      'project',
      'item-add',
      String(projectNumber),
      '--owner',
      owner,
      '--url',
      `https://github.com/${repository}/issues/${action.issue}`,
      '--format',
      'json',
    ])
    projectItemId = item.id
  }
  if (action.project.operation !== 'none') {
    const optionId = project.options[action.targetSpecStatus]
    if (!optionId) {
      throw new Error(`Project Spec Status option is missing: ${action.targetSpecStatus}`)
    }
    execFileSync(
      'gh',
      [
        'project',
        'item-edit',
        '--id',
        projectItemId,
        '--project-id',
        project.id,
        '--field-id',
        project.fieldId,
        '--single-select-option-id',
        optionId,
      ],
      { stdio: 'inherit' },
    )
  }

  if (action.labels.remove.length > 0) {
    const args = ['issue', 'edit', String(action.issue), '--repo', repository]
    for (const label of action.labels.remove) {
      args.push('--remove-label', label)
    }
    execFileSync('gh', args, { stdio: 'inherit' })
  }
}

function fetchLabelAudit(repositoryItems) {
  const definitions = ghJson([
    'label',
    'list',
    '--repo',
    repository,
    '--limit',
    '500',
    '--json',
    'name,color,description',
  ])
    .filter((label) => isObsoleteLabel(label.name))
    .map((label) => ({
      ...label,
      usedBy: repositoryItems
        .filter((item) => item.labels?.some((candidate) => candidate.name === label.name))
        .map((item) => ({
          number: item.number,
          type: item.pull_request ? 'pull-request' : 'issue',
          inMigrationScope: !item.pull_request && manifestIssueNumbers.has(item.number),
        })),
    }))

  return {
    definitions,
    outOfScopeUses: definitions.flatMap((label) =>
      label.usedBy
        .filter((item) => !item.inMigrationScope)
        .map((item) => ({ label: label.name, ...item })),
    ),
  }
}

function deleteObsoleteLabelDefinitions(labelAudit) {
  for (const label of labelAudit.definitions) {
    execFileSync('gh', ['label', 'delete', label.name, '--repo', repository, '--yes'], {
      stdio: 'inherit',
    })
  }
}

function isObsoleteLabel(label) {
  return (
    label === 'agent:ready' ||
    label.startsWith('triage:') ||
    label.startsWith('speckit:') ||
    label.startsWith('speckit-')
  )
}

function ghJson(args) {
  return JSON.parse(
    execFileSync('gh', args, {
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    }),
  )
}

function compactAction(action) {
  return {
    issue: action.issue,
    path: action.path,
    body: action.body.change ? 'update' : 'none',
    project: action.project.operation,
    targetSpecStatus: action.targetSpecStatus,
    removeLabels: action.labels.remove,
  }
}
