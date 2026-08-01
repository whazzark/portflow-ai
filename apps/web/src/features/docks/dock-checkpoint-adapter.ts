import type { Checkpoint } from '@/features/checkpoints/types'
import type { DockDto } from '@/features/docks/types'

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
