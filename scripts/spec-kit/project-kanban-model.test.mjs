import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  orderedOpenIssues,
  targetKanbanStatus,
  targetSpecStatus,
  unrankedOpenIssues,
} from './project-kanban-model.mjs'

test('maps issue state and Spec Kit gates to the operational Kanban status', () => {
  assert.equal(targetKanbanStatus({ state: 'closed' }, 'Review'), 'Done')
  assert.equal(targetKanbanStatus({ state: 'open' }, 'Ready'), 'Ready')
  assert.equal(targetKanbanStatus({ state: 'open' }, 'In Progress'), 'In Progress')
  assert.equal(targetKanbanStatus({ state: 'open' }, 'Spec Review'), 'Review')
  assert.equal(targetKanbanStatus({ state: 'open' }, 'Plan Review'), 'Review')
  assert.equal(targetKanbanStatus({ state: 'open' }, 'Blocked'), 'Blocked')
  assert.equal(targetKanbanStatus({ state: 'open' }, 'Spec Draft'), 'Backlog')
  assert.equal(targetKanbanStatus({ state: 'open' }, 'Spec Draft', 'In Progress'), 'In Progress')
  assert.equal(targetKanbanStatus({ state: 'open' }, 'Ready', 'Blocked'), 'Blocked')
  assert.equal(targetKanbanStatus({ state: 'open' }, null), 'Backlog')
})

test('normalizes closed Spec Status values and defaults new open issues to Intake', () => {
  assert.equal(targetSpecStatus({ state: 'closed' }, 'Spec Draft'), 'Done')
  assert.equal(targetSpecStatus({ state: 'open' }, 'Spec Draft'), 'Spec Draft')
  assert.equal(targetSpecStatus({ state: 'open' }, null), 'Intake')
})

test('orders the operational critical path before administration and unqualified intake', () => {
  const issues = [118, 1, 102, 75, 82, 41, 111, 53].map((number) => ({
    number,
    state: 'open',
  }))

  assert.deepEqual(
    orderedOpenIssues(issues).map(({ number }) => number),
    [41, 102, 53, 82, 75, 111, 1, 118],
  )
  assert.deepEqual(unrankedOpenIssues(issues), [])
})

test('puts unknown future issues at the end while reporting them for qualification', () => {
  const issues = [
    { number: 999, state: 'open' },
    { number: 41, state: 'open' },
    { number: 998, state: 'closed' },
  ]

  assert.deepEqual(
    orderedOpenIssues(issues).map(({ number }) => number),
    [41, 999],
  )
  assert.deepEqual(
    unrankedOpenIssues(issues).map(({ number }) => number),
    [999],
  )
})
