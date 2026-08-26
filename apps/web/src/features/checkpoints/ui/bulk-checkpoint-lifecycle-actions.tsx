import {
  type BulkLifecycleBlocker,
  type BulkLifecycleOutcome,
  BulkResourceLifecycleActions,
} from '@/components/lifecycle/bulk-resource-lifecycle-actions'
import { ACTION_BY_BULK_INTENT } from '@/components/lifecycle/lifecycle-copy'
import {
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
 * Resolves a checkpoint kind into the nouns the shared bulk action bar needs. The bar itself lives
 * in `components/lifecycle` so every site reference meets the same interaction model and the same
 * wording; this wrapper only translates the page's own intent vocabulary.
 */
export function BulkCheckpointLifecycleActions({
  kind,
  intent,
  ...rest
}: BulkCheckpointLifecycleActionsProps) {
  return (
    <BulkResourceLifecycleActions
      {...rest}
      action={ACTION_BY_BULK_INTENT[intent]}
      idPrefix={CHECKPOINT_PARAM_BY_KIND[kind]}
      plural={CHECKPOINT_KIND_PLURAL_LABELS[kind]}
      singular={CHECKPOINT_KIND_SINGULAR_LABELS[kind]}
    />
  )
}
