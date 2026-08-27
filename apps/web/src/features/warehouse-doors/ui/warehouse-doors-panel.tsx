import { MapPinIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { WarehouseDoorStatusFilter } from '@/features/warehouse-doors/types'
import { WarehouseDoorRowActions } from '@/features/warehouse-doors/ui/warehouse-door-row-actions'
import {
  countWarehouseDoors,
  filterWarehouseDoors,
  sortDoors,
} from '@/features/warehouse-doors/warehouse-door-presentation'
import type { WarehouseWithDoorsDto } from '@/features/warehouses/types'
import { formatDateTime } from '@/helpers/dates'
import { classnames } from '@/libraries/shadcn/helpers'

const labels: Record<WarehouseDoorStatusFilter, string> = {
  available: 'Available',
  archived: 'Archived',
}

export function WarehouseDoorsPanel({
  warehouse,
  status,
  selectedDoorId,
  onStatusChange,
  onDoorSelect,
  onCreateDoor,
  onEditDoor,
}: {
  warehouse: WarehouseWithDoorsDto
  status: WarehouseDoorStatusFilter
  selectedDoorId?: string
  onStatusChange: (status: WarehouseDoorStatusFilter) => void
  onDoorSelect: (doorId: string) => void
  /** Absent — rather than disabled — for anyone who may not add a door to this warehouse, and for
   * an archived warehouse, which is read-only until it is reactivated. */
  onCreateDoor?: () => void
  /** Absent for anyone who may not administer this warehouse's doors; the per-row menu then
   * renders nothing at all. Individual rows are gated again by their own lifecycle state. */
  onEditDoor?: (doorId: string) => void
}) {
  const counts = countWarehouseDoors(warehouse)
  const doors = sortDoors(filterWarehouseDoors(warehouse, status))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div>
          <h2 className="font-heading font-medium text-base">Doors</h2>
          <p className="mt-1 text-muted-foreground text-xs">
            Select a door to highlight its unloading point on the map.
          </p>
        </div>
        {onCreateDoor && (
          <Button onClick={onCreateDoor} size="sm" type="button">
            Create door
          </Button>
        )}
      </div>
      <Tabs
        value={status}
        onValueChange={(value) => onStatusChange(value as WarehouseDoorStatusFilter)}
      >
        <TabsList className="mx-4 mt-3 w-[calc(100%-2rem)]" aria-label="Warehouse door lifecycle">
          {(Object.keys(labels) as WarehouseDoorStatusFilter[]).map((key) => (
            <TabsTrigger key={key} value={key}>
              {labels[key]} <span className="text-xs">{counts[key]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {(Object.keys(labels) as WarehouseDoorStatusFilter[]).map((key) => (
          <TabsContent key={key} value={key} className="min-h-0 overflow-y-auto px-4 py-4">
            {doors.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No {labels[key].toLowerCase()} warehouse doors in this warehouse.
              </p>
            ) : (
              <ul aria-label={`${labels[key]} warehouse doors`} className="grid gap-2">
                {doors.map((door) => (
                  // The card is the `<li>`, not the row button, so the action menu sits *inside*
                  // it while staying a sibling of the button: a row is itself a `<Button>`, and an
                  // action nested in one would put a button inside a button. The button below is
                  // therefore transparent and borderless, and the card owns the border, the
                  // background, and the hover and selected states for both children.
                  <li
                    className={classnames(
                      'flex items-center gap-1 rounded-md border border-border bg-background pr-1 transition-colors',
                      'hover:bg-muted has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                      'dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
                      door.id === selectedDoorId && 'border-primary bg-accent dark:bg-accent',
                    )}
                    key={door.id}
                  >
                    <Button
                      aria-pressed={door.id === selectedDoorId}
                      className="h-auto min-w-0 flex-1 justify-start gap-2 bg-transparent px-3 py-3 text-left hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent"
                      onClick={() => onDoorSelect(door.id)}
                      variant="ghost"
                    >
                      <MapPinIcon className="size-4 shrink-0" />
                      <span className="grid min-w-0">
                        <span className="truncate">{door.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {door.status === 'AVAILABLE' ? 'Available' : 'Archived'} · {door.latitude}
                          , {door.longitude}
                        </span>
                        {door.status === 'ARCHIVED' && door.archivedAt && (
                          <span className="truncate text-muted-foreground text-xs">
                            {/* Naming the provenance is what keeps a door archived with its
                                warehouse distinguishable from one retired on its own. Gated on the
                                current status too: reactivation leaves `archivedAt` in place, so an
                                available door would otherwise still claim it was archived. */}
                            {door.archivedWithWarehouse
                              ? 'Archived with this warehouse'
                              : 'Archived on its own'}{' '}
                            · {formatDateTime(door.archivedAt)}
                            {door.archiveComment ? ` · ${door.archiveComment}` : ''}
                          </span>
                        )}
                      </span>
                    </Button>
                    {onEditDoor && (
                      <WarehouseDoorRowActions
                        door={door}
                        onEdit={onEditDoor}
                        warehouseStatus={warehouse.status}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
