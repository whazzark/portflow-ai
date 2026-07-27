#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const manifestPath = path.join(root, 'specs', '.migration-manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const failures = []
const statusEntries = Object.entries(manifest.targetSpecStatuses ?? {})
const targetStatusByIssue = new Map(
  statusEntries.flatMap(([status, issues]) => issues.map((issue) => [issue, status])),
)

if (manifest.allIssueCount !== 165) {
  failures.push(`Expected 165 total issues, found ${manifest.allIssueCount}`)
}
if (manifest.openIssueCount !== 119) {
  failures.push(`Expected 119 open issues, found ${manifest.openIssueCount}`)
}
if (manifest.closedIssueCount !== 46) {
  failures.push(`Expected 46 closed issues, found ${manifest.closedIssueCount}`)
}
if (manifest.roadmapCount !== 30) {
  failures.push(`Expected 30 roadmaps, found ${manifest.roadmapCount}`)
}
if (manifest.featureCount !== 135) {
  failures.push(`Expected 135 feature specs, found ${manifest.featureCount}`)
}

const seenIssues = new Set()
const mappingsByIssue = new Map(manifest.mappings.map((mapping) => [mapping.issue, mapping]))
for (const mapping of manifest.mappings) {
  if (seenIssues.has(mapping.issue)) {
    failures.push(`Duplicate issue mapping GH-${mapping.issue}`)
  }
  seenIssues.add(mapping.issue)
  const absolute = path.join(root, mapping.path)
  if (!fs.existsSync(absolute)) {
    failures.push(`Missing artifact for GH-${mapping.issue}: ${mapping.path}`)
  }
  if (mapping.kind === 'feature') {
    const checklist = path.join(path.dirname(absolute), 'checklists', 'requirements.md')
    if (!fs.existsSync(checklist)) {
      failures.push(`Missing checklist for GH-${mapping.issue}: ${checklist}`)
    }
    const content = fs.readFileSync(absolute, 'utf8')
    if (!content.includes(`**Feature ID**: \`GH-${mapping.issue}\``)) {
      failures.push(`Missing feature ID in ${mapping.path}`)
    }
    for (const circularFallback of [
      'Deliver the behavior described by the linked GitHub issue',
      'The delivered behavior satisfies the linked issue',
      'deliver the behavior described by the source issue',
      'Behavior not described by the source issue remains out of scope',
    ]) {
      if (content.includes(circularFallback)) {
        failures.push(`Circular source-issue fallback remains in ${mapping.path}`)
      }
    }
  }

  if (mapping.parent === null) {
    continue
  }

  const parent = mappingsByIssue.get(mapping.parent)
  if (!parent) {
    failures.push(`Missing parent mapping GH-${mapping.parent} for GH-${mapping.issue}`)
    continue
  }
  if (parent.kind !== 'roadmap') {
    failures.push(`Parent GH-${mapping.parent} of GH-${mapping.issue} is not a roadmap`)
    continue
  }

  const parentContent = fs.readFileSync(path.join(root, parent.path), 'utf8')
  const childDirectory = path.dirname(absolute)
  const relativeDirectory = `./${path.relative(path.dirname(path.join(root, parent.path)), childDirectory).replaceAll(path.sep, '/')}/`
  const expectedStatus =
    targetStatusByIssue.get(mapping.issue) === 'Done'
      ? escapeRegExp('done (historical)')
      : 'planned'
  const expectedRow = new RegExp(
    `\\| GH-${mapping.issue} \\|[^\\n]+\\| ${expectedStatus} \\| ${escapeRegExp(relativeDirectory)} \\|`,
  )
  if (!expectedRow.test(parentContent)) {
    failures.push(
      `Parent roadmap GH-${mapping.parent} does not link GH-${mapping.issue} at ${relativeDirectory}`,
    )
  }

  const content = fs.readFileSync(absolute, 'utf8')
  if (!content.includes(`**Parent Roadmap**: \`${parent.path}\``)) {
    failures.push(`GH-${mapping.issue} does not reference parent roadmap ${parent.path}`)
  }
}

const statusIssues = statusEntries.flatMap(([, issues]) => issues)
if (statusIssues.length !== manifest.allIssueCount) {
  failures.push(
    `Expected ${manifest.allIssueCount} target Spec Status entries, found ${statusIssues.length}`,
  )
}
if (new Set(statusIssues).size !== statusIssues.length) {
  failures.push('Target Spec Status lists contain duplicate issue numbers')
}
for (const status of ['Intake', 'Spec Draft', 'Ready', 'Done']) {
  if (!Object.hasOwn(manifest.targetSpecStatuses ?? {}, status)) {
    failures.push(`Missing target Spec Status list: ${status}`)
  }
}
const expectedStatusCounts = {
  Intake: 10,
  'Spec Draft': 109,
  Ready: 0,
  Done: 46,
}
for (const [status, expectedCount] of Object.entries(expectedStatusCounts)) {
  const actualCount = manifest.targetSpecStatuses?.[status]?.length ?? 0
  if (actualCount !== expectedCount) {
    failures.push(`Expected ${expectedCount} issues targeting ${status}, found ${actualCount}`)
  }
}

for (const mapping of manifest.mappings) {
  const content = fs.readFileSync(path.join(root, mapping.path), 'utf8')
  const targetStatus = targetStatusByIssue.get(mapping.issue)
  const historicalStatus =
    mapping.kind === 'feature'
      ? content.includes('**Status**: Done (historical)')
      : content.includes('**Status**: done')

  if (targetStatus === 'Done' && !historicalStatus) {
    failures.push(`Done mapping GH-${mapping.issue} is not marked historical`)
  }
  if (targetStatus !== 'Done' && historicalStatus) {
    failures.push(`Active mapping GH-${mapping.issue} is incorrectly marked historical`)
  }

  if (targetStatus === 'Done' && mapping.kind === 'feature') {
    const featureDirectory = path.dirname(path.join(root, mapping.path))
    const checklistPath = path.join(featureDirectory, 'checklists', 'requirements.md')
    const checklistContent = fs.readFileSync(checklistPath, 'utf8')
    if (content.includes('[NEEDS CLARIFICATION]')) {
      failures.push(`Historical mapping GH-${mapping.issue} contains an active clarification`)
    }
    if (/^- \[ \]/m.test(checklistContent)) {
      failures.push(`Historical mapping GH-${mapping.issue} contains an unchecked work item`)
    }
    if (!checklistContent.includes('checked items indicate migration capture')) {
      failures.push(`Historical mapping GH-${mapping.issue} lacks an archival checklist note`)
    }
    for (const activeFile of ['plan.md', 'tasks.md']) {
      if (fs.existsSync(path.join(featureDirectory, activeFile))) {
        failures.push(`Historical mapping GH-${mapping.issue} contains active ${activeFile}`)
      }
    }
  }
}

if (process.argv.includes('--github')) {
  const repository = manifest.repository.split('/')
  const query = `query($owner:String!,$repo:String!,$endCursor:String){repository(owner:$owner,name:$repo){issues(first:100,after:$endCursor,states:[OPEN,CLOSED]){nodes{number parent{number}}pageInfo{hasNextPage endCursor}}}}`
  const output = execFileSync(
    'gh',
    [
      'api',
      '--paginate',
      '--slurp',
      'graphql',
      '-f',
      `query=${query}`,
      '-F',
      `owner=${repository[0]}`,
      '-F',
      `repo=${repository[1]}`,
    ],
    { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 },
  )
  const githubIssues = JSON.parse(output).flatMap((page) => page.data.repository.issues.nodes)
  const githubByIssue = new Map(githubIssues.map((issue) => [issue.number, issue]))

  for (const mapping of manifest.mappings) {
    const githubParent = githubByIssue.get(mapping.issue)?.parent?.number ?? null
    if (mapping.parent !== githubParent) {
      failures.push(
        `GitHub parent mismatch for GH-${mapping.issue}: manifest=${mapping.parent ?? 'none'}, GitHub=${githubParent ?? 'none'}`,
      )
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.map((failure) => `ERROR: ${failure}`).join('\n')}\n`)
  process.exit(1)
}

process.stdout.write(
  `Validated ${manifest.mappings.length} issue mappings, ${manifest.roadmapCount} roadmaps, and ${manifest.featureCount} feature specs.\n`,
)

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
