import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const validator = fileURLToPath(new URL('./validate-pr.mjs', import.meta.url))
const specPath = 'specs/standalone/example/spec.md'

function runValidation({
  draft,
  spec = '# Feature\n',
  plan,
  tasks,
  summary = 'Describe the change.',
  database = 'none',
  checklistComplete = !draft,
  gate = draft ? 'spec' : 'delivery',
  issue = '#123',
  changeType = 'spec',
  specReference = specPath,
}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portflow-spec-kit-'))
  const feature = path.join(root, 'specs', 'standalone', 'example')
  fs.mkdirSync(feature, { recursive: true })
  fs.writeFileSync(path.join(feature, 'spec.md'), spec)
  if (plan !== undefined) {
    fs.writeFileSync(path.join(feature, 'plan.md'), plan)
  }
  if (tasks !== undefined) {
    fs.writeFileSync(path.join(feature, 'tasks.md'), tasks)
  }

  const eventPath = path.join(root, 'event.json')
  const noMigration = database === 'none' || database === 'both' ? 'x' : ' '
  const withMigration = database === 'migration' || database === 'both' ? 'x' : ' '
  const notAssessed = database === 'pending' || database === 'both' ? 'x' : ' '
  const checklistMark = checklistComplete ? 'x' : ' '
  const body = `## Summary

${summary}

## Change type

- [${changeType === 'spec' ? 'x' : ' '}] Spec-driven behavior change
- [${changeType === 'bug' ? 'x' : ' '}] Bug fix with existing spec updated
- [${changeType === 'non-spec' ? 'x' : ' '}] Workflow, documentation, or tooling change

## Spec Kit

Spec: \`${specReference}\`

### Current review gate

- [${gate === 'spec' ? 'x' : ' '}] Spec Review
- [${gate === 'plan' ? 'x' : ' '}] Plan Review
- [${gate === 'delivery' ? 'x' : ' '}] Delivery Review
- [${gate === 'n/a' ? 'x' : ' '}] Not applicable (\`Spec: N/A\`)

## Issue

Issue: ${issue}

## Database

- [${notAssessed}] Not assessed yet (Draft PR only)
- [${noMigration}] No migration in this PR
- [${withMigration}] Migration included and reversible

## Ready-for-delivery checklist

- [${checklistMark}] Spec, plan, and tasks are aligned
- [${checklistMark}] Verification is complete
`
  fs.writeFileSync(eventPath, JSON.stringify({ pull_request: { body, draft } }))

  return spawnSync(process.execPath, [validator], {
    cwd: root,
    env: { ...process.env, GITHUB_EVENT_PATH: eventPath },
    encoding: 'utf8',
  })
}

test('allows a draft PR with only a valid spec', () => {
  const result = runValidation({ draft: true })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /valid \(draft PR\)/)
})

test('rejects a ready PR without plan and tasks', () => {
  const result = runValidation({ draft: false })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /missing .*plan\.md/)
  assert.match(result.stderr, /missing .*tasks\.md/)
})

test('reports unresolved clarifications and tasks', () => {
  const result = runValidation({
    draft: false,
    spec: '[NEEDS CLARIFICATION: choose behavior]',
    plan: '# Plan\n',
    tasks: '- [ ] unfinished\n',
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /still contains \[NEEDS CLARIFICATION\]/)
  assert.match(result.stderr, /unchecked tasks/)
})

test('requires a non-empty summary on draft PRs', () => {
  const result = runValidation({ draft: true, summary: '<!-- placeholder -->' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Summary section must not be empty/)
})

test('requires exactly one database choice on draft PRs', () => {
  const result = runValidation({ draft: true, database: 'both' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Database section must have exactly one choice selected/)
})

test('allows incomplete delivery checklist items while the PR is draft', () => {
  const result = runValidation({ draft: true, checklistComplete: false })
  assert.equal(result.status, 0)
})

test('requires every delivery checklist item when the PR is ready', () => {
  const result = runValidation({
    draft: false,
    plan: '# Plan\n',
    tasks: '- [x] complete\n',
    checklistComplete: false,
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /All items in ## Ready-for-delivery checklist must be checked/)
})

test('allows an unassessed database impact during Spec Review', () => {
  const result = runValidation({ draft: true, database: 'pending' })
  assert.equal(result.status, 0)
})

test('requires database impact to be assessed before a PR is ready', () => {
  const result = runValidation({
    draft: false,
    plan: '# Plan\n',
    tasks: '- [x] complete\n',
    database: 'pending',
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /must state whether it includes a database migration/)
})

test('requires plan.md when the Draft PR advances to Plan Review', () => {
  const result = runValidation({ draft: true, gate: 'plan' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Plan Review is missing .*plan\.md/)
})

test('requires completed tasks when the Draft PR advances to Delivery Review', () => {
  const result = runValidation({
    draft: true,
    gate: 'delivery',
    plan: '# Plan\n',
    tasks: '- [ ] unfinished\n',
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Delivery Review tasks\.md still contains unchecked tasks/)
})

test('requires a linked GitHub issue', () => {
  const result = runValidation({ draft: true, issue: '#' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /must contain an issue reference/)
})

test('requires Delivery Review before marking a spec-driven PR ready', () => {
  const result = runValidation({
    draft: false,
    gate: 'plan',
    plan: '# Plan\n',
    tasks: '- [x] complete\n',
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /must select Delivery Review/)
})

test('allows a workflow PR with no Spec Kit artifacts', () => {
  const result = runValidation({
    draft: true,
    changeType: 'non-spec',
    gate: 'n/a',
    specReference: 'N/A',
  })
  assert.equal(result.status, 0)
})

test('rejects a Spec Kit review gate on a workflow PR', () => {
  const result = runValidation({
    draft: true,
    changeType: 'non-spec',
    gate: 'spec',
    specReference: 'N/A',
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /must select the not-applicable review gate/)
})
