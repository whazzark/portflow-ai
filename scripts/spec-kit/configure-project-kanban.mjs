#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import {
  KANBAN_STATUS_OPTIONS,
  orderedOpenIssues,
  statusCounts,
  targetKanbanStatus,
  targetSpecStatus,
  unrankedOpenIssues,
} from './project-kanban-model.mjs'
import { PROJECT_NUMBER } from './workflow-model.mjs'

const repository = process.env.GITHUB_REPOSITORY ?? 'whazzark/portflow-ai'
const owner = repository.split('/')[0]
const projectNumber = PROJECT_NUMBER
const apply = process.argv.includes('--apply')
const root = process.cwd()
const desiredProjectDescription =
  'Kanban continu de livraison Portflow, de la qualification à la mise en production.'
const desiredProjectReadme = `# Portflow Kanban

GitHub Issues est la source de vérité du backlog. Ce Project porte l'ordre d'implémentation et deux états complémentaires :

- \`Status\` décrit le flux opérationnel : \`Backlog → Ready → In Progress → Review → Done\`, avec \`Blocked\` lorsque le travail ne peut pas avancer ;
- \`Spec Status\` décrit la maturité Spec Kit, de \`Intake\` à \`Done\`.

Le Kanban principal exclut les issues \`epic\`. La vue Roadmap les regroupe séparément, et la vue Spec pipeline expose les artefacts qui ne sont pas encore terminés.

## Chemin critique

1. Checkpoints (#41)
2. Référentiels de stockage (#43–#46)
3. Flotte (#48–#51)
4. Contrat API (#102)
5. Préparation d'une décharge (#53–#61)
6. Shifts (#63–#73)
7. Rotations (#82–#87)
8. Changements de ressources en cours d'exécution (#75–#80)
9. Validation (#89–#91)
10. Ajustements (#93–#95)
11. Clôture (#97–#100)
12. Consultation de l'activité (#103–#104)
13. Rapports (#106–#109)
14. Dashboard (#111–#113)
15. Administration utilisateur (#1–#33 et #117)

Les issues closes passent automatiquement à \`Done\`. La politique de conservation cible archive les issues closes après 15 jours sans mise à jour avec le workflow natif \`Auto-archive items\` et le filtre \`is:closed updated:<@today-15d\`. Les éléments archivés restent restaurables.
`
const desiredViews = [
  {
    name: 'Backlog',
    aliases: [],
    layout: 'TABLE_LAYOUT',
    filter: 'status:Backlog -label:epic',
  },
  {
    name: 'Kanban',
    aliases: ['Board'],
    layout: 'BOARD_LAYOUT',
    filter: '-label:epic',
  },
  {
    name: 'Active flow',
    aliases: [],
    layout: 'BOARD_LAYOUT',
    filter: 'status:Ready,"In Progress",Review,Blocked -label:epic',
  },
  {
    name: 'Roadmap',
    aliases: [],
    layout: 'TABLE_LAYOUT',
    filter: 'label:epic',
  },
  {
    name: 'Spec pipeline',
    aliases: [],
    layout: 'TABLE_LAYOUT',
    filter: '-spec-status:Done',
  },
]

const initial = fetchState()
const report = migrationReport(initial)

if (!apply) {
  process.stdout.write(
    `${JSON.stringify({ mode: 'dry-run', ...compactReport(report) }, null, 2)}\n\nNo GitHub state changed. Re-run with --apply after review.\n`,
  )
  process.exit(0)
}

const backupDirectory = backup(initial)
const state = initial
configureProjectMetadata(state.project)
state.project.statusField.options = configureStatusField(state.project)
for (const item of state.project.items) {
  if (item.status === 'Todo') {
    item.status = 'Backlog'
  }
}
addMissingIssues(state)
applyItemFields(state)
applyOrdering(state)
deleteSprintField(state.project)
configureViews(state.project)

const verified = fetchState()
const verification = migrationReport(verified)
process.stdout.write(
  `${JSON.stringify(
    {
      mode: 'verification',
      backup: path.relative(root, backupDirectory),
      ...compactReport(verification),
    },
    null,
    2,
  )}\n`,
)

if (
  verification.missingProjectIssues.length > 0 ||
  verification.itemFieldChanges.length > 0 ||
  verification.hasSprintField ||
  verification.unrankedOpenIssues.length > 0 ||
  !verification.orderingMatches ||
  verification.metadataChanges.length > 0 ||
  verification.viewChanges.length > 0
) {
  process.stderr.write('Kanban migration verification failed.\n')
  process.exit(1)
}

function migrationReport(state) {
  const itemsByNumber = new Map(state.project.items.map((item) => [item.number, item]))
  const issuesByNumber = new Map(state.issues.map((issue) => [issue.number, issue]))
  const missingProjectIssues = state.issues
    .filter((issue) => !itemsByNumber.has(issue.number))
    .map(({ number, title, state: issueState }) => ({ number, title, state: issueState }))
  const itemFieldChanges = state.issues.flatMap((issue) => {
    const item = itemsByNumber.get(issue.number)
    if (!item) {
      return []
    }
    const desiredStatus = targetKanbanStatus(issue, item.specStatus, item.status)
    const desiredSpecStatus = targetSpecStatus(issue, item.specStatus)
    if (item.status === desiredStatus && item.specStatus === desiredSpecStatus) {
      return []
    }
    return [
      {
        issue: issue.number,
        status: item.status === desiredStatus ? 'unchanged' : `${item.status} -> ${desiredStatus}`,
        specStatus:
          item.specStatus === desiredSpecStatus
            ? 'unchanged'
            : `${item.specStatus} -> ${desiredSpecStatus}`,
      },
    ]
  })
  const targetOrder = orderedOpenIssues(state.issues).map(({ number }) => number)
  const actualOrder = state.project.items
    .map(({ number }) => number)
    .filter((number) => String(issuesByNumber.get(number)?.state).toLowerCase() === 'open')

  return {
    repository,
    project: {
      number: projectNumber,
      id: state.project.id,
      title: state.project.title,
    },
    issueCount: state.issues.length,
    projectIssueCount: state.project.items.length,
    targetStatusCounts: statusCounts(state.issues, itemsByNumber),
    missingProjectIssues,
    itemFieldChanges,
    hasSprintField: Boolean(state.project.sprintField),
    orderingMatches: JSON.stringify(actualOrder) === JSON.stringify(targetOrder),
    metadataChanges: planMetadataChanges(state.project),
    viewChanges: planViewChanges(state.project.views),
    unrankedOpenIssues: unrankedOpenIssues(state.issues).map(({ number, title }) => ({
      number,
      title,
    })),
    targetImplementationOrder: targetOrder.slice(0, 20),
    currentImplementationOrder: actualOrder.slice(0, 20),
  }
}

function configureProjectMetadata(project) {
  if (planMetadataChanges(project).length === 0) {
    return
  }
  execFileSync(
    'gh',
    [
      'project',
      'edit',
      String(projectNumber),
      '--owner',
      owner,
      '--description',
      desiredProjectDescription,
      '--readme',
      desiredProjectReadme,
    ],
    { stdio: 'inherit' },
  )
  project.shortDescription = desiredProjectDescription
  project.readme = desiredProjectReadme
}

function planMetadataChanges(project) {
  const changes = []
  if (project.shortDescription !== desiredProjectDescription) {
    changes.push('shortDescription')
  }
  if (project.readme !== desiredProjectReadme) {
    changes.push('readme')
  }
  return changes
}

function compactReport(report) {
  return {
    ...report,
    itemFieldChangeCount: report.itemFieldChanges.length,
    itemFieldChanges: report.itemFieldChanges.slice(0, 20),
    itemFieldChangesTruncated: report.itemFieldChanges.length > 20,
  }
}

function fetchState() {
  const repositoryItems = ghJson([
    'api',
    '--paginate',
    '--slurp',
    `repos/${repository}/issues?state=all&per_page=100`,
  ]).flat()
  const issues = repositoryItems.filter((item) => !item.pull_request)
  const projects = ghJson(['project', 'list', '--owner', owner, '--format', 'json'])
  const project = projects.projects.find((candidate) => candidate.number === projectNumber)
  if (!project) {
    throw new Error(`GitHub Project #${projectNumber} was not found for ${owner}.`)
  }

  const fields = ghJson([
    'project',
    'field-list',
    String(projectNumber),
    '--owner',
    owner,
    '--format',
    'json',
  ]).fields
  const statusField = fields.find((field) => field.name === 'Status')
  const specStatusField = fields.find((field) => field.name === 'Spec Status')
  if (!statusField?.options || !specStatusField?.options) {
    throw new Error('Project Status and Spec Status single-select fields are required.')
  }
  const items = fetchProjectItems(project.id)

  return {
    issues,
    project: {
      ...project,
      fields,
      statusField,
      specStatusField,
      sprintField: fields.find((field) => field.name === 'Sprint') ?? null,
      views: fetchProjectViews(project.id),
      items,
    },
  }
}

function configureStatusField(project) {
  const existingByName = new Map(project.statusField.options.map((option) => [option.name, option]))
  const singleSelectOptions = KANBAN_STATUS_OPTIONS.map((target) => {
    const existing = existingByName.get(target.name) ?? existingByName.get(target.previousName)
    return {
      ...(existing ? { id: existing.id } : {}),
      name: target.name,
      color: target.color,
      description: target.description,
    }
  })
  const result = graphql(
    `mutation($input:UpdateProjectV2FieldInput!) {
      updateProjectV2Field(input:$input) {
        projectV2Field {
          ... on ProjectV2SingleSelectField { id name options { id name } }
        }
      }
    }`,
    {
      input: {
        fieldId: project.statusField.id,
        singleSelectOptions,
      },
    },
  )
  return result.data.updateProjectV2Field.projectV2Field.options
}

function addMissingIssues(state) {
  const present = new Set(state.project.items.map((item) => item.number))
  for (const issue of state.issues.filter((candidate) => !present.has(candidate.number))) {
    const item = ghJson([
      'project',
      'item-add',
      String(projectNumber),
      '--owner',
      owner,
      '--url',
      issue.html_url,
      '--format',
      'json',
    ])
    state.project.items.push({
      id: item.id,
      number: issue.number,
      status: null,
      specStatus: null,
    })
  }
}

function applyItemFields(state) {
  const issuesByNumber = new Map(state.issues.map((issue) => [issue.number, issue]))
  const statusOptions = new Map(
    state.project.statusField.options.map((option) => [option.name, option.id]),
  )
  const specStatusOptions = new Map(
    state.project.specStatusField.options.map((option) => [option.name, option.id]),
  )
  for (const item of state.project.items) {
    const issue = issuesByNumber.get(item.number)
    if (!issue) {
      continue
    }
    const desiredStatus = targetKanbanStatus(issue, item.specStatus, item.status)
    const desiredSpecStatus = targetSpecStatus(issue, item.specStatus)
    if (item.status !== desiredStatus) {
      editItemField(
        state.project,
        item.id,
        state.project.statusField.id,
        statusOptions,
        desiredStatus,
      )
      item.status = desiredStatus
    }
    if (item.specStatus !== desiredSpecStatus) {
      editItemField(
        state.project,
        item.id,
        state.project.specStatusField.id,
        specStatusOptions,
        desiredSpecStatus,
      )
      item.specStatus = desiredSpecStatus
    }
  }
}

function editItemField(project, itemId, fieldId, options, target) {
  const optionId = options.get(target)
  if (!optionId) {
    throw new Error(`Project field option is missing: ${target}`)
  }
  execFileSync(
    'gh',
    [
      'project',
      'item-edit',
      '--id',
      itemId,
      '--project-id',
      project.id,
      '--field-id',
      fieldId,
      '--single-select-option-id',
      optionId,
    ],
    { stdio: 'inherit' },
  )
}

function applyOrdering(state) {
  const itemsByNumber = new Map(state.project.items.map((item) => [item.number, item]))
  const issuesByNumber = new Map(state.issues.map((issue) => [issue.number, issue]))
  const targetOrder = orderedOpenIssues(state.issues).map(({ number }) => number)
  const currentOrder = state.project.items
    .map(({ number }) => number)
    .filter((number) => String(issuesByNumber.get(number)?.state).toLowerCase() === 'open')
  if (JSON.stringify(currentOrder) === JSON.stringify(targetOrder)) {
    return
  }
  let afterId = null
  for (const issue of orderedOpenIssues(state.issues)) {
    const item = itemsByNumber.get(issue.number)
    if (!item) {
      throw new Error(`Project item is missing while ordering issue #${issue.number}.`)
    }
    graphql(
      `mutation($input:UpdateProjectV2ItemPositionInput!) {
        updateProjectV2ItemPosition(input:$input) { items { totalCount } }
      }`,
      {
        input: {
          projectId: state.project.id,
          itemId: item.id,
          afterId,
        },
      },
    )
    afterId = item.id
  }
}

function deleteSprintField(project) {
  if (!project.sprintField) {
    return
  }
  execFileSync('gh', ['project', 'field-delete', '--id', project.sprintField.id], {
    stdio: 'inherit',
  })
}

function configureViews(project) {
  for (const change of planViewChanges(project.views)) {
    if (change.operation === 'create') {
      const result = graphql(
        `mutation($input:CreateProjectV2ViewInput!) {
          createProjectV2View(input:$input) { projectV2View { id name layout filter } }
        }`,
        {
          input: {
            projectId: project.id,
            name: change.target.name,
            layout: change.target.layout,
          },
        },
      )
      const view = result.data.createProjectV2View.projectV2View
      graphql(
        `mutation($input:UpdateProjectV2ViewInput!) {
          updateProjectV2View(input:$input) { projectV2View { id name layout filter } }
        }`,
        {
          input: {
            viewId: view.id,
            filter: change.target.filter,
          },
        },
      )
      continue
    }
    graphql(
      `mutation($input:UpdateProjectV2ViewInput!) {
        updateProjectV2View(input:$input) { projectV2View { id name layout filter } }
      }`,
      {
        input: {
          viewId: change.current.id,
          name: change.target.name,
          layout: change.target.layout,
          filter: change.target.filter,
        },
      },
    )
  }
}

function planViewChanges(currentViews) {
  return desiredViews.flatMap((target) => {
    const current = currentViews.find(
      (view) => view.name === target.name || target.aliases.includes(view.name),
    )
    if (!current) {
      return [{ operation: 'create', target }]
    }
    if (
      current.name === target.name &&
      current.layout === target.layout &&
      current.filter === target.filter
    ) {
      return []
    }
    return [{ operation: 'update', current, target }]
  })
}

function backup(state) {
  const directory = path.join(
    root,
    '.specify',
    'migration-backup',
    `kanban-apply-${new Date().toISOString().replaceAll(':', '-')}`,
  )
  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(
    path.join(directory, 'snapshot.json'),
    `${JSON.stringify({ createdAt: new Date().toISOString(), ...state }, null, 2)}\n`,
  )
  return directory
}

function fetchProjectItems(projectId) {
  const pages = ghJson([
    'api',
    'graphql',
    '--paginate',
    '--slurp',
    '-F',
    `project=${projectId}`,
    '-f',
    `query=query($project:ID!,$endCursor:String) {
      node(id:$project) {
        ... on ProjectV2 {
          items(first:100,after:$endCursor,archivedStates:[ARCHIVED,NOT_ARCHIVED]) {
            nodes {
              id
              content {
                ... on Issue { number repository { nameWithOwner } }
              }
              fieldValues(first:20) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field { ... on ProjectV2SingleSelectField { name } }
                  }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }`,
  ])
  return pages
    .flatMap((page) => page.data.node.items.nodes)
    .filter((item) => item.content?.repository?.nameWithOwner === repository)
    .map((item) => {
      const values = new Map(
        item.fieldValues.nodes
          .filter((value) => value.field?.name)
          .map((value) => [value.field.name, value.name]),
      )
      return {
        id: item.id,
        number: item.content.number,
        status: values.get('Status') ?? null,
        specStatus: values.get('Spec Status') ?? null,
      }
    })
}

function fetchProjectViews(projectId) {
  const result = graphql(
    `query($project:ID!) {
      node(id:$project) {
        ... on ProjectV2 {
          views(first:50) { nodes { id name layout filter } }
        }
      }
    }`,
    { project: projectId },
  )
  return result.data.node.views.nodes
}

function graphql(query, variables) {
  const result = JSON.parse(
    execFileSync('gh', ['api', 'graphql', '--input', '-'], {
      input: JSON.stringify({ query, variables }),
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    }),
  )
  if (result.errors?.length > 0) {
    throw new Error(`GitHub GraphQL failed: ${JSON.stringify(result.errors)}`)
  }
  return result
}

function ghJson(args) {
  return JSON.parse(
    execFileSync('gh', args, {
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    }),
  )
}
