import { MapPinIcon, XIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ResourceMapToggleGroup } from '@/components/resource-map/resource-map-toolbar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import type { WarehouseDoorStatusFilter } from '@/features/warehouse-doors/types'
import { WarehouseDoorRowActions } from '@/features/warehouse-doors/ui/warehouse-door-row-actions'
import {
  countWarehouseDoors,
  filterWarehouseDoors,
  sortDoors,
} from '@/features/warehouse-doors/warehouse-door-presentation'
import { formatCoordinates } from '@/features/warehouses/geometry/footprint-centre'
import type { WarehouseWithDoorsDto } from '@/features/warehouses/types'
import { formatDateTime } from '@/helpers/dates'
import { classnames } from '@/libraries/shadcn/helpers'

const labels: Record<WarehouseDoorStatusFilter, string> = {
  available: 'Available',
  archived: 'Archived',
}

// The description says what would put a door in this list, rather than restating the title —
// the same split every other directory's empty state makes.
const emptyDescriptions: Record<WarehouseDoorStatusFilter, string> = {
  available: 'Doors in service at this warehouse appear here.',
  archived: 'Doors archived from this warehouse appear here.',
}

export function WarehouseDoorsPanel({
  warehouse,
  status,
  selectedDoorId,
  onStatusChange,
  onDoorSelect,
  onCreateDoor,
  canAdministerDoors = false,
  onEditDoor,
  onShowDoorOnMap,
  selectMode = false,
  checkedDoorIds,
  onToggleChecked,
  onSelectAll,
  onClearSelection,
  selectionAction,
}: {
  warehouse: WarehouseWithDoorsDto
  status: WarehouseDoorStatusFilter
  selectedDoorId?: string
  onStatusChange: (status: WarehouseDoorStatusFilter) => void
  onDoorSelect: (doorId: string) => void
  /** Absent — rather than disabled — for anyone who may not add a door to this warehouse, and for
   * an archived warehouse, which is read-only until it is reactivated. */
  onCreateDoor?: () => void
  /** Whether this user may administer the warehouse's doors at all. False leaves each row's menu
   * with only Show on map and Copy coordinates; individual rows are gated again by their own and
   * their warehouse's lifecycle state, and the API re-decides both under lock. */
  canAdministerDoors?: boolean
  onEditDoor?: (doorId: string) => void
  onShowDoorOnMap?: (doorId: string) => void
  /** Whether checking doors is offered at all. True for an administrator on an available
   * warehouse's Available doors — there is no mode to enter, so a selection can start on the first
   * click. Only available doors are checkable in this slice; selecting archived ones to bring them
   * back is #216's. */
  selectMode?: boolean
  checkedDoorIds?: ReadonlySet<string>
  onToggleChecked?: (doorId: string) => void
  onSelectAll?: (checked: boolean, doorIds: string[]) => void
  /** Empties the selection without acting on it. Offered beside the count for the same reason the
   * shared bulk toolbar offers it: unchecking rows one at a time cannot reach an id whose row the
   * list no longer holds, so without it a selection can become impossible to put down. */
  onClearSelection?: () => void
  /** What the selection can be acted on with, rendered beside `Select all`. The caller passes it
   * only once at least one door is checked, so the row stays quiet until there is something to act
   * on. It sits here rather than in a floating bar because a bar hovering between this panel and
   * the map legend is the one place an administrator does not look. */
  selectionAction?: ReactNode
}) {
  const counts = countWarehouseDoors(warehouse)
  const doors = sortDoors(filterWarehouseDoors(warehouse, status))
  // Only the doors this view lists take part: a selection never reaches beyond the warehouse and
  // the lifecycle view it was built in.
  const selectableIds = selectMode
    ? doors.filter((door) => door.status === 'AVAILABLE').map((door) => door.id)
    : []
  const checked = checkedDoorIds ?? new Set<string>()
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => checked.has(id))
  const someSelected = selectableIds.some((id) => checked.has(id))
  // Counted over the whole selection rather than over the listed rows, so a door the list has since
  // dropped is still accounted for — and still clearable — instead of silently inflating what
  // `Archive selected` submits.
  const checkedCount = checked.size

  return (
    <section aria-labelledby="warehouse-doors-heading" className="flex flex-col px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-sm" id="warehouse-doors-heading">
          Doors
        </h3>
        {onCreateDoor && (
          <Button onClick={onCreateDoor} size="sm" type="button" variant="outline">
            Create door
          </Button>
        )}
      </div>
      {/* One status at a time, unlike the toolbar's cumulative pills: the list and its selection
          are scoped to a single lifecycle view. Pressing the other pill switches to it. */}
      <ResourceMapToggleGroup
        className="mt-2 w-fit"
        countNoun="doors"
        exclusive
        items={(Object.keys(labels) as WarehouseDoorStatusFilter[]).map((key) => ({
          value: key,
          label: labels[key],
          count: counts[key],
          pressed: key === status,
        }))}
        label="Door status"
        onToggle={onStatusChange}
      />
      <div className="pt-3">
        {selectMode && selectableIds.length > 0 && (
          <div className="mb-2 flex min-h-8 items-center gap-2">
            <Checkbox
              aria-checked={someSelected && !allSelected ? 'mixed' : allSelected}
              aria-label={`Select all ${labels[status].toLowerCase()} doors`}
              checked={allSelected}
              onCheckedChange={(value) => onSelectAll?.(value === true, selectableIds)}
            />
            <span className="text-muted-foreground text-xs">Select all</span>
            {/* The shared bulk toolbar's own trio — a count, the action, and a way to clear —
                    kept word for word so doors read like every other site reference (FR-039,
                    FR-042); only its home differs, because this selection lives in the panel. */}
            {checkedCount > 0 && (
              <span className="font-medium text-xs tabular-nums">{checkedCount} selected</span>
            )}
            {selectionAction && <span className="ml-auto">{selectionAction}</span>}
            {checkedCount > 0 && onClearSelection && (
              <Button
                aria-label="Clear selection"
                className={selectionAction ? undefined : 'ml-auto'}
                onClick={onClearSelection}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
        {doors.length === 0 ? (
          // The shared empty state every other directory uses.
          <Empty className="min-h-32 border-0 p-0">
            <EmptyHeader>
              <EmptyTitle>No {labels[status].toLowerCase()} doors</EmptyTitle>
              <EmptyDescription>{emptyDescriptions[status]}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul aria-label={`${labels[status]} warehouse doors`} className="grid gap-2">
            {doors.map((door) => (
              // The card is the `<li>`, not the row button, so the action menu sits *inside*
              // it while staying a sibling of the button: a row is itself a `<Button>`, and an
              // action nested in one would put a button inside a button. The button below is
              // therefore transparent and borderless, and the card owns the border, the
              // background, and the hover and selected states for both children.
              <li
                className={classnames(
                  'flex items-center gap-1 rounded-md border border-border bg-background pr-1 pl-1 transition-colors',
                  'hover:bg-muted has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                  'dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
                  door.id === selectedDoorId && 'border-primary bg-accent dark:bg-accent',
                )}
                key={door.id}
              >
                {selectMode && door.status === 'AVAILABLE' && (
                  <Checkbox
                    aria-label={`Select door ${door.name}`}
                    checked={checked.has(door.id)}
                    className="ml-2"
                    onCheckedChange={() => onToggleChecked?.(door.id)}
                  />
                )}
                <Button
                  aria-pressed={door.id === selectedDoorId}
                  className="h-auto min-w-0 flex-1 justify-start gap-2 bg-transparent px-3 py-3 text-left hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent"
                  onClick={() => onDoorSelect(door.id)}
                  variant="ghost"
                >
                  <MapPinIcon className="size-4 shrink-0" />
                  <span className="grid min-w-0">
                    <span className="truncate">{door.name}</span>
                    {/* The coordinates are the unloading point a driver is sent to; the V2 card
                        shows them on every row, and the menu copies them. */}
                    <span className="font-mono text-muted-foreground text-xs tabular-nums">
                      {formatCoordinates(door)}
                    </span>
                    {door.status === 'ARCHIVED' && door.archivedAt && (
                      <>
                        <span className="truncate text-muted-foreground text-xs">
                          {/* The provenance is read off the containing warehouse rather than
                                  off the door: archiving a warehouse takes every door it holds, so
                                  an archived warehouse holds none but doors archived with it, and
                                  an available one none but doors retired on their own. Gated on the
                                  door's current status too: reactivation leaves `archivedAt` in
                                  place, so an available door would otherwise still claim it was
                                  archived. */}
                          {warehouse.status === 'ARCHIVED'
                            ? 'Archived with this warehouse'
                            : 'Archived on its own'}{' '}
                          · {formatDateTime(door.archivedAt)}
                        </span>
                        {door.archiveComment && (
                          // Its own line, and wrapped rather than truncated: a lifecycle comment
                          // runs to 1,000 characters, and this row is the only place it can be
                          // read — #212 forbids a door detail view, so an ellipsis here would
                          // hide it for good.
                          <span className="wrap-anywhere text-muted-foreground text-xs italic">
                            {door.archiveComment}
                          </span>
                        )}
                      </>
                    )}
                    {door.status === 'AVAILABLE' && door.reactivatedAt && (
                      <>
                        <span className="truncate text-muted-foreground text-xs">
                          {/* The mirror of the line above, and gated the same way. Without it a
                                  door that had been archived and brought back would report nothing
                                  at all, since the archive line is withheld once it is available.
                                  No actor: the embedded door carries `reactivatedByUserId`, not a
                                  resolved user — exactly as the archive line does. */}
                          Reactivated · {formatDateTime(door.reactivatedAt)}
                        </span>
                        {door.reactivationComment && (
                          <span className="wrap-anywhere text-muted-foreground text-xs italic">
                            {door.reactivationComment}
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </Button>
                <WarehouseDoorRowActions
                  canAdminister={canAdministerDoors}
                  door={door}
                  onEdit={onEditDoor}
                  onShowOnMap={onShowDoorOnMap}
                  warehouseStatus={warehouse.status}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-muted-foreground text-xs">
        Select a door to highlight its unloading point on the map.
      </p>
    </section>
  )
}
