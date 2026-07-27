import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildArtifactModel } from './migration-model.mjs'

const issue = (number, title, { labels = [], state = 'open' } = {}) => ({
  number,
  title,
  state,
  labels: labels.map((name) => ({ name })),
  milestone: null,
})

test('promotes issues with children to roadmaps and nests their feature specs', () => {
  const mappings = buildArtifactModel(
    [issue(127, 'Frontend testing strategy'), issue(128, 'Test pyramid')],
    [
      { number: 127, parent: null, children: [128] },
      { number: 128, parent: 127, children: [] },
    ],
  )

  assert.deepEqual(mappings, [
    {
      issue: 127,
      kind: 'roadmap',
      path: 'specs/standalone/frontend-testing-strategy/roadmap.md',
      parent: null,
      targetSpecStatus: 'Spec Draft',
    },
    {
      issue: 128,
      kind: 'feature',
      path: 'specs/standalone/frontend-testing-strategy/test-pyramid/spec.md',
      parent: 127,
      targetSpecStatus: 'Spec Draft',
    },
  ])
})

test('keeps explicitly labelled roadmaps and supports nested roadmaps', () => {
  const mappings = buildArtifactModel(
    [
      issue(155, 'AI foundations', { labels: ['epic'], state: 'closed' }),
      issue(156, 'Coordinator', { labels: ['epic'], state: 'closed' }),
    ],
    [
      { number: 155, parent: null, children: [156] },
      { number: 156, parent: 155, children: [] },
    ],
  )

  assert.deepEqual(mappings, [
    {
      issue: 155,
      kind: 'roadmap',
      path: 'specs/standalone/ai-foundations/roadmap.md',
      parent: null,
      targetSpecStatus: 'Done',
    },
    {
      issue: 156,
      kind: 'roadmap',
      path: 'specs/standalone/ai-foundations/coordinator/roadmap.md',
      parent: 155,
      targetSpecStatus: 'Done',
    },
  ])
})

test('captures the intended Project status before legacy labels are removed', () => {
  const mappings = buildArtifactModel(
    [
      issue(1, 'Needs qualification', {
        labels: ['speckit:intake', 'speckit:spec-draft'],
      }),
      issue(2, 'Ready feature', { labels: ['agent:ready'] }),
      issue(3, 'Historical feature', { state: 'closed' }),
    ],
    [
      { number: 1, parent: null, children: [] },
      { number: 2, parent: null, children: [] },
      { number: 3, parent: null, children: [] },
    ],
  )

  assert.deepEqual(
    mappings.map(({ issue: number, targetSpecStatus }) => ({ number, targetSpecStatus })),
    [
      { number: 1, targetSpecStatus: 'Intake' },
      { number: 2, targetSpecStatus: 'Ready' },
      { number: 3, targetSpecStatus: 'Done' },
    ],
  )
})
