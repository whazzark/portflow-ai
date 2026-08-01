import type {
  Checkpoint,
  CheckpointLayerVisibility,
  CheckpointStatusFilter,
  PresentedCheckpoint,
} from '@/features/checkpoints/types'

export function normalizeCheckpointSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase()
}

export function isCheckpointSearchMatch(entity: Pick<Checkpoint, 'name'>, search: string) {
  const normalizedSearch = normalizeCheckpointSearch(search)
  return (
    normalizedSearch.length === 0 ||
    normalizeCheckpointSearch(entity.name).includes(normalizedSearch)
  )
}

export function presentCheckpoints(
  checkpoints: Checkpoint[],
  status: CheckpointStatusFilter,
  search: string,
  visibility?: CheckpointLayerVisibility,
): PresentedCheckpoint[] {
  const expectedStatus = status === 'all' ? undefined : status.toUpperCase()

  return checkpoints
    .filter(
      (checkpoint) =>
        (!visibility || visibility[checkpoint.kind]) &&
        (!expectedStatus || checkpoint.status === expectedStatus),
    )
    .map((checkpoint) => ({
      ...checkpoint,
      isSearchMatch: isCheckpointSearchMatch(checkpoint, search),
    }))
}
