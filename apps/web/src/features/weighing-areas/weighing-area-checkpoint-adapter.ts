import type { Checkpoint } from '@/features/checkpoints/types'
import type { BulkLifecycleOutcome } from '@/features/checkpoints/ui/bulk-checkpoint-lifecycle-actions'
import type {
  BulkWeighingAreaLifecycleResult,
  WeighingAreaDto,
} from '@/features/weighing-areas/types'

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

export function toBulkLifecycleOutcome(
  result: BulkWeighingAreaLifecycleResult,
): BulkLifecycleOutcome {
  return {
    updatedCount: result.updatedWeighingAreas.length,
    blocked: result.blockedWeighingAreas,
  }
}
