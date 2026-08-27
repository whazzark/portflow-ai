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
  checked,
  onSelect,
  onToggleChecked,
  onHoverChange,
}: {
  door: WarehouseDoorDto
  doors: WarehouseDoorDto[]
  selected?: boolean
  /**
   * Defined wherever checking doors is offered (#215): the marker then renders as a checkable item
   * and carries the checked state. A click **both** checks the door and makes it the highlighted
   * one — the marker is a single target, so the two gestures ride together rather than one
   * replacing the other, and #212's "click a marker to see which door it is" survives intact.
   * Undefined leaves consultation exactly as it was.
   */
  checked?: boolean
  /** Omitted while the map is placing a new door: the marker then takes no pointer event at all,
   * so a click over it reaches the map and places the door being created rather than selecting
   * this one. Disabling the button alone would swallow the click and make the marker a dead spot,
   * which is precisely where a new door between two existing ones is placed. */
  onSelect?: (door: WarehouseDoorDto) => void
  onToggleChecked?: (door: WarehouseDoorDto) => void
  onHoverChange?: (hovered: boolean) => void
}) {
  const statusLabel = door.status === 'AVAILABLE' ? 'Available' : 'Archived'
  const isSelecting = checked !== undefined
  const interactive = onSelect !== undefined || (isSelecting && onToggleChecked !== undefined)
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
          aria-label={
            isSelecting
              ? `${checked ? 'Deselect' : 'Select'} door ${door.name}`
              : `View warehouse door ${door.name} (${statusLabel})`
          }
          aria-pressed={isSelecting ? checked : undefined}
          className={classnames(
            'grid size-11 place-items-center rounded-full transition-[opacity,transform,filter] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            interactive ? 'cursor-pointer hover:brightness-110' : 'pointer-events-none',
            checked && 'ring-2 ring-primary ring-offset-2',
            selected ? 'scale-110 opacity-100' : 'scale-90 opacity-70',
          )}
          data-checked={isSelecting ? checked : undefined}
          data-door-id={door.id}
          data-status={door.status}
          disabled={!interactive}
          onClick={(event) => {
            event.stopPropagation()
            // Both, in this order: checking is what the administrator asked for, highlighting is
            // what tells them which door they just checked.
            if (isSelecting) {
              onToggleChecked?.(door)
            }
            onSelect?.(door)
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
