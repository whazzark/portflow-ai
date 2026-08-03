import { ArchiveIcon, DoorOpenIcon } from 'lucide-react'
import { getResourceMarkerOffset } from '@/components/resource-map/resource-marker-offset'
import { MapMarker, MarkerContent, MarkerTooltip } from '@/components/ui/map'
import type { WarehouseDoorDto } from '@/features/warehouse-doors/types'
import { classnames } from '@/libraries/shadcn/helpers'

function DoorMarkerSymbol({ door, selected }: { door: WarehouseDoorDto; selected: boolean }) {
  const archived = door.status === 'ARCHIVED'
  return (
    <span
      aria-hidden="true"
      className={classnames(
        'relative grid size-7 place-items-center rounded-full border-2 transition-[opacity,transform] duration-200',
        selected && 'scale-110',
        archived
          ? 'border-muted-foreground border-dashed bg-background/95 text-muted-foreground'
          : 'border-background bg-primary text-primary-foreground',
      )}
      data-door-status={door.status}
    >
      <DoorOpenIcon className="size-3.5" />
      {archived && (
        <span className="absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full border border-background bg-muted text-muted-foreground">
          <ArchiveIcon className="size-2" />
        </span>
      )}
    </span>
  )
}

export function WarehouseDoorMarker({
  door,
  doors,
  selected = false,
  onSelect,
  onHoverChange,
}: {
  door: WarehouseDoorDto
  doors: WarehouseDoorDto[]
  selected?: boolean
  onSelect: (door: WarehouseDoorDto) => void
  onHoverChange?: (hovered: boolean) => void
}) {
  const statusLabel = door.status === 'AVAILABLE' ? 'Available' : 'Archived'
  return (
    <MapMarker
      latitude={door.latitude}
      longitude={door.longitude}
      offset={getResourceMarkerOffset(door, doors)}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <MarkerContent>
        <button
          aria-label={`View warehouse door ${door.name} (${statusLabel})`}
          className={classnames(
            'grid size-11 cursor-pointer place-items-center rounded-full transition-[opacity,transform,filter] duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            selected ? 'scale-110 opacity-100' : 'scale-90 opacity-70',
          )}
          data-door-id={door.id}
          data-status={door.status}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(door)
          }}
          title={`${door.name} — ${statusLabel}`}
          type="button"
        >
          <DoorMarkerSymbol door={door} selected={selected} />
        </button>
      </MarkerContent>
      <MarkerTooltip>
        <span className="grid gap-0.5 whitespace-nowrap">
          <span className="font-medium">{door.name}</span>
          <span>{statusLabel}</span>
        </span>
      </MarkerTooltip>
    </MapMarker>
  )
}
