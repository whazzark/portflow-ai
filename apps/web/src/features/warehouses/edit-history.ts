import type { LatLng } from '@/components/resource-map/resource-map-placement'

const HISTORY_LIMIT = 50

export type EditHistory = {
  draft: LatLng[]
  /** Previous drafts, most recent last. */
  past: LatLng[][]
  /** Where the outline stood when editing started; `restore` returns to it. */
  origin: LatLng[]
  /** The point a run of typed coordinates is changing, so the run is one Undo step, not one per
   * keystroke. Any other change ends the run. */
  typingIndex?: number
}

export type EditHistoryAction =
  | { type: 'move'; index: number; point: LatLng }
  | { type: 'type'; index: number; point: LatLng }
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
  typingIndex: undefined,
})

const moveIn = (draft: LatLng[], index: number, point: LatLng) =>
  draft.map((existing, position) => (position === index ? point : existing))

/** Every change to the outline is one step back for Undo, restoring the origin included. */
export function editHistoryReducer(history: EditHistory, action: EditHistoryAction): EditHistory {
  switch (action.type) {
    case 'move':
      return record(history, moveIn(history.draft, action.index, action.point))
    case 'type':
      return history.typingIndex === action.index
        ? { ...history, draft: moveIn(history.draft, action.index, action.point) }
        : {
            ...record(history, moveIn(history.draft, action.index, action.point)),
            typingIndex: action.index,
          }
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
      return previous
        ? { ...history, draft: previous, past: history.past.slice(0, -1), typingIndex: undefined }
        : history
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
