import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { ProjectSimplifier, planProjectSimplification } from './simplify-project-kanban.mjs'

const canonicalStatus = {
  id: 'STATUS',
  name: 'Status',
  options: ['Backlog', 'Ready', 'In Progress', 'Review', 'Blocked', 'Done'].map((name, index) => ({
    id: String(index),
    name,
  })),
}

test('plans only deletion of the duplicate Spec Status field', () => {
  const plan = planProjectSimplification([
    canonicalStatus,
    {
      id: 'SPEC',
      name: 'Spec Status',
      options: [{ id: 'draft', name: 'Spec Draft' }],
    },
  ])
  assert.deepEqual(plan.actions, [{ type: 'delete-field', field: 'Spec Status', id: 'SPEC' }])
  assert.deepEqual(plan.statusField.options, [
    'Backlog',
    'Ready',
    'In Progress',
    'Review',
    'Blocked',
    'Done',
  ])
})

test('is idempotent after Spec Status has been removed', () => {
  assert.deepEqual(planProjectSimplification([canonicalStatus]).actions, [])
})

test('refuses to delete fields while canonical Status options drift', () => {
  assert.throws(() =>
    planProjectSimplification([
      {
        ...canonicalStatus,
        options: canonicalStatus.options.filter((option) => option.name !== 'Blocked'),
      },
      { id: 'SPEC', name: 'Spec Status', options: [] },
    ]),
  )
})

test('backs up Project item field values before deleting Spec Status', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portflow-project-simplify-'))
  const calls = []
  const responses = [
    { nameWithOwner: 'portflow/repository' },
    { projects: [{ id: 'PROJECT', number: 1 }] },
    {
      fields: [
        canonicalStatus,
        { id: 'SPEC', name: 'Spec Status', options: [{ id: 'draft', name: 'Spec Draft' }] },
      ],
    },
    {
      items: [
        {
          id: 'ITEM',
          content: { number: 123 },
          'Spec Status': 'Plan Ready',
          Status: 'Review',
        },
      ],
    },
  ]
  const simplifier = new ProjectSimplifier({
    root,
    projectNumber: 1,
    exec(command, args) {
      calls.push([command, args])
      if (command === 'gh' && args[1] === 'field-delete') {
        return ''
      }
      return JSON.stringify(responses.shift())
    },
  })
  const inspection = simplifier.inspect()
  const backup = simplifier.apply(inspection)
  const saved = JSON.parse(fs.readFileSync(backup, 'utf8'))
  assert.equal(saved.items.items[0]['Spec Status'], 'Plan Ready')
  assert.deepEqual(calls.at(-1), ['gh', ['project', 'field-delete', '--id', 'SPEC']])
  fs.rmSync(root, { recursive: true, force: true })
})
