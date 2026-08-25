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

/** Shared between the `create`/`edit` search params and element id prefixes: both name a
 * checkpoint kind with the same two string values. */
export const CHECKPOINT_PARAM_BY_KIND: Record<CheckpointKind, 'dock' | 'weighing-area'> = {
  DOCK: 'dock',
  WEIGHING_AREA: 'weighing-area',
}

export const CHECKPOINT_STATUS_LABELS: Record<CheckpointStatus, string> = {
  AVAILABLE: 'Available',
  ARCHIVED: 'Archived',
}

export const CHECKPOINT_KIND_SINGULAR_LABELS: Record<CheckpointKind, string> = {
  DOCK: 'dock',
  WEIGHING_AREA: 'weighing area',
}

export const CHECKPOINT_KIND_PLURAL_LABELS: Record<CheckpointKind, string> = {
  DOCK: 'docks',
  WEIGHING_AREA: 'weighing areas',
}

export type BulkLifecycleIntent = 'ARCHIVE' | 'REACTIVATE'

/** Which bulk lifecycle operations each checkpoint kind supports. Weighing-area reactivation is
 * #206's, so it is deliberately absent until that slice ships. */
export const BULK_LIFECYCLE_INTENTS: Record<CheckpointKind, BulkLifecycleIntent[]> = {
  DOCK: ['ARCHIVE', 'REACTIVATE'],
  WEIGHING_AREA: ['ARCHIVE'],
}

/** The status a checkpoint must have to be eligible for a given bulk intent. */
export const STATUS_FOR_BULK_INTENT: Record<BulkLifecycleIntent, CheckpointStatus> = {
  ARCHIVE: 'AVAILABLE',
  REACTIVATE: 'ARCHIVED',
}

/** Only the dialog description genuinely varies by kind *and* intent — every other string in the
 * bulk toolbar and dialog is derived from the kind's labels plus the intent's verb, which is what
 * keeps the delivered dock wording byte-identical. */
export const BULK_LIFECYCLE_DESCRIPTIONS: Record<
  CheckpointKind,
  Partial<Record<BulkLifecycleIntent, string>>
> = {
  DOCK: {
    ARCHIVE: 'These docks will remain readable but no longer selectable for new discharges.',
    REACTIVATE: 'These docks will become selectable for new discharges again.',
  },
  WEIGHING_AREA: {
    ARCHIVE:
      'These weighing areas will remain readable but no longer offered for new operational work.',
  },
}
