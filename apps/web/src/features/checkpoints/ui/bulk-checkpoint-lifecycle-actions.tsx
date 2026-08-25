import {
  type BulkLifecycleBlocker,
  type BulkLifecycleOutcome,
  BulkResourceLifecycleActions,
} from '@/components/resource-map/bulk-resource-lifecycle-actions'
import {
  BULK_LIFECYCLE_DESCRIPTIONS,
  type BulkLifecycleIntent,
  CHECKPOINT_KIND_PLURAL_LABELS,
  CHECKPOINT_KIND_SINGULAR_LABELS,
  CHECKPOINT_PARAM_BY_KIND,
  type CheckpointKind,
} from '@/features/checkpoints/types'

export type { BulkLifecycleBlocker, BulkLifecycleOutcome }

type BulkCheckpointLifecycleActionsProps = {
  /** Which checkpoint kind this instance acts on — drives every label and the request it sends. */
  kind: CheckpointKind
  /** Which lifecycle transition the current selection is for. */
  intent: BulkLifecycleIntent
  selectedIds: string[]
  onClear: () => void
  onSuccess: (outcome: BulkLifecycleOutcome) => void
  submit: (input: { ids: string[]; comment: string | null }) => Promise<BulkLifecycleOutcome>
  refresh: () => void | Promise<void>
}

/**
 * Resolves a checkpoint kind into the labels the shared bulk action bar needs. The bar itself lives
 * in `components/resource-map` so warehouses meet the same interaction model instead of a second
 * one; this wrapper is what keeps every delivered dock and weighing-area string unchanged.
 */
export function BulkCheckpointLifecycleActions({
  kind,
  intent,
  ...rest
}: BulkCheckpointLifecycleActionsProps) {
  return (
    <BulkResourceLifecycleActions
      {...rest}
      description={BULK_LIFECYCLE_DESCRIPTIONS[kind][intent] ?? ''}
      idPrefix={CHECKPOINT_PARAM_BY_KIND[kind]}
      intent={intent}
      plural={CHECKPOINT_KIND_PLURAL_LABELS[kind]}
      singular={CHECKPOINT_KIND_SINGULAR_LABELS[kind]}
    />
  )
}
