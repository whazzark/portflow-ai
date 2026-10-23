import { describe, expect, test } from 'vitest'
import {
  countMovedPoints,
  type EditHistory,
  editHistoryReducer,
  startEditHistory,
} from '@/features/warehouses/edit-history'

const origin = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 1 },
  { latitude: 1, longitude: 1 },
]

describe('edit history', () => {
  test('starts on the origin with nothing to undo', () => {
    const history = startEditHistory(origin)

    expect(history.draft).toEqual(origin)
    expect(history.past).toEqual([])
  })

  test('records every change and undoes them one at a time', () => {
    let history: EditHistory = startEditHistory(origin)
    history = editHistoryReducer(history, {
      type: 'move',
      index: 0,
      point: { latitude: 0.5, longitude: 0 },
    })
    history = editHistoryReducer(history, {
      type: 'insert',
      index: 1,
      point: { latitude: 0, longitude: 0.5 },
    })
    history = editHistoryReducer(history, { type: 'remove', index: 3 })

    expect(history.draft).toHaveLength(3)

    history = editHistoryReducer(history, { type: 'undo' })
    expect(history.draft).toHaveLength(4)
    history = editHistoryReducer(history, { type: 'undo' })
    expect(history.draft).toEqual([{ latitude: 0.5, longitude: 0 }, ...origin.slice(1)])
    history = editHistoryReducer(history, { type: 'undo' })
    expect(history.draft).toEqual(origin)
  })

  test('makes a run of typed coordinates on one point a single step', () => {
    let history = startEditHistory(origin)
    for (const latitude of [0.1, 0.12, 0.123]) {
      history = editHistoryReducer(history, {
        type: 'type',
        index: 0,
        point: { latitude, longitude: 0 },
      })
    }
    expect(history.past).toHaveLength(1)

    // Another point, or any other change, starts a new step.
    history = editHistoryReducer(history, {
      type: 'type',
      index: 1,
      point: { latitude: 0.5, longitude: 1 },
    })
    expect(history.past).toHaveLength(2)

    history = editHistoryReducer(history, { type: 'undo' })
    history = editHistoryReducer(history, { type: 'undo' })
    expect(history.draft).toEqual(origin)
  })

  test('ignores an undo with nothing to undo', () => {
    const history = startEditHistory(origin)

    expect(editHistoryReducer(history, { type: 'undo' })).toBe(history)
  })

  test('restores the origin as one undoable change', () => {
    let history = editHistoryReducer(startEditHistory(origin), {
      type: 'move',
      index: 2,
      point: { latitude: 2, longitude: 2 },
    })
    history = editHistoryReducer(history, { type: 'restore' })

    expect(history.draft).toEqual(origin)
    expect(editHistoryReducer(history, { type: 'undo' }).draft[2]).toEqual({
      latitude: 2,
      longitude: 2,
    })
  })

  test('keeps at most fifty steps', () => {
    let history = startEditHistory(origin)
    for (let step = 0; step < 60; step += 1) {
      history = editHistoryReducer(history, {
        type: 'move',
        index: 0,
        point: { latitude: step, longitude: 0 },
      })
    }

    expect(history.past).toHaveLength(50)
  })

  test('counts moved, removed and inserted points against the origin', () => {
    expect(countMovedPoints(origin, origin)).toBe(0)
    expect(countMovedPoints(origin, [{ latitude: 0.5, longitude: 0 }, origin[1], origin[2]])).toBe(
      1,
    )
    expect(countMovedPoints(origin, [origin[0], origin[1]])).toBe(1)
    expect(
      countMovedPoints(origin, [origin[0], { latitude: 0, longitude: 0.5 }, origin[1], origin[2]]),
    ).toBe(1)
  })
})
