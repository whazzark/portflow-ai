import {
  normalizeResourceSearch,
  presentResources,
  resourceMatchesSearch,
} from '@/components/resource-map/resource-map-search'
import type {
  Checkpoint,
  CheckpointLayerVisibility,
  CheckpointStatusFilter,
  PresentedCheckpoint,
} from '@/features/checkpoints/types'

export const normalizeCheckpointSearch = normalizeResourceSearch

export function isCheckpointSearchMatch(entity: Pick<Checkpoint, 'name'>, search: string) {
  return resourceMatchesSearch(entity, search)
}

export function presentCheckpoints(
  checkpoints: Checkpoint[],
  status: CheckpointStatusFilter,
  search: string,
  visibility?: CheckpointLayerVisibility,
): PresentedCheckpoint[] {
  return presentResources(
    checkpoints,
    status,
    search,
    (checkpoint) => !visibility || visibility[checkpoint.kind],
  ) as PresentedCheckpoint[]
}
