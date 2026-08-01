import type { Checkpoint } from '@/features/checkpoints/types'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'

export function toWeighingAreaCheckpoint(area: WeighingAreaDto): Checkpoint {
  return {
    id: area.id,
    kind: 'WEIGHING_AREA',
    latitude: area.latitude,
    longitude: area.longitude,
    name: area.name,
    status: area.status,
  }
}
