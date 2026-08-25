import { useEffect, useState } from 'react'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import type { WarehouseDto } from '@/features/warehouses/types'

export type WarehouseEditSession = {
  /** The warehouse this session belongs to; it never outlives that selection. */
  warehouseId: string
  /** Snapshotted at session start — never re-derived from live query data. */
  editable: boolean
  /** What the warehouse was called when this session started, not its live, refetchable name. */
  originName: string
  /** Where the outline stood when this session started, not its live, refetchable shape. */
  originPoints: LatLng[]
}

/**
 * Owns the state behind "an administrator is part-way through correcting this warehouse".
 *
 * Carries the three rules `useCheckpointEditSession` hardened after #199, applied here to a ring
 * rather than to a single point:
 *
 * 1. A session is discarded whenever the selection it belongs to goes away or changes identity —
 *    there is no way to leave one armed for a warehouse that is no longer the selected one.
 * 2. `editable`, `originName`, and `originPoints` are decided once, when the session opens, and
 *    never re-derived from live query data: a background refetch of another administrator's
 *    concurrent change must not silently end an in-progress edit, masquerade as this
 *    administrator's unsaved work, or become what cancelling restores.
 * 3. Nothing here lets a caller re-arm a session for a warehouse that is not selected — `session`
 *    only ever reflects `requested` when it matches the live selection.
 */
export function useWarehouseEditSession(input: {
  requested: boolean
  selected: WarehouseDto | undefined
}) {
  const { requested, selected } = input
  const [session, setSession] = useState<WarehouseEditSession | null>(null)
  const [draftPoints, setDraftPoints] = useState<LatLng[]>([])

  useEffect(() => {
    if (!requested || !selected) {
      if (session) {
        setSession(null)
        setDraftPoints([])
      }
      return
    }

    if (!session || session.warehouseId !== selected.id) {
      const originPoints = selected.footprint.points.map((point) => ({ ...point }))
      setSession({
        warehouseId: selected.id,
        editable: selected.status === 'AVAILABLE',
        originName: selected.name,
        originPoints,
      })
      setDraftPoints(originPoints)
    }
  }, [requested, selected, session])

  const isEditing =
    requested &&
    session !== null &&
    selected !== undefined &&
    session.warehouseId === selected.id &&
    session.editable

  const movePoint = (index: number, point: LatLng) =>
    setDraftPoints((current) =>
      current.map((existing, position) => (position === index ? point : existing)),
    )

  /** `index` is the position the new point takes in the resulting ring, never an arbitrary end. */
  const insertPoint = (index: number, point: LatLng) =>
    setDraftPoints((current) => [...current.slice(0, index), point, ...current.slice(index)])

  const removePoint = (index: number) =>
    setDraftPoints((current) => current.filter((_, position) => position !== index))

  const restoreOrigin = () => {
    if (session) {
      setDraftPoints(session.originPoints)
    }
  }

  const clear = () => {
    setSession(null)
    setDraftPoints([])
  }

  return {
    isEditing,
    session,
    draftPoints,
    movePoint,
    insertPoint,
    removePoint,
    restoreOrigin,
    clear,
  }
}
