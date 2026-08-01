export const CHECKPOINT_KINDS = ['DOCK', 'WEIGHING_AREA'] as const
export type CheckpointKind = (typeof CHECKPOINT_KINDS)[number]

export const CHECKPOINT_STATUSES = ['AVAILABLE', 'ARCHIVED'] as const
export type CheckpointStatus = (typeof CHECKPOINT_STATUSES)[number]

export type Checkpoint = {
  id: string
  kind: CheckpointKind
  latitude: number
  longitude: number
  name: string
  status: CheckpointStatus
}

export type PresentedCheckpoint = Checkpoint & {
  isSearchMatch: boolean
}

export type CheckpointStatusFilter = 'all' | 'available' | 'archived'
export type CheckpointLayerVisibility = Record<CheckpointKind, boolean>
export type CheckpointKindFilter = 'dock' | 'weighing-area'

export const DEFAULT_CHECKPOINT_LAYER_VISIBILITY: CheckpointLayerVisibility = {
  DOCK: true,
  WEIGHING_AREA: true,
}

export function checkpointLayerVisibilityFromFilter(
  filter: CheckpointKindFilter | string | undefined,
): CheckpointLayerVisibility {
  if (filter === 'dock') {
    return { DOCK: true, WEIGHING_AREA: false }
  }

  if (filter === 'weighing-area') {
    return { DOCK: false, WEIGHING_AREA: true }
  }

  return {
    ...DEFAULT_CHECKPOINT_LAYER_VISIBILITY,
  }
}

export function checkpointKindFilterFromVisibility(
  visibility: CheckpointLayerVisibility,
): CheckpointKindFilter | undefined {
  if (visibility.DOCK && visibility.WEIGHING_AREA) {
    return undefined
  }

  return visibility.DOCK ? 'dock' : 'weighing-area'
}

export const CHECKPOINT_KIND_LABELS: Record<CheckpointKind, string> = {
  DOCK: 'Dock',
  WEIGHING_AREA: 'Weighing area',
}

export const CHECKPOINT_STATUS_LABELS: Record<CheckpointStatus, string> = {
  AVAILABLE: 'Available',
  ARCHIVED: 'Archived',
}
