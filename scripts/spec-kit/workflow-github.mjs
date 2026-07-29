import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import {
  PROJECT_NUMBER,
  renderPullRequestBody,
  updateManagedPullRequestBody,
} from './workflow-model.mjs'

export class WorkflowGitHub {
  constructor({ root = process.cwd(), exec = execFileSync, projectNumber = PROJECT_NUMBER } = {}) {
    this.root = root
    this.exec = exec
    this.projectNumber = projectNumber
    this.repository = null
    this.projectContext = null
  }

  command(command, args, options = {}) {
    return this.exec(command, args, {
      cwd: this.root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      ...options,
    })
  }

  ghJson(args) {
    return JSON.parse(this.command('gh', args))
  }

  git(args, options = {}) {
    return this.command('git', args, options).trim()
  }

  resolveRepository() {
    if (!this.repository) {
      this.repository = this.ghJson(['repo', 'view', '--json', 'nameWithOwner']).nameWithOwner
    }
    return this.repository
  }

  fetchIssue(issueNumber) {
    const issue = this.ghJson([
      'issue',
      'view',
      String(issueNumber),
      '--repo',
      this.resolveRepository(),
      '--json',
      'number,title,body,url,state,labels,milestone,projectItems',
    ])
    if (issue.state !== 'OPEN') {
      throw new Error(
        `Issue #${issueNumber} is ${issue.state.toLowerCase()}; select an open issue.`,
      )
    }
    return issue
  }

  currentBranch() {
    return this.git(['branch', '--show-current'])
  }

  assertCleanWorktree() {
    const status = this.git(['status', '--porcelain'])
    if (status) {
      throw new Error(
        'The worktree contains changes that are not owned by this workflow. Commit, stash, or move them before starting.',
      )
    }
  }

  prepareBranch(expectedBranch) {
    const current = this.currentBranch()
    if (current === 'master') {
      this.git(['switch', '-c', expectedBranch], { stdio: 'inherit' })
      return expectedBranch
    }
    if (current !== expectedBranch) {
      throw new Error(
        `Current branch is ${current}; issue workflow expects ${expectedBranch}. Switch to the expected branch or a clean master branch.`,
      )
    }
    return current
  }

  changedFiles() {
    const output = this.command('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
    return parseStatusFiles(output).filter((file) => !file.startsWith('.specify/workflows/runs/'))
  }

  diffStat(files = []) {
    const untrackedOutput = this.command('git', [
      'ls-files',
      '--others',
      '--exclude-standard',
      '-z',
      '--',
      ...files,
    ])
    const untracked = new Set(untrackedOutput.split('\0').filter(Boolean))
    const tracked = files.filter((file) => !untracked.has(file))
    const trackedStat =
      tracked.length > 0 ? this.git(['diff', '--stat', 'HEAD', '--', ...tracked]) : ''
    const untrackedStat = [...untracked]
      .map((file) => formatUntrackedStat(file, fs.readFileSync(path.join(this.root, file))))
      .join('\n')
    return [trackedStat, untrackedStat].filter(Boolean).join('\n')
  }

  filesChangedFromBase(base = 'origin/master') {
    const output = this.git(['diff', '--name-only', `${base}...HEAD`])
    return output ? output.split('\n') : []
  }

  commit(message, approvedFiles) {
    const currentFiles = this.changedFiles()
    if (JSON.stringify([...currentFiles].sort()) !== JSON.stringify([...approvedFiles].sort())) {
      throw new Error(
        'The worktree changed after checkpoint review. Review the updated file list before committing.',
      )
    }
    this.git(['add', '--all', '--', ...approvedFiles])
    const staged = this.git(['diff', '--cached', '--name-only'])
    if (!staged) {
      return null
    }
    this.git(['commit', '-m', message], { stdio: 'inherit' })
    return this.git(['rev-parse', 'HEAD'])
  }

  push(branch) {
    this.git(['push', '--set-upstream', 'origin', branch], { stdio: 'inherit' })
  }

  findPullRequest(branch) {
    return this.ghJson([
      'pr',
      'list',
      '--repo',
      this.resolveRepository(),
      '--head',
      branch,
      '--state',
      'open',
      '--json',
      'number,url,title,body,isDraft',
    ])[0]
  }

  syncPullRequest({ branch, issue, featureDirectory, gate, summary, verification, delivered }) {
    const existing = this.findPullRequest(branch)
    if (!existing) {
      const body = renderPullRequestBody({
        issue,
        featureDirectory,
        gate,
        summary,
        delivered,
        verification,
      })
      this.command(
        'gh',
        [
          'pr',
          'create',
          '--repo',
          this.resolveRepository(),
          '--base',
          'master',
          '--head',
          branch,
          '--draft',
          '--title',
          issue.title,
          '--body',
          body,
        ],
        { stdio: 'inherit' },
      )
      return this.findPullRequest(branch)
    }

    const body = updateManagedPullRequestBody(existing.body, {
      gate,
      summary,
      verification,
      delivered,
    })
    if (body !== existing.body) {
      this.command(
        'gh',
        ['pr', 'edit', String(existing.number), '--repo', this.resolveRepository(), '--body', body],
        { stdio: 'inherit' },
      )
    }
    return { ...existing, body }
  }

  updateProjectStatus(issue, { status, specStatus }) {
    if (!status || !specStatus) {
      throw new Error('Both Project Status and Spec Status are required.')
    }
    const context = this.resolveProjectContext()
    let item = this.fetchIssueProjectItem(issue.number, context.project.id)
    if (!item) {
      this.ghJson([
        'project',
        'item-add',
        String(this.projectNumber),
        '--owner',
        context.owner,
        '--url',
        issue.url,
        '--format',
        'json',
      ])
      item = this.fetchIssueProjectItem(issue.number, context.project.id)
    }
    if (!item) {
      throw new Error(
        `Issue #${issue.number} could not be added to Project #${this.projectNumber}.`,
      )
    }

    this.updateSingleSelectField(context, item, 'Status', status)
    this.updateSingleSelectField(context, item, 'Spec Status', specStatus)
  }

  resolveProjectContext() {
    if (this.projectContext) {
      return this.projectContext
    }
    const owner = this.resolveRepository().split('/')[0]
    const projects = this.ghJson(['project', 'list', '--owner', owner, '--format', 'json'])
    const project = projects.projects.find((candidate) => candidate.number === this.projectNumber)
    if (!project) {
      throw new Error(`GitHub Project #${this.projectNumber} was not found for ${owner}.`)
    }

    const fields = this.ghJson([
      'project',
      'field-list',
      String(this.projectNumber),
      '--owner',
      owner,
      '--format',
      'json',
    ])
    const projectFields = new Map(
      fields.fields
        .filter((field) => field.options)
        .map((field) => [
          field.name,
          {
            ...field,
            optionsByName: new Map(field.options.map((option) => [option.name, option])),
          },
        ]),
    )
    for (const name of ['Status', 'Spec Status']) {
      if (!projectFields.has(name)) {
        throw new Error(`Project single-select field is missing: ${name}`)
      }
    }
    this.projectContext = { owner, project, fields: projectFields }
    return this.projectContext
  }

  fetchIssueProjectItem(issueNumber, projectId) {
    const [repositoryOwner, repositoryName] = this.resolveRepository().split('/')
    const result = this.ghJson([
      'api',
      'graphql',
      '-F',
      `owner=${repositoryOwner}`,
      '-F',
      `name=${repositoryName}`,
      '-F',
      `number=${issueNumber}`,
      '-f',
      `query=query($owner:String!,$name:String!,$number:Int!) {
        repository(owner:$owner,name:$name) {
          issue(number:$number) {
            projectItems(first:20) {
              nodes {
                id
                project { id }
                fieldValues(first:20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2SingleSelectField { name } }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
    ])
    const item = result.data.repository.issue.projectItems.nodes.find(
      (candidate) => candidate.project.id === projectId,
    )
    if (!item) {
      return null
    }
    return {
      id: item.id,
      values: new Map(
        item.fieldValues.nodes
          .filter((value) => value.field?.name)
          .map((value) => [value.field.name, value.name]),
      ),
    }
  }

  updateSingleSelectField(context, item, fieldName, targetValue) {
    if (item.values.get(fieldName) === targetValue) {
      return
    }
    const field = context.fields.get(fieldName)
    const option = field.optionsByName.get(targetValue)
    if (!option) {
      throw new Error(`Project ${fieldName} option is missing: ${targetValue}`)
    }
    this.command(
      'gh',
      [
        'project',
        'item-edit',
        '--id',
        item.id,
        '--project-id',
        context.project.id,
        '--field-id',
        field.id,
        '--single-select-option-id',
        option.id,
      ],
      { stdio: 'inherit' },
    )
    item.values.set(fieldName, targetValue)
  }
}

export function parseStatusFiles(output) {
  if (!output) {
    return []
  }
  const records = output.split('\0').filter(Boolean)
  const files = []
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    const status = record.slice(0, 2)
    files.push(record.slice(3))
    if (status.includes('R') || status.includes('C')) {
      index += 1
      if (records[index]) {
        files.push(records[index])
      }
    }
  }
  return files
}

export function formatUntrackedStat(file, content) {
  if (content.includes(0)) {
    return ` ${file} | binary file added`
  }
  const text = content.toString('utf8')
  const lineCount = text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
  return ` ${file} | ${lineCount} ${'+'.repeat(Math.min(lineCount, 40))}`
}
