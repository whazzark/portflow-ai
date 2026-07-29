#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const gates = {
  spec: 'Spec Review',
  plan: 'Plan Review',
  delivery: 'Delivery Review',
}

function usage() {
  return `Usage:
  node scripts/spec-kit/pr-sync.mjs --feature-dir <specs/path> --gate <spec|plan|delivery> [--preview]`
}

function run(command, args, root = process.cwd()) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `${command} ${args.join(' ')} failed.`)
  }
  return result.stdout.trim()
}

export function parseArgs(argv) {
  const featureIndex = argv.indexOf('--feature-dir')
  const gateIndex = argv.indexOf('--gate')
  const preview = argv.includes('--preview')
  const featureDirectory = argv[featureIndex + 1]
  const gate = argv[gateIndex + 1]

  if (
    featureIndex === -1 ||
    gateIndex === -1 ||
    !featureDirectory ||
    !gate ||
    !gates[gate] ||
    argv.some(
      (value, index) =>
        !['--feature-dir', '--gate', '--preview'].includes(value) &&
        index !== featureIndex + 1 &&
        index !== gateIndex + 1,
    )
  ) {
    throw new Error(usage())
  }

  return { featureDirectory, gate, preview }
}

function issueNumberFromBranch(branch) {
  const match = branch.match(/^feat\/(\d+)-/)
  if (!match) {
    throw new Error(`Cannot determine the GitHub issue number from branch ${branch}.`)
  }
  return match[1]
}

export function commitMessageForFeature(featureDirectory) {
  return `chore(spec-kit): sync ${path.basename(featureDirectory)}`
}

export function buildPullRequestBody({ template, featureDirectory, issueNumber, gate }) {
  const reviewGate = gates[gate]
  let body = template
    .replace('Spec: `specs/.../spec.md` or `N/A`', `Spec: \`${featureDirectory}/spec.md\``)
    .replace('Issue: #', `Issue: #${issueNumber}`)
    .replace('- [ ] Spec-driven behavior change', '- [x] Spec-driven behavior change')

  for (const candidate of Object.values(gates)) {
    body = body.replace(
      `- [ ] ${candidate}`,
      `- [${candidate === reviewGate ? 'x' : ' '}] ${candidate}`,
    )
  }

  return body
}

export function updateReviewGate(body, gate) {
  const reviewGate = gates[gate]
  return Object.values(gates).reduce(
    (updated, candidate) =>
      updated.replace(
        new RegExp(`- \\[([ x])\\] ${candidate}`),
        `- [${candidate === reviewGate ? 'x' : ' '}] ${candidate}`,
      ),
    body,
  )
}

function commitAndPush(root, branch, featureDirectory) {
  if (run('git', ['status', '--porcelain'], root)) {
    run('git', ['add', '--all'], root)
    const commitCheck = spawnSync('git', ['diff', '--cached', '--quiet'], {
      cwd: root,
      encoding: 'utf8',
    })
    if (commitCheck.status !== 0) {
      run('git', ['commit', '-m', commitMessageForFeature(featureDirectory)], root)
    }
  }
  run('git', ['push', '--set-upstream', 'origin', branch], root)
}

export function syncPullRequest({ root = process.cwd(), featureDirectory, gate }) {
  const branch = run('git', ['branch', '--show-current'], root)
  const issueNumber = issueNumberFromBranch(branch)
  commitAndPush(root, branch, featureDirectory)

  const existing = run(
    'gh',
    ['pr', 'list', '--head', branch, '--json', 'number', '--jq', '.[0].number'],
    root,
  )
  const template = fs.readFileSync(path.join(root, '.github', 'PULL_REQUEST_TEMPLATE.md'), 'utf8')
  if (!existing) {
    const spec = `Spec Kit workflow for ${featureDirectory}.`
    const body = buildPullRequestBody({ template, featureDirectory, issueNumber, gate })
    run(
      'gh',
      [
        'pr',
        'create',
        '--draft',
        '--base',
        'master',
        '--head',
        branch,
        '--title',
        `feat: ${spec}`,
        '--body',
        body,
      ],
      root,
    )
    return { action: 'created', branch, gate }
  }

  const body = run('gh', ['pr', 'view', existing, '--json', 'body', '--jq', '.body'], root)
  run('gh', ['pr', 'edit', existing, '--body', updateReviewGate(body, gate)], root)
  return { action: 'updated', number: existing, branch, gate }
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv)
    if (args.preview) {
      process.stdout.write(`${commitMessageForFeature(args.featureDirectory)}\n`)
      return 0
    }
    syncPullRequest(args)
    return 0
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
