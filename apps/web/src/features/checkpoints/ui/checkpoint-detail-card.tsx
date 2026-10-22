import { CopyIcon, InfoIcon, PencilIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  describeLifecycleEffect,
  type LifecycleAction,
  lifecycleDialogTitle,
  lifecycleSuccessMessage,
} from '@/components/lifecycle/lifecycle-copy'
import type { ResourceLifecycleConfig } from '@/components/lifecycle/resource-lifecycle-actions'
import { ResourceLifecycleSummary } from '@/components/lifecycle/resource-lifecycle-summary'
import type { ResourceMapAnchor } from '@/components/resource-map/resource-map-anchor'
import { ResourceMapCard } from '@/components/resource-map/resource-map-card'
import { Button } from '@/components/ui/button'
import { StatusIndicator } from '@/components/ui/status-indicator'
import type { CheckpointSelection } from '@/features/checkpoints/checkpoint-selection'
import { CHECKPOINT_KIND_LABELS, CHECKPOINT_STATUS_LABELS } from '@/features/checkpoints/types'
import { DockLifecycleActions, dockLifecycleBlocks } from '@/features/docks/dock-lifecycle'
import type { DockDto } from '@/features/docks/types'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'
import {
  WeighingAreaLifecycleActions,
  weighingAreaLifecycleBlocks,
} from '@/features/weighing-areas/weighing-area-lifecycle'
import { formatDateTime } from '@/helpers/dates'

export type SelectedCheckpoint =
  | { selection: CheckpointSelection & { kind: 'DOCK' }; resource: DockDto }
  | { selection: CheckpointSelection & { kind: 'WEIGHING_AREA' }; resource: WeighingAreaDto }
  | undefined

/** Coordinates as the card shows and copies them: latitude first, four decimals (~11 m). */
export function formatCheckpointCoordinates({
  latitude,
  longitude,
}: {
  latitude: number
  longitude: number
}) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
}

/**
 * The Checkpoints map's archive wording: the confirmation names the checkpoint and says what
 * archiving means for discharges, and the success toast offers to open it under Archived.
 * Reactivation keeps the canonical copy.
 */
function checkpointLifecycleCopy(
  noun: string,
  name: string,
  onView: () => void,
): Pick<
  ResourceLifecycleConfig,
  'describeTitle' | 'describeEffect' | 'describeSuccess' | 'successToast'
> {
  const isArchive = (action: LifecycleAction) => action === 'archive'

  return {
    describeTitle: (action) =>
      isArchive(action) ? `Archive ${name}?` : lifecycleDialogTitle(action, noun),
    describeEffect: (action) =>
      isArchive(action)
        ? `The ${noun} can no longer be selected for new discharges. Past discharges keep it. You can reactivate it later from Archived.`
        : describeLifecycleEffect(action, name),
    describeSuccess: (action) =>
      isArchive(action) ? `${name} archived` : lifecycleSuccessMessage(action, noun, name),
    successToast: (action) =>
      isArchive(action)
        ? {
            description: 'Find it under Archived to reactivate it.',
            action: { label: 'View', onClick: onView },
          }
        : undefined,
  }
}

/** The selected checkpoint's card: where it is, what state it is in, and what can be done to it. */
export function CheckpointDetailCard({
  checkpoint,
  anchor,
  canManage,
  onEdit,
  onClose,
  onView,
}: {
  checkpoint: NonNullable<SelectedCheckpoint>
  anchor: ResourceMapAnchor | null
  canManage: boolean
  onEdit: () => void
  onClose: () => void
  /** Opens this checkpoint where its status now lists it — the toast's View after an archive. */
  onView: () => void
}) {
  const { resource, selection } = checkpoint
  const coordinates = formatCheckpointCoordinates(resource)
  const isArchived = resource.status === 'ARCHIVED'
  const copy = checkpointLifecycleCopy(
    CHECKPOINT_KIND_LABELS[selection.kind].toLowerCase(),
    resource.name,
    onView,
  )
  const lifecycleBlocks =
    checkpoint.selection.kind === 'DOCK'
      ? dockLifecycleBlocks(checkpoint.resource)
      : weighingAreaLifecycleBlocks(checkpoint.resource)

  const copyCoordinates = async () => {
    try {
      await navigator.clipboard.writeText(coordinates)
      toast.success('Coordinates copied')
    } catch {
      toast.error('Unable to copy coordinates')
    }
  }

  return (
    <ResourceMapCard
      anchor={anchor}
      footer={
        canManage ? (
          <>
            {!isArchived && (
              <Button onClick={onEdit} size="sm" type="button" variant="outline">
                <PencilIcon aria-hidden="true" />
                Edit
              </Button>
            )}
            {checkpoint.selection.kind === 'DOCK' ? (
              <DockLifecycleActions className="ml-auto" copy={copy} dock={checkpoint.resource} />
            ) : (
              <WeighingAreaLifecycleActions
                area={checkpoint.resource}
                className="ml-auto"
                copy={copy}
              />
            )}
          </>
        ) : undefined
      }
      onClose={onClose}
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <span>{CHECKPOINT_KIND_LABELS[selection.kind]}</span> <span aria-hidden="true">·</span>{' '}
          <StatusIndicator
            label={CHECKPOINT_STATUS_LABELS[resource.status]}
            variant={isArchived ? 'neutral' : 'success'}
          />
        </span>
      }
      title={resource.name}
    >
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">GPS location</span>
          <div className="flex items-center gap-2">
            <span className="font-mono tabular-nums">{coordinates}</span>
            <Button
              aria-label="Copy coordinates"
              onClick={() => void copyCoordinates()}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <CopyIcon aria-hidden="true" />
            </Button>
          </div>
        </div>
        {isArchived ? (
          <p className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground">
            <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              Archived on {formatDateTime(resource.archivedAt)}. It can’t be selected for new
              discharges; past discharges keep it.
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Updated {formatDateTime(resource.updatedAt)} · created{' '}
            {formatDateTime(resource.createdAt)}
          </p>
        )}
        <ResourceLifecycleSummary blocks={lifecycleBlocks} />
      </div>
    </ResourceMapCard>
  )
}
