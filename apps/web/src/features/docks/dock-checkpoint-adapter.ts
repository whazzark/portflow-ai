import type { Checkpoint } from '@/features/checkpoints/types'
import type { BulkLifecycleOutcome } from '@/features/checkpoints/ui/bulk-checkpoint-lifecycle-actions'
import type { BulkDockLifecycleResult, DockDto } from '@/features/docks/types'

export function toDockCheckpoint(dock: DockDto): Checkpoint {
  return {
    id: dock.id,
    kind: 'DOCK',
    latitude: dock.latitude,
    longitude: dock.longitude,
    name: dock.name,
    status: dock.status,
  }
}

/** Normalizes a dock bulk archive *or* reactivate response — both share this shape — onto the
 * outcome the shared checkpoint toolbar renders. */
export function toBulkLifecycleOutcome(result: BulkDockLifecycleResult): BulkLifecycleOutcome {
  return {
    updatedCount: result.updatedDocks.length,
    blocked: result.blockedDocks,
  }
}
