import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WarehouseDoorsPanel } from '@/features/warehouse-doors/ui/warehouse-doors-panel'
import {
  TWO_DOOR_ARCHIVED_WAREHOUSE,
  WAREHOUSES,
} from '@/features/warehouses/__tests__/support/fixtures'

const AVAILABLE_WAREHOUSE = WAREHOUSES[0]
const ARCHIVED_WAREHOUSE = WAREHOUSES[1]

/** `Old Door` — archived on its own, under an available warehouse. The only reactivatable shape. */
const REACTIVATABLE = (AVAILABLE_WAREHOUSE.doors ?? [])[1]
/** `North Door` — available. */
const OPEN_DOOR = (AVAILABLE_WAREHOUSE.doors ?? [])[0]
/** `Retired Door` — archived with its warehouse. */
const CASCADED = (ARCHIVED_WAREHOUSE.doors ?? [])[0]
/** `Yard Door` — the second door of an archived warehouse, archived with it like every other. */
const SIBLING_UNDER_ARCHIVED = (TWO_DOOR_ARCHIVED_WAREHOUSE.doors ?? [])[1]

const panel = (
  warehouse: typeof AVAILABLE_WAREHOUSE,
  status: 'available' | 'archived',
  { canAdministerDoors = true, editable = true } = {},
) =>
  render(
    <WarehouseDoorsPanel
      canAdministerDoors={canAdministerDoors}
      warehouse={warehouse}
      status={status}
      onStatusChange={vi.fn()}
      onDoorSelect={vi.fn()}
      onEditDoor={editable ? vi.fn() : undefined}
    />,
  )

const menuItems = async (doorName: string) => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: `Actions for ${doorName}` }))

  return (await screen.findAllByRole('menuitem')).map((item) => item.textContent)
}

test('offers Reactivate on a door archived on its own under an available warehouse', async () => {
  panel(AVAILABLE_WAREHOUSE, 'archived')

  expect(await menuItems(REACTIVATABLE.name)).toEqual(['Copy coordinates', 'Reactivate'])
})

test('offers Edit and Archive, and not Reactivate, on an available door', async () => {
  panel(AVAILABLE_WAREHOUSE, 'available')

  expect(await menuItems(OPEN_DOOR.name)).toEqual(['Edit', 'Copy coordinates', 'Archive'])
})

test('offers no lifecycle action on a door archived with its warehouse', async () => {
  panel(ARCHIVED_WAREHOUSE, 'archived')

  // Its remedy is the warehouse's own reactivation, which restores it in the same action; the row
  // already says so. Only the entries that change nothing remain.
  expect(await menuItems(CASCADED.name)).toEqual(['Copy coordinates'])
})

test('offers no lifecycle action on any door of an archived warehouse', async () => {
  panel(TWO_DOOR_ARCHIVED_WAREHOUSE, 'archived')

  expect(await menuItems(SIBLING_UNDER_ARCHIVED.name)).toEqual(['Copy coordinates'])
})

test('offers only Copy coordinates to a viewer who may not administer doors', async () => {
  panel(AVAILABLE_WAREHOUSE, 'archived', { canAdministerDoors: false })

  expect(await menuItems(REACTIVATABLE.name)).toEqual(['Copy coordinates'])
})

test('still offers Reactivate when the viewer may administer but not correct doors', async () => {
  // An archived door offers no Edit anyway, so gating the menu on the edit callback would have
  // withheld the one action the row does allow.
  panel(AVAILABLE_WAREHOUSE, 'archived', { editable: false })

  expect(await menuItems(REACTIVATABLE.name)).toEqual(['Copy coordinates', 'Reactivate'])
})
