#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const usage = `Usage:
  pnpm spec:workflow -- run --feature-dir <specs/path> --description <intent> [--dry-run]
  pnpm spec:workflow -- resume <run-id> --feature-dir <specs/path> [--dry-run]
  pnpm spec:workflow -- status [run-id] [--dry-run]
`

export function validateFeatureDirectory(value, root = process.cwd()) {
  if (!value) {
    throw new Error('--feature-dir is required.')
  }
  if (path.isAbsolute(value) || value.includes('\\')) {
    throw new Error('--feature-dir must be a POSIX-style path relative to the repository.')
  }

  const normalized = path.posix.normalize(value)
  const segments = normalized.split('/')

  if (
    normalized !== value ||
    segments[0] !== 'specs' ||
    segments.length < 3 ||
    segments.some((segment) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment))
  ) {
    throw new Error(
      '--feature-dir must match specs/<domain>/<feature> or specs/<domain>/<epic>/<feature> using lowercase slugs.',
    )
  }

  const absolute = path.resolve(root, normalized)
  const specsRoot = `${path.resolve(root, 'specs')}${path.sep}`
  if (!absolute.startsWith(specsRoot)) {
    throw new Error('--feature-dir must resolve inside specs/.')
  }

  return normalized
}

export function resolveInvocation(argv, root = process.cwd()) {
  const normalizedArgv = argv[0] === '--' ? argv.slice(1) : argv
  const [action, ...rest] = normalizedArgv
  if (!['run', 'resume', 'status'].includes(action)) {
    throw new Error(usage)
  }

  const dryRun = rest.includes('--dry-run')
  const args = rest.filter((argument) => argument !== '--dry-run')

  if (action === 'status') {
    if (args.length > 1 || args.some((argument) => argument.startsWith('--'))) {
      throw new Error(usage)
    }
    return {
      command: 'specify',
      args: ['workflow', 'status', ...args],
      dryRun,
      featureDirectory: null,
    }
  }

  const featureIndex = args.indexOf('--feature-dir')
  if (featureIndex === -1) {
    throw new Error('--feature-dir is required.')
  }
  const featureDirectory = validateFeatureDirectory(args[featureIndex + 1], root)
  args.splice(featureIndex, 2)

  if (action === 'run') {
    const descriptionIndex = args.indexOf('--description')
    if (descriptionIndex === -1) {
      throw new Error('--description is required for run.')
    }
    const description = args[descriptionIndex + 1]
    if (!description) {
      throw new Error('--description is required for run.')
    }
    args.splice(descriptionIndex, 2)
    if (args.length > 0) {
      throw new Error(`Unexpected arguments: ${args.join(' ')}`)
    }

    const specFile = path.join(root, featureDirectory, 'spec.md')
    const existingSpec = fs.existsSync(specFile)
    if (
      existingSpec &&
      /\*\*Status\*\*:\s*Done \(historical\)/i.test(fs.readFileSync(specFile, 'utf8'))
    ) {
      throw new Error(
        'Historical specs cannot start an implementation workflow. Create a new intake issue and feature directory.',
      )
    }

    return {
      command: 'specify',
      args: [
        'workflow',
        'run',
        existingSpec ? 'portflow-existing-feature' : 'portflow-feature',
        '--input',
        `spec=${description}`,
      ],
      dryRun,
      featureDirectory,
    }
  }

  const [runId, ...unexpected] = args
  if (!runId || runId.startsWith('--')) {
    throw new Error('A workflow run ID is required for resume.')
  }
  if (unexpected.length > 0) {
    throw new Error(`Unexpected arguments: ${unexpected.join(' ')}`)
  }
  return {
    command: 'specify',
    args: ['workflow', 'resume', runId],
    dryRun,
    featureDirectory,
  }
}

export function main(argv = process.argv.slice(2)) {
  try {
    const invocation = resolveInvocation(argv)
    const env = invocation.featureDirectory
      ? { ...process.env, SPECIFY_FEATURE_DIRECTORY: invocation.featureDirectory }
      : process.env

    if (invocation.dryRun) {
      process.stdout.write(
        `${JSON.stringify(
          {
            command: [invocation.command, ...invocation.args],
            SPECIFY_FEATURE_DIRECTORY: invocation.featureDirectory,
          },
          null,
          2,
        )}\n`,
      )
      return 0
    }

    const result = spawnSync(invocation.command, invocation.args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    })

    if (result.error) {
      throw result.error
    }
    return result.status ?? 1
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}

const isEntrypoint =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href ===
    pathToFileURL(fileURLToPath(import.meta.url)).href

if (isEntrypoint) {
  process.exitCode = main()
}
