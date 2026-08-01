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
  const isArchived = status === 'ARCHIVED'

  return (
    <span
      aria-hidden="true"
      className={classnames(
        'relative grid shrink-0 place-items-center rounded-full border-2 transition-colors duration-200 motion-reduce:transition-none',
        compact ? 'size-6 shadow-sm' : 'size-[30px] shadow-md',
        isArchived
          ? 'border-muted-foreground border-dashed bg-background/95 text-muted-foreground'
          : 'border-background bg-primary text-primary-foreground',
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

export function CheckpointLegend({ kinds = ['DOCK'] }: { kinds?: CheckpointKind[] }) {
  return (
    <section
      aria-label="Checkpoint legend"
      className="pointer-events-none w-fit rounded-lg border bg-background/95 px-2.5 py-2 text-foreground shadow-md backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {kinds.flatMap((kind) =>
          CHECKPOINT_STATUSES.map((status) => (
            <span className="flex items-center gap-1.5 text-xs" key={`${kind}-${status}`}>
              <CheckpointMarkerSymbol compact kind={kind} status={status} />
              {CHECKPOINT_KIND_LABELS[kind]} · {CHECKPOINT_STATUS_LABELS[status]}
            </span>
          )),
        )}
      </div>
    </section>
  )
}
