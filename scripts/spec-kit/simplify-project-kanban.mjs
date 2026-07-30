#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { PROJECT_NUMBER } from './workflow-model.mjs'

const EXPECTED_STATUS = ['Backlog', 'Ready', 'In Progress', 'Review', 'Blocked', 'Done']

export function planProjectSimplification(fields) {
  const status = fields.find((field) => field.name === 'Status')
  if (!status?.options) {
    throw new Error('Project Status single-select field is required.')
  }
  const actual = status.options.map((option) => option.name)
  const missing = EXPECTED_STATUS.filter((name) => !actual.includes(name))
  const unexpected = actual.filter((name) => !EXPECTED_STATUS.includes(name))
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Project Status options differ from the canonical Kanban (missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}).`,
    )
  }
  const specStatus = fields.find((field) => field.name === 'Spec Status')
  return {
    statusField: { id: status.id, options: actual },
    specStatusField: specStatus
      ? {
          id: specStatus.id,
          options: specStatus.options?.map((option) => option.name) ?? [],
        }
      : null,
    actions: specStatus ? [{ type: 'delete-field', field: 'Spec Status', id: specStatus.id }] : [],
    notes: [
      'Issue Status values are preserved.',
      'Detailed delivery progress remains in pull requests.',
      'Review Project views manually after apply because GitHub does not expose every view edit through gh.',
    ],
  }
}

export class ProjectSimplifier {
  constructor({ root = process.cwd(), exec = execFileSync, projectNumber = PROJECT_NUMBER } = {}) {
    this.root = root
    this.exec = exec
    this.projectNumber = projectNumber
  }

  command(command, args) {
    return this.exec(command, args, {
      cwd: this.root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  }

  ghJson(args) {
    return JSON.parse(this.command('gh', args))
  }

  inspect() {
    const repository = this.ghJson(['repo', 'view', '--json', 'nameWithOwner']).nameWithOwner
    const owner = repository.split('/')[0]
    const projects = this.ghJson(['project', 'list', '--owner', owner, '--format', 'json'])
    const project = projects.projects.find((candidate) => candidate.number === this.projectNumber)
    if (!project) {
      throw new Error(`Project #${this.projectNumber} was not found for ${owner}.`)
    }
    const fields = this.ghJson([
      'project',
      'field-list',
      String(this.projectNumber),
      '--owner',
      owner,
      '--format',
      'json',
    ]).fields
    const items = this.ghJson([
      'project',
      'item-list',
      String(this.projectNumber),
      '--owner',
      owner,
      '--limit',
      '1000',
      '--format',
      'json',
    ])
    return {
      repository,
      owner,
      project,
      fields,
      items,
      plan: planProjectSimplification(fields),
    }
  }

  apply(inspection) {
    const backupDirectory = path.join(
      this.root,
      '.specify',
      'migration-backup',
      new Date().toISOString().replaceAll(':', '-'),
    )
    fs.mkdirSync(backupDirectory, { recursive: true })
    const backup = path.join(backupDirectory, 'project-simplification.json')
    fs.writeFileSync(backup, `${JSON.stringify(inspection, null, 2)}\n`)

    for (const action of inspection.plan.actions) {
      if (action.type === 'delete-field') {
        this.command('gh', ['project', 'field-delete', '--id', action.id])
      }
    }
    return backup
  }
}

export function main(argv = process.argv.slice(2), dependencies = {}) {
  const apply = argv.includes('--apply')
  const unexpected = argv.filter(
    (value) => !['--', '--apply', '--dry-run', '--json'].includes(value),
  )
  if (unexpected.length > 0) {
    throw new Error(`Unexpected argument: ${unexpected[0]}`)
  }
  const simplifier = new ProjectSimplifier(dependencies)
  const inspection = simplifier.inspect()
  if (!apply) {
    process.stdout.write(`${JSON.stringify(inspection.plan, null, 2)}\n`)
    return 0
  }
  const backup = simplifier.apply(inspection)
  process.stdout.write(`${JSON.stringify({ applied: inspection.plan.actions, backup }, null, 2)}\n`)
  return 0
}

const isEntrypoint =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href ===
    pathToFileURL(fileURLToPath(import.meta.url)).href

if (isEntrypoint) {
  try {
    process.exitCode = main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
