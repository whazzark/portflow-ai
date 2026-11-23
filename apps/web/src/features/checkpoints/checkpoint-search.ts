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

/**
 * What a search leaves of the checkpoints the type and status filters already admit: the matches,
 * which are all the map shows while a search is active, and the total they are counted against.
 */
export function searchCheckpoints(checkpoints: PresentedCheckpoint[], search: string) {
  return {
    matches:
      normalizeCheckpointSearch(search).length === 0
        ? checkpoints
        : checkpoints.filter((checkpoint) => checkpoint.isSearchMatch),
    total: checkpoints.length,
  }
}
