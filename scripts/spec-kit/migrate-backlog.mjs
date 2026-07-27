#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { buildArtifactModel } from './migration-model.mjs'

const repository = process.env.GITHUB_REPOSITORY ?? 'whazzark/portflow-ai'
const [owner, repo] = repository.split('/')
const root = process.cwd()
const specsRoot = path.join(root, 'specs')
const dryRun = process.argv.includes('--dry-run')
const forceRegenerate = process.argv.includes('--force-regenerate')

const issues = fetchIssues()
const existingManifest = readExistingManifest()
if (existingManifest && !dryRun && !forceRegenerate) {
  throw new Error(
    'A migration manifest already exists. Use --dry-run to audit it; --force-regenerate would overwrite migrated source content.',
  )
}
const migrationScope = existingManifest
  ? new Set(existingManifest.mappings.map((mapping) => mapping.issue))
  : null
const issuesByNumber = new Map(issues.map((issue) => [issue.number, issue]))
const allNonPullRequests = issues.filter(
  (issue) => !issue.pull_request && (!migrationScope || migrationScope.has(issue.number)),
)
const openIssues = allNonPullRequests.filter(
  (issue) => issue.state === 'open' || issue.state === 'OPEN',
)
const scopedIssueNumbers = new Set(allNonPullRequests.map((issue) => issue.number))
const hierarchy = fetchHierarchy()
  .filter((entry) => scopedIssueNumbers.has(entry.number))
  .map((entry) => ({
    ...entry,
    parent: scopedIssueNumbers.has(entry.parent) ? entry.parent : null,
    children: entry.children.filter((number) => scopedIssueNumbers.has(number)),
  }))
const hierarchyByNumber = new Map(hierarchy.map((entry) => [entry.number, entry]))
const mappings = buildArtifactModel(allNonPullRequests, hierarchy)
const frozenStatuses = existingManifest
  ? new Map(
      Object.entries(existingManifest.targetSpecStatuses ?? {}).flatMap(([status, issueNumbers]) =>
        issueNumbers.map((issueNumber) => [issueNumber, status]),
      ),
    )
  : null
if (frozenStatuses) {
  for (const mapping of mappings) {
    mapping.targetSpecStatus = frozenStatuses.get(mapping.issue) ?? mapping.targetSpecStatus
  }
}
const mappingsByIssue = new Map(mappings.map((mapping) => [mapping.issue, mapping]))
const generated = []

for (const mapping of mappings) {
  const issue = issuesByNumber.get(mapping.issue)
  const parent = mapping.parent ? issuesByNumber.get(mapping.parent) : null
  const parentMapping = mapping.parent ? mappingsByIssue.get(mapping.parent) : null
  const domain = mapping.path.split('/')[1]

  if (mapping.kind === 'roadmap') {
    const children = (hierarchyByNumber.get(mapping.issue)?.children ?? []).map((number) =>
      issuesByNumber.get(number),
    )
    generated.push({
      path: mapping.path,
      content: renderRoadmap(issue, children, domain, mapping, parentMapping),
    })
    continue
  }

  const directory = path.posix.dirname(mapping.path)
  generated.push({
    path: mapping.path,
    content: renderSpec(issue, parent, domain, parentMapping),
  })
  generated.push({
    path: path.posix.join(directory, 'checklists', 'requirements.md'),
    content: renderChecklist(issue, acceptanceFor(issue)),
  })
}

const duplicatePaths = findDuplicates(mappings.map((mapping) => mapping.path))
if (duplicatePaths.length > 0) {
  throw new Error(`Duplicate spec paths: ${duplicatePaths.join(', ')}`)
}

const targetSpecStatuses = Object.fromEntries(
  ['Intake', 'Spec Draft', 'Ready', 'Done'].map((status) => [
    status,
    mappings
      .filter((mapping) => mapping.targetSpecStatus === status)
      .map((mapping) => mapping.issue),
  ]),
)
const manifest = {
  generatedAt: new Date().toISOString(),
  repository,
  allIssueCount: allNonPullRequests.length,
  openIssueCount: openIssues.length,
  closedIssueCount: allNonPullRequests.filter((issue) => issue.state === 'closed').length,
  roadmapCount: mappings.filter((mapping) => mapping.kind === 'roadmap').length,
  featureCount: mappings.filter((mapping) => mapping.kind === 'feature').length,
  targetSpecStatuses,
  mappings: mappings.map(({ targetSpecStatus: _targetSpecStatus, ...mapping }) => mapping),
}

if (dryRun) {
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
  process.exit(0)
}

fs.mkdirSync(specsRoot, { recursive: true })

for (const item of generated) {
  const destination = path.join(root, item.path)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, item.content)
}

fs.writeFileSync(
  path.join(specsRoot, '.migration-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)

function readExistingManifest() {
  const manifestPath = path.join(specsRoot, '.migration-manifest.json')
  if (!fs.existsSync(manifestPath)) {
    return null
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
}

function fetchIssues() {
  const output = execFileSync(
    'gh',
    ['api', '--paginate', '--slurp', `repos/${owner}/${repo}/issues?state=all&per_page=100`],
    {
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    },
  )
  const pages = JSON.parse(output)

  return pages.flat().filter((issue) => !issue.pull_request)
}

function fetchHierarchy() {
  const query = `query($owner:String!,$repo:String!,$endCursor:String){repository(owner:$owner,name:$repo){issues(first:100,after:$endCursor,states:[OPEN,CLOSED]){nodes{number parent{number} subIssues(first:100){nodes{number}}}pageInfo{hasNextPage endCursor}}}}`
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
      `owner=${owner}`,
      '-F',
      `repo=${repo}`,
    ],
    { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 },
  )

  return JSON.parse(output)
    .flatMap((page) => page.data.repository.issues.nodes)
    .map((issue) => ({
      number: issue.number,
      parent: issue.parent?.number ?? null,
      children: issue.subIssues.nodes.map((child) => child.number),
    }))
}

function renderRoadmap(issue, children, domain, mapping, parentMapping) {
  const childRows = children
    .sort((a, b) => a.number - b.number)
    .map((child) => {
      const childMapping = mappingsByIssue.get(child.number)
      const childDirectory = path.posix.dirname(childMapping.path)
      const relativeDirectory = path.posix.relative(
        path.posix.dirname(mapping.path),
        childDirectory,
      )
      const childPath = `./${relativeDirectory}/`
      const status =
        child.state === 'open' || child.state === 'OPEN' ? 'planned' : 'done (historical)'
      return `| GH-${child.number} | ${escapePipe(child.title)} | ${status} | ${childPath} |`
    })
    .join('\n')
  const parentMetadata = parentMapping
    ? `**Parent Roadmap**: \`${parentMapping.path}\`\n**Roadmap Entry**: \`GH-${issue.number}\`\n`
    : ''

  return `# Roadmap: ${issue.title}\n\n**GitHub Issue**: [#${issue.number}](${issue.html_url})\n${parentMetadata}**Domain**: ${domain}\n**Status**: ${issue.state === 'open' || issue.state === 'OPEN' ? 'in-progress' : 'done'}\n\n${summaryFromBody(issue.body)}\n\n## Delivery slices\n\n| ID | Sub-feature | Status | Artifact |\n|---|---|---|---|\n${childRows || '| — | No linked sub-issues | planned | — |'}\n\n## Cross-cutting context\n\n${renderSourceSections(issue.body, ['Problem Statement', 'Solution', 'Implementation Decisions', 'Testing Decisions', 'Out of Scope'])}\n\n## Traceability\n\n- Canonical issue: ${issue.html_url}\n- Child issue relationships are read from GitHub sub-issues.\n- Each child owns an independently reviewable roadmap or feature spec.\n`
}

function renderSpec(issue, parent, domain, parentMapping) {
  const parentPath = parentMapping?.path ?? 'N/A'
  const acceptance = acceptanceFor(issue)
  const build = extractSection(issue.body, [
    'What to build',
    'Problem Statement',
    'Solution',
    'Context',
  ])
  const hasBehavioralContract = Boolean(acceptance || build)
  const historical = issue.state === 'closed' || issue.state === 'CLOSED'
  const status = historical
    ? 'Done (historical)'
    : hasLabel(issue, 'triage:needs-triage') || !hasBehavioralContract
      ? 'Needs Clarification'
      : 'Draft'
  const dependencies = extractSection(issue.body, ['Dependencies', 'Blocked by'])
  const outOfScope = extractSection(issue.body, ['Out of scope', 'Out of Scope'])
  const decisions = extractSection(issue.body, ['Implementation Decisions', 'Testing Decisions'])
  const story = build || fallbackStory(issue, historical)
  const scenarios = acceptance || fallbackAcceptance(issue, historical)
  const requirements =
    acceptance || build
      ? requirementsFromAcceptance(acceptance || build)
      : fallbackRequirement(issue, historical)
  const clarification = historical
    ? '- Historical delivery; no unresolved migration question is an active planning item.'
    : hasLabel(issue, 'triage:needs-triage') || !hasBehavioralContract
      ? `- [NEEDS CLARIFICATION: Define the actor, scope, intended behavior, and observable acceptance criteria for "${issue.title}" before plan approval.]`
      : '- Assumptions are inherited from the linked roadmap and existing domain documentation.'
  const fallbackOutOfScope = historical
    ? `- This archival record covers only the delivered capability named "${issue.title}".`
    : '- Scope cannot be finalized until the missing behavioral contract is clarified.'

  return `# Feature Specification: ${issue.title}\n\n**Feature ID**: \`GH-${issue.number}\`\n**GitHub Issue**: [#${issue.number}](${issue.html_url})\n**Parent Roadmap**: \`${parentPath}\`\n**Roadmap Entry**: \`${parent ? `GH-${issue.number}` : 'N/A'}\`\n**Created**: ${issue.created_at.slice(0, 10)}\n**Status**: ${status}\n**Priority**: ${labelValue(issue, 'priority:')}\n**Milestone**: ${issue.milestone?.title ?? 'Unmilestoned'}\n**Domain**: ${domain}\n\n## User Scenarios & Testing\n\n### User Story 1 - ${issue.title} (Priority: P1)\n\n${story}\n\n**Independent Test**: Verify the acceptance criteria through the appropriate observable API, feature, or browser seam.\n\n**Acceptance Scenarios**:\n\n${numbered(scenarios)}\n\n## Edge Cases\n\n- Authentication, authorization, validation, conflict, concurrency, empty, and failure states identified by the source issue must remain covered.\n\n## Requirements\n\n### Functional Requirements\n\n${requirements}\n\n## Success Criteria\n\n- **SC-001**: Every acceptance criterion is demonstrably satisfied by a test or reviewable behavior.\n- **SC-002**: The feature preserves the domain and authorization invariants stated in the parent roadmap and ADRs.\n\n## Dependencies\n\n${dependencies || '- No explicit dependency was recorded in the source issue.'}\n\n## Out of Scope\n\n${outOfScope || fallbackOutOfScope}\n\n## Assumptions and Clarifications\n\n${clarification}\n\n## Source-derived decisions\n\n${decisions || '- No separate implementation or testing decisions were recorded in the source issue.'}\n\n## Traceability\n\n- Source issue: ${issue.html_url}\n- Parent roadmap: ${parentPath}\n- Related domain: ${domain}\n`
}

function acceptanceFor(issue) {
  return extractSection(issue.body, ['Acceptance criteria', 'Acceptance Criteria'])
}

function renderChecklist(issue, acceptance) {
  const historical = issue.state === 'closed' || issue.state === 'CLOSED'
  const build = extractSection(issue.body, [
    'What to build',
    'Problem Statement',
    'Solution',
    'Context',
  ])
  const hasBehavioralContract = Boolean(acceptance || build)
  const items = cleanLines(
    acceptance ||
      (historical
        ? `Historical migration captured the delivered capability named "${issue.title}".`
        : `Define the actor, scope, intended behavior, and observable acceptance criteria for "${issue.title}" before planning.`),
  )
  const checkbox = historical ? '[x]' : '[ ]'
  const clarification =
    !historical && (hasLabel(issue, 'triage:needs-triage') || !hasBehavioralContract)
      ? '- [ ] Resolve all `[NEEDS CLARIFICATION]` markers before plan approval.\n'
      : ''
  const archivalNote = historical
    ? '\n> Historical record: checked items indicate migration capture, not a new approval or implementation queue.\n'
    : ''
  return `# Requirements Checklist: ${issue.title}\n\n**Feature ID**: \`GH-${issue.number}\`\n**Spec**: \`../spec.md\`\n${archivalNote}\n## Source acceptance criteria\n\n${clarification}${items.map((item) => `- ${checkbox} ${item}`).join('\n')}\n\n## Verification\n\n- ${checkbox} Each item maps to a test or reviewable behavior.\n- ${checkbox} API and web seams are covered where applicable.\n- ${checkbox} No requirement is implemented outside the approved spec.\n`
}

function fallbackStory(issue, historical) {
  return historical
    ? `Historical record: "${issue.title}" was delivered before the Spec Kit migration.`
    : `[NEEDS CLARIFICATION: Define the actor, intended behavior, and user value for "${issue.title}" before planning.]`
}

function fallbackAcceptance(issue, historical) {
  return historical
    ? `The migration records the previously delivered capability named "${issue.title}".`
    : `Before planning, this spec defines the actor, scope, outcomes, and observable acceptance criteria for "${issue.title}".`
}

function fallbackRequirement(issue, historical) {
  return historical
    ? `- **FR-001**: This archival specification MUST identify the delivered capability as "${issue.title}".`
    : `- **FR-001**: The feature MUST NOT proceed to planning until the behavioral contract for "${issue.title}" is explicit and reviewable.`
}

function summaryFromBody(body = '') {
  const solution = extractSection(body, ['Solution', 'What to build', 'Problem Statement'])
  return solution
    ? solution.split('\n\n')[0].trim()
    : 'The roadmap groups independently deliverable slices from the source issue.'
}

function renderSourceSections(body = '', names) {
  const sections = names.map((name) => extractSection(body, [name])).filter(Boolean)
  return sections.length > 0
    ? sections.join('\n\n')
    : 'The source issue did not provide additional cross-cutting context.'
}

function extractSection(body = '', names) {
  for (const name of names) {
    const expression = new RegExp(`^##\\s+${escapeRegExp(name)}\\s*$`, 'im')
    const match = expression.exec(body)
    if (!match) {
      continue
    }
    const start = match.index + match[0].length
    const remainder = body.slice(start)
    const nextHeading = remainder.search(/^##\s+/m)
    return remainder.slice(0, nextHeading === -1 ? remainder.length : nextHeading).trim()
  }

  return ''
}

function requirementsFromAcceptance(text = '') {
  const lines = cleanLines(text)

  if (lines.length === 0) {
    throw new Error('Cannot derive requirements from an empty behavioral contract')
  }
  return lines
    .map(
      (line, index) =>
        `- **FR-${String(index + 1).padStart(3, '0')}**: The system MUST ${lowercaseFirst(line.replace(/[.!]$/, ''))}.`,
    )
    .join('\n')
}

function cleanLines(text = '') {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*(?:[-*]\s+|\d+[.)]\s+)/, '')
        .replace(/^\s*\[[ xX]\]\s+/, '')
        .trim(),
    )
    .filter(Boolean)
}

function numbered(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line, index) =>
        `${index + 1}. **Given** the feature's applicable state, **When** the actor performs the described action, **Then** ${line.replace(/^[-*]\s+/, '').replace(/^\s*\[[ xX]\]\s+/, '')}`,
    )
    .join('\n')
}

function hasLabel(issue, label) {
  return issue.labels?.some((candidate) => candidate.name === label)
}

function labelValue(issue, prefix) {
  return issue.labels?.find((label) => label.name.startsWith(prefix))?.name ?? 'Unprioritized'
}

function escapePipe(value) {
  return value.replaceAll('|', '\\|')
}

function lowercaseFirst(value) {
  return value ? value[0].toLowerCase() + value.slice(1) : value
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findDuplicates(values) {
  const seen = new Set()
  const duplicates = new Set()
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    }
    seen.add(value)
  }
  return [...duplicates]
}
