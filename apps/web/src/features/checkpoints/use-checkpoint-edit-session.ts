import { useEffect, useState } from 'react'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import type { CheckpointKind, CheckpointStatus } from '@/features/checkpoints/types'

export type EditableCheckpoint = {
  kind: CheckpointKind
  id: string
  latitude: number
  longitude: number
  status: CheckpointStatus
}

export type CheckpointEditSession = {
  kind: CheckpointKind
  id: string
  /** Snapshotted at session start — never re-derived from live query data. */
  editable: boolean
  /** Where the checkpoint stood when this session started — not its live, refetchable position. */
  origin: LatLng
}

/**
 * Owns the state behind "an administrator is part-way through correcting this checkpoint",
 * generalized across every checkpoint kind. Carries forward three rules hardened after review of
 * #199, now required for every kind rather than just docks:
 *
 * 1. A session is discarded whenever the selection it belongs to goes away, changes identity, or
 *    changes kind — there is no way to leave a session armed for a checkpoint that is no longer
 *    the one selected.
 * 2. `editable` and `origin` are decided once, when the session opens, and never re-derived from
 *    live query data: a background refetch of another administrator's concurrent move must not
 *    silently end an in-progress edit, masquerade as this administrator's unsaved change, or
 *    become what "restore original position" restores.
 * 3. The hook exposes nothing that lets a caller re-arm a session for a mismatched kind — `session`
 *    only ever reflects `requestedKind` when it matches the live selection's kind.
 */
export function useCheckpointEditSession(input: {
  requestedKind: CheckpointKind | null
  selected: EditableCheckpoint | undefined
}) {
  const { requestedKind, selected } = input
  const [session, setSession] = useState<CheckpointEditSession | null>(null)
  const [draft, setDraft] = useState<LatLng | null>(null)

  useEffect(() => {
    if (!requestedKind || !selected || selected.kind !== requestedKind) {
      if (session) {
        setSession(null)
        setDraft(null)
      }
      return
    }
    if (!session || session.id !== selected.id || session.kind !== selected.kind) {
      const origin = { latitude: selected.latitude, longitude: selected.longitude }
      setSession({
        kind: selected.kind,
        id: selected.id,
        editable: selected.status === 'AVAILABLE',
        origin,
      })
      setDraft(origin)
    }
  }, [requestedKind, selected, session])

  const isEditing =
    requestedKind !== null &&
    session !== null &&
    selected !== undefined &&
    session.id === selected.id &&
    session.kind === selected.kind &&
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

  return {
    isEditing,
    session,
    draft,
    setDraft,
    restoreOrigin,
    clear,
  }
}
