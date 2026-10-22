import type { LatLng } from '@/components/resource-map/resource-map-placement'

const HISTORY_LIMIT = 50

export type EditHistory = {
  draft: LatLng[]
  /** Previous drafts, most recent last. */
  past: LatLng[][]
  /** Where the outline stood when editing started; `restore` returns to it. */
  origin: LatLng[]
}

export type EditHistoryAction =
  | { type: 'move'; index: number; point: LatLng }
  | { type: 'insert'; index: number; point: LatLng }
  | { type: 'remove'; index: number }
  | { type: 'restore' }
  | { type: 'undo' }

export function startEditHistory(origin: LatLng[]): EditHistory {
  return { draft: origin, past: [], origin }
}

const record = (history: EditHistory, draft: LatLng[]): EditHistory => ({
  ...history,
  draft,
  past: [...history.past, history.draft].slice(-HISTORY_LIMIT),
})

/** Every change to the outline is one step back for Undo, restoring the origin included. */
export function editHistoryReducer(history: EditHistory, action: EditHistoryAction): EditHistory {
  switch (action.type) {
    case 'move':
      return record(
        history,
        history.draft.map((existing, position) =>
          position === action.index ? action.point : existing,
        ),
      )
    case 'insert':
      return record(history, [
        ...history.draft.slice(0, action.index),
        action.point,
        ...history.draft.slice(action.index),
      ])
    case 'remove':
      return record(
        history,
        history.draft.filter((_, position) => position !== action.index),
      )
    case 'restore':
      return record(history, history.origin)
    case 'undo': {
      const previous = history.past.at(-1)
      return previous ? { ...history, draft: previous, past: history.past.slice(0, -1) } : history
    }
  }
}

const samePoint = (a: LatLng, b: LatLng) => a.latitude === b.latitude && a.longitude === b.longitude

/** How many points differ from the origin: moved and inserted points in the draft, plus origin
 * points that no longer appear in it. */
export function countMovedPoints(origin: LatLng[], draft: LatLng[]) {
  const changed = draft.filter((point) => !origin.some((existing) => samePoint(existing, point)))
  const removed = origin.filter((point) => !draft.some((existing) => samePoint(existing, point)))

  return Math.max(changed.length, removed.length)
}
