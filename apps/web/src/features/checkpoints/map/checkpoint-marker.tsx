import { AnchorIcon, ArchiveIcon, ScaleIcon } from 'lucide-react'
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
}: {
  checkpoint: PresentedCheckpoint
  offset?: [number, number]
  onSelect: (checkpoint: PresentedCheckpoint) => void
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
            checkpoint.isSearchMatch ? 'scale-110 opacity-100' : 'scale-75 opacity-35',
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

function CheckpointLegendStatusSymbol({ status }: { status: CheckpointStatus }) {
  const isArchived = status === 'ARCHIVED'

  return (
    <span
      aria-hidden="true"
      className={classnames(
        'relative grid size-6 shrink-0 place-items-center rounded-full border-2 shadow-sm',
        isArchived
          ? 'border-muted-foreground border-dashed bg-background/95 text-muted-foreground'
          : 'border-background bg-primary',
      )}
      data-checkpoint-legend-status={status}
    >
      {isArchived && (
        <span className="absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full border border-background bg-muted text-muted-foreground">
          <ArchiveIcon className="size-2" />
        </span>
      )}
    </span>
  )
}

export function CheckpointLegend({
  kinds = ['DOCK', 'WEIGHING_AREA'],
}: {
  kinds?: CheckpointKind[]
}) {
  return (
    <section
      aria-label="Checkpoint legend"
      className="pointer-events-none w-fit max-w-full rounded-lg border bg-background/95 px-3 py-2.5 text-foreground shadow-md backdrop-blur"
    >
      <div className="grid gap-2.5 sm:flex sm:items-center sm:gap-4">
        <fieldset aria-label="Checkpoint types" className="grid gap-1.5">
          <legend className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
            Type
          </legend>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {kinds.map((kind) => (
              <span className="flex items-center gap-1.5 text-xs" key={kind}>
                <CheckpointLegendKindSymbol kind={kind} />
                {CHECKPOINT_KIND_LABELS[kind]}
              </span>
            ))}
          </div>
        </fieldset>
        <fieldset
          aria-label="Checkpoint statuses"
          className="grid gap-1.5 border-t pt-2.5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4"
        >
          <legend className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
            Status
          </legend>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {CHECKPOINT_STATUSES.map((status) => (
              <span className="flex items-center gap-1.5 text-xs" key={status}>
                <CheckpointLegendStatusSymbol status={status} />
                {CHECKPOINT_STATUS_LABELS[status]}
              </span>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  )
}
