import { AnchorIcon, ArchiveIcon, ScaleIcon } from 'lucide-react'
import {
  ResourceLegend,
  ResourceLegendStatusSymbol,
} from '@/components/resource-map/resource-legend'
import { MapMarker, MarkerContent, MarkerTooltip } from '@/components/ui/map'
import {
  CHECKPOINT_KIND_LABELS,
  CHECKPOINT_STATUS_LABELS,
  CHECKPOINT_STATUSES,
  type CheckpointKind,
  type CheckpointStatus,
  type PresentedCheckpoint,
} from '@/features/checkpoints/types'
import { classnames } from '@/libraries/shadcn/helpers'

const checkpointIcons: Record<CheckpointKind, typeof AnchorIcon> = {
  DOCK: AnchorIcon,
  WEIGHING_AREA: ScaleIcon,
}

const checkpointKindStyles: Record<
  CheckpointKind,
  { shape: string; available: string; archived: string }
> = {
  DOCK: {
    shape: 'rounded-full',
    available: 'border-background bg-primary text-primary-foreground',
    archived: 'border-muted-foreground border-dashed bg-background/95 text-muted-foreground',
  },
  WEIGHING_AREA: {
    shape: 'rounded-full',
    available: 'border-primary bg-background/95 text-primary',
    archived: 'border-muted-foreground border-dashed bg-background/95 text-muted-foreground',
  },
}

export function CheckpointKindIcon({
  className,
  kind,
}: {
  className?: string
  kind: CheckpointKind
}) {
  const Icon = checkpointIcons[kind]

  return (
    <Icon
      aria-hidden="true"
      className={classnames('size-4', className)}
      data-checkpoint-kind-icon={kind}
    />
  )
}

export function CheckpointMarkerSymbol({
  compact = false,
  kind,
  status,
}: {
  compact?: boolean
  kind: CheckpointKind
  status: CheckpointStatus
}) {
  const Icon = checkpointIcons[kind]
  const kindStyles = checkpointKindStyles[kind]
  const isArchived = status === 'ARCHIVED'

  return (
    <span
      aria-hidden="true"
      className={classnames(
        'relative grid shrink-0 place-items-center border-2 transition-colors duration-200 motion-reduce:transition-none',
        kindStyles.shape,
        compact ? 'size-6 shadow-sm' : 'size-[30px] shadow-md',
        isArchived ? kindStyles.archived : kindStyles.available,
      )}
      data-checkpoint-kind={kind}
      data-checkpoint-status={status}
    >
      <Icon className={compact ? 'size-3' : 'size-3.5'} />
      {isArchived && (
        <span
          className={classnames(
            'absolute -right-1 -bottom-1 grid place-items-center rounded-full border border-background bg-muted text-muted-foreground',
            compact ? 'size-3.5' : 'size-4',
          )}
          data-archive-badge
        >
          <ArchiveIcon className={compact ? 'size-2' : 'size-2.5'} />
        </span>
      )}
    </span>
  )
}

export function CheckpointMarkerTooltipContent({
  kind,
  name,
  status,
}: {
  kind: CheckpointKind
  name: string
  status: CheckpointStatus
}) {
  return (
    <span className="grid gap-0.5 whitespace-nowrap">
      <span className="font-medium">{name}</span>
      <span className="flex items-center gap-1.5 text-[10px] opacity-80">
        <span>{CHECKPOINT_KIND_LABELS[kind]}</span>
        <span aria-hidden="true">·</span>
        <span data-checkpoint-status-label>{CHECKPOINT_STATUS_LABELS[status]}</span>
      </span>
    </span>
  )
}

export function CheckpointMarker({
  checkpoint,
  offset,
  onSelect,
  muted = false,
}: {
  checkpoint: PresentedCheckpoint
  offset?: [number, number]
  onSelect: (checkpoint: PresentedCheckpoint) => void
  /** Dims the marker further, e.g. while dock placement mode is armed, to keep focus on the pending marker. */
  muted?: boolean
}) {
  const kindLabel = CHECKPOINT_KIND_LABELS[checkpoint.kind]
  const statusLabel = CHECKPOINT_STATUS_LABELS[checkpoint.status]

  return (
    <MapMarker latitude={checkpoint.latitude} longitude={checkpoint.longitude} offset={offset}>
      <MarkerContent>
        <button
          aria-label={`View ${kindLabel.toLowerCase()} ${checkpoint.name} (${statusLabel})`}
          className={classnames(
            'grid size-11 cursor-pointer place-items-center rounded-full transition-[opacity,transform,filter] duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none',
            muted
              ? 'scale-75 opacity-50'
              : checkpoint.isSearchMatch
                ? 'scale-110 opacity-100'
                : 'scale-75 opacity-35',
          )}
          data-checkpoint-kind={checkpoint.kind}
          data-search-match={checkpoint.isSearchMatch}
          data-status={checkpoint.status}
          onClick={() => onSelect(checkpoint)}
          title={`${checkpoint.name} — ${kindLabel} — ${statusLabel}`}
          type="button"
        >
          <CheckpointMarkerSymbol kind={checkpoint.kind} status={checkpoint.status} />
        </button>
      </MarkerContent>
      <MarkerTooltip>
        <CheckpointMarkerTooltipContent
          kind={checkpoint.kind}
          name={checkpoint.name}
          status={checkpoint.status}
        />
      </MarkerTooltip>
    </MapMarker>
  )
}

function CheckpointLegendKindSymbol({ kind }: { kind: CheckpointKind }) {
  const kindStyles = checkpointKindStyles[kind]

  return (
    <span
      aria-hidden="true"
      className={classnames(
        'grid size-6 shrink-0 place-items-center border-2',
        kindStyles.shape,
        kindStyles.available,
      )}
      data-checkpoint-legend-kind={kind}
    >
      <CheckpointKindIcon className="size-3.5" kind={kind} />
    </span>
  )
}

export function CheckpointLegend({
  kinds = ['DOCK', 'WEIGHING_AREA'],
}: {
  kinds?: CheckpointKind[]
}) {
  return (
    <ResourceLegend
      ariaLabel="Checkpoint legend"
      typeAriaLabel="Checkpoint types"
      types={kinds.map((kind) => ({
        label: CHECKPOINT_KIND_LABELS[kind],
        symbol: <CheckpointLegendKindSymbol kind={kind} />,
      }))}
      statusAriaLabel="Checkpoint statuses"
      statuses={CHECKPOINT_STATUSES.map((status) => ({
        label: CHECKPOINT_STATUS_LABELS[status],
        symbol: (
          <ResourceLegendStatusSymbol status={status} dataAttribute="checkpoint-legend-status" />
        ),
      }))}
    />
  )
}
