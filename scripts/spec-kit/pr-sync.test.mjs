import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildPullRequestBody,
  commitMessageForFeature,
  parseArgs,
  updateReviewGate,
} from './pr-sync.mjs'

const template = `- [ ] Spec-driven behavior change
Spec: \`specs/.../spec.md\` or \`N/A\`
### Current review gate
- [ ] Spec Review
- [ ] Plan Review
- [ ] Delivery Review
Issue: #
`

test('parses the feature directory and review gate', () => {
  assert.deepEqual(parseArgs(['--feature-dir', 'specs/standalone/example', '--gate', 'spec']), {
    featureDirectory: 'specs/standalone/example',
    gate: 'spec',
    preview: false,
  })
})

test('previews the deterministic commit message before synchronization', () => {
  assert.equal(commitMessageForFeature('specs/standalone/example'), 'chore(spec-kit): sync example')
  assert.equal(
    parseArgs(['--feature-dir', 'specs/standalone/example', '--gate', 'spec', '--preview']).preview,
    true,
  )
})

test('builds a draft PR body with traceability and the current gate', () => {
  const body = buildPullRequestBody({
    template,
    featureDirectory: 'specs/standalone/example',
    issueNumber: '123',
    gate: 'plan',
  })

  assert.match(body, /- \[x\] Spec-driven behavior change/)
  assert.match(body, /Spec: `specs\/standalone\/example\/spec\.md`/)
  assert.match(body, /- \[x\] Plan Review/)
  assert.match(body, /Issue: #123/)
})

test('updates only the review gate in an existing PR body', () => {
  const body = `${template}\nReviewer comment: keep this text\n`
  const updated = updateReviewGate(body, 'delivery')

  assert.match(updated, /- \[x\] Delivery Review/)
  assert.match(updated, /Reviewer comment: keep this text/)
})
