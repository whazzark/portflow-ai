import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildIssueBody,
  changedActions,
  planCutover,
  summarizeActions,
} from './github-cutover-model.mjs'

const manifest = {
  mappings: [
    {
      issue: 1,
      kind: 'roadmap',
      path: 'specs/domain/example/roadmap.md',
      parent: null,
    },
  ],
  targetSpecStatuses: {
    Intake: [1],
    'Spec Draft': [],
    Ready: [],
    Done: [],
  },
}

test('plans body, Project, and legacy-label changes without adding state labels', () => {
  const actions = planCutover({
    manifest,
    issues: [
      {
        number: 1,
        body: 'Old body',
        labels: [{ name: 'priority:P1' }, { name: 'speckit:spec-draft' }],
      },
    ],
    projectItems: [],
    repository: 'owner/repo',
    baseBranch: 'master',
  })

  assert.equal(actions[0].body.change, true)
  assert.deepEqual(actions[0].labels.remove, ['speckit:spec-draft'])
  assert.equal(actions[0].project.operation, 'add')
  assert.equal(actions[0].project.targetSpecStatus, 'Intake')
  assert.deepEqual(summarizeActions(actions), {
    issues: 1,
    changedIssues: 1,
    bodyUpdates: 1,
    projectAdds: 1,
    projectUpdates: 0,
    labelRemovals: 1,
  })
})

test('is idempotent when body, Project status, and labels are already clean', () => {
  const targetBody = buildIssueBody({
    mapping: manifest.mappings[0],
    repository: 'owner/repo',
    baseBranch: 'master',
  })
  const actions = planCutover({
    manifest,
    issues: [{ number: 1, body: targetBody, labels: [{ name: 'priority:P1' }] }],
    projectItems: [{ number: 1, id: 'item-1', specStatus: 'Intake' }],
    repository: 'owner/repo',
    baseBranch: 'master',
  })

  assert.deepEqual(changedActions(actions), [])
  assert.equal(actions[0].project.operation, 'none')
})

test('plans an update when an existing Project item has the wrong status', () => {
  const actions = planCutover({
    manifest,
    issues: [{ number: 1, body: '', labels: [] }],
    projectItems: [{ number: 1, id: 'item-1', specStatus: 'Spec Draft' }],
    repository: 'owner/repo',
    baseBranch: 'master',
  })

  assert.equal(actions[0].project.operation, 'update')
})

test('rejects ambiguous or missing target statuses', () => {
  assert.throws(
    () =>
      planCutover({
        manifest: {
          ...manifest,
          targetSpecStatuses: {
            ...manifest.targetSpecStatuses,
            Done: [1],
          },
        },
        issues: [{ number: 1, body: '', labels: [] }],
        projectItems: [],
        repository: 'owner/repo',
        baseBranch: 'master',
      }),
    /multiple target Spec Status/,
  )

  assert.throws(
    () =>
      planCutover({
        manifest: {
          ...manifest,
          targetSpecStatuses: {
            Intake: [],
          },
        },
        issues: [{ number: 1, body: '', labels: [] }],
        projectItems: [],
        repository: 'owner/repo',
        baseBranch: 'master',
      }),
    /no target Spec Status/,
  )
})
