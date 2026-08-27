import { useEffect, useState } from 'react'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import type { WarehouseDoorDto } from '@/features/warehouse-doors/types'
import type { WarehouseWithDoorsDto } from '@/features/warehouses/types'

export type WarehouseDoorEditSession = {
  /** The warehouse the session belongs to; it never outlives that selection. */
  warehouseId: string
  /** The door being corrected; the session is discarded when the selection changes identity. */
  doorId: string
  /** Snapshotted at session start — never re-derived from live query data. */
  editable: boolean
  /** What the door was called when this session started, not its live, refetchable name. */
  originName: string
  /** Where the door stood when this session started — what "Restore original position" restores. */
  origin: LatLng
}

/**
 * Owns the state behind "an administrator is part-way through correcting this door".
 *
 * Carries the three rules `useCheckpointEditSession` hardened after #199 and
 * `useWarehouseEditSession` re-applied, here for a point *and* a name:
 *
 * 1. A session is discarded whenever the selection it belongs to goes away or changes identity —
 *    there is no way to leave one armed for a door that is no longer the selected one.
 * 2. `editable`, `originName`, and `origin` are decided once, when the session opens, and never
 *    re-derived from live query data: a background refetch of another administrator's concurrent
 *    change must not silently end an in-progress edit, masquerade as this administrator's unsaved
 *    work, or become what cancelling restores.
 * 3. Nothing here lets a caller re-arm a session for a door that is not selected — `session` only
 *    ever reflects `requested` when it matches the live selection.
 *
 * `editable` differs from its two siblings in depending on **two** entities: a door is correctable
 * only while both it and its containing warehouse are available.
 */
export function useWarehouseDoorEditSession(input: {
  requested: boolean
  warehouse: WarehouseWithDoorsDto | undefined
  door: WarehouseDoorDto | undefined
}) {
  const { requested, warehouse, door } = input
  const [session, setSession] = useState<WarehouseDoorEditSession | null>(null)
  const [draft, setDraft] = useState<LatLng | null>(null)

  useEffect(() => {
    if (!requested || !warehouse || !door) {
      if (session) {
        setSession(null)
        setDraft(null)
      }
      return
    }

    if (!session || session.doorId !== door.id || session.warehouseId !== warehouse.id) {
      const origin = { latitude: door.latitude, longitude: door.longitude }
      setSession({
        warehouseId: warehouse.id,
        doorId: door.id,
        editable: door.status === 'AVAILABLE' && warehouse.status === 'AVAILABLE',
        originName: door.name,
        origin,
      })
      setDraft(origin)
    }
  }, [requested, warehouse, door, session])

  const isEditing =
    requested &&
    session !== null &&
    warehouse !== undefined &&
    door !== undefined &&
    session.doorId === door.id &&
    session.warehouseId === warehouse.id &&
    session.editable

  const restoreOrigin = () => {
    if (session) {
      setDraft(session.origin)
    }
  }

  const clear = () => {
    setSession(null)
    setDraft(null)
  }

  return { isEditing, session, draft, setDraft, restoreOrigin, clear }
}
