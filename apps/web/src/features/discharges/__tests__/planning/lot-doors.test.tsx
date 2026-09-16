import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'

import {
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  change,
  mockDischargePlanning,
  mockPlanningOptions,
  openLotMenu,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const DESKTOP_WIDTH = window.innerWidth

afterEach(() => {
  window.innerWidth = DESKTOP_WIDTH
})

const WHEAT = buildLot({
  id: 'lot-wheat',
  productName: 'Blé tendre',
  doorAssignments: [buildDoorPeriod({ id: 'wheat-a1' })],
})
const BARLEY = buildLot({
  id: 'lot-barley',
  productName: 'Orge',
  customer: { id: 'customer-soufflet', name: 'Soufflet Négoce', status: 'AVAILABLE' },
  doorAssignments: [
    buildDoorPeriod({
      id: 'barley-b1',
      warehouseDoor: { id: 'door-b1', name: 'Door B1', status: 'AVAILABLE' },
      warehouse: { id: 'warehouse-b', name: 'Magasin B', status: 'AVAILABLE' },
    }),
  ],
})
const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  productLots: [WHEAT, BARLEY],
})

async function openWheatDoors() {
  const menu = await openLotMenu('Cargill France · Blé tendre')
  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Assign doors' }))

  return screen.findByRole('dialog', { name: 'Warehouse doors' })
}

const available = (dialog: HTMLElement) => within(dialog).getByRole('region', { name: 'Available' })
const assigned = (dialog: HTMLElement) =>
  within(dialog).getByRole('region', { name: 'Assigned to this lot' })
/** A door's action, found by the door its description names. */
const action = (column: HTMLElement, name: 'Add' | 'Remove', door: string) =>
  within(column).getByRole('button', { name, description: new RegExp(`^${door}`) })
const findAction = (column: HTMLElement, name: 'Add' | 'Remove', door: string) =>
  within(column).findByRole('button', { name, description: new RegExp(`^${door}`) })

test('shows the doors available beside the doors assigned to the lot', async () => {
  mockDischargePlanning({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openWheatDoors()

  expect(action(assigned(dialog), 'Remove', 'Magasin A › Door A1')).toBeInTheDocument()

  const doorA2 = await findAction(available(dialog), 'Add', 'Door A2')
  expect(doorA2).toHaveAccessibleDescription(
    /^Door A2 Also assigned to MV Ocean Cedar \(Active, expected .+\)$/,
  )
  expect(action(available(dialog), 'Add', 'Door B1')).toHaveAccessibleDescription(
    'Door B1 Held by Soufflet Négoce · Orge',
  )
  // A door is listed in one column only.
  expect(
    within(available(dialog)).queryByRole('button', { description: /^Door A1/ }),
  ).not.toBeInTheDocument()
  expect(within(available(dialog)).getByRole('list', { name: 'Magasin A' })).toBeInTheDocument()
})

test('adds a door at the end of the lot’s column, and hands the focus to the next door', async () => {
  mockDischargePlanning({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openWheatDoors()
  fireEvent.click(await findAction(available(dialog), 'Add', 'Door A2'))

  const rows = within(within(assigned(dialog)).getByRole('list')).getAllByRole('listitem')
  expect(rows.map((row) => row.textContent)).toEqual([
    expect.stringContaining('Door A1'),
    expect.stringContaining('Door A2'),
  ])
  expect(within(rows[1]).getByText('New')).toBeInTheDocument()
  await waitFor(() => expect(action(available(dialog), 'Add', 'Door B1')).toHaveFocus())
  expect(within(dialog).getByText('Adds Magasin A › Door A2')).toBeInTheDocument()
})

test('removes a held door back to the available ones, and takes it again', async () => {
  const state = mockDischargePlanning({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openWheatDoors()
  await findAction(available(dialog), 'Add', 'Door A2')
  fireEvent.click(action(assigned(dialog), 'Remove', 'Magasin A › Door A1'))

  expect(within(assigned(dialog)).getByText('No door assigned yet')).toBeInTheDocument()
  const back = action(available(dialog), 'Add', 'Door A1')
  expect(back).toHaveAccessibleDescription('Door A1 Will be removed')
  expect(within(dialog).getByText('Removes Magasin A › Door A1')).toBeInTheDocument()

  fireEvent.click(back)
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Warehouse doors' })).not.toBeInTheDocument(),
  )
  expect(state.lotDoorRequests).toEqual([])
})

test('saves the change set and shows the lot with its new doors', async () => {
  const state = mockDischargePlanning({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openWheatDoors()
  fireEvent.click(await findAction(available(dialog), 'Add', 'Door A2'))
  fireEvent.click(action(assigned(dialog), 'Remove', 'Magasin A › Door A1'))

  expect(
    within(dialog).getByText('Adds Magasin A › Door A2 · Removes Magasin A › Door A1'),
  ).toBeInTheDocument()

  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Warehouse doors' })).not.toBeInTheDocument(),
  )
  expect(await screen.findByText('Warehouse doors updated')).toBeInTheDocument()
  expect(state.lotDoorRequests).toEqual([
    { lotId: 'lot-wheat', body: { assign: ['door-a2'], withdraw: ['door-a1'] } },
  ])
  const wheat = within(screen.getByRole('region', { name: 'Product lots' })).getByRole('row', {
    name: /Blé tendre/,
  })
  expect(
    within(within(wheat).getByRole('list', { name: 'Warehouse doors' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual([expect.stringContaining('Door A2'), expect.stringContaining('Door A1')])
})

test('says a door moves from another lot before the save, and after it', async () => {
  mockDischargePlanning({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openWheatDoors()
  fireEvent.click(await findAction(available(dialog), 'Add', 'Door B1'))

  expect(action(assigned(dialog), 'Remove', 'Magasin B › Door B1')).toHaveAccessibleDescription(
    'Magasin B › Door B1 Moves from Soufflet Négoce · Orge',
  )
  expect(
    within(dialog).getByText('Magasin B › Door B1 moves from Soufflet Négoce · Orge'),
  ).toBeInTheDocument()

  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Warehouse doors updated')).toBeInTheDocument()
  expect(screen.getByText('Taken from Soufflet Négoce · Orge')).toBeInTheDocument()
})

test('searches the available doors only', async () => {
  mockDischargePlanning({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openWheatDoors()
  await findAction(available(dialog), 'Add', 'Door A2')

  change(within(dialog).getByRole('textbox', { name: 'Search doors' }), 'b1')

  expect(action(available(dialog), 'Add', 'Door B1')).toBeInTheDocument()
  expect(
    within(available(dialog)).queryByRole('button', { description: /^Door A2/ }),
  ).not.toBeInTheDocument()
  expect(action(assigned(dialog), 'Remove', 'Magasin A › Door A1')).toBeInTheDocument()

  change(within(dialog).getByRole('textbox', { name: 'Search doors' }), 'porte zéro')

  expect(within(dialog).getByText('No door matches “porte zéro”')).toBeInTheDocument()
})

test('closes on Cancel without a request', async () => {
  const state = mockDischargePlanning({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openWheatDoors()
  fireEvent.click(await findAction(available(dialog), 'Add', 'Door A2'))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Warehouse doors' })).not.toBeInTheDocument(),
  )
  expect(state.lotDoorRequests).toEqual([])
})

test('shows the lot’s doors at once, and holds the save until the available ones load', async () => {
  mockDischargePlanning({ detail: PLANNED })
  const options = mockPlanningOptions({ status: 'error' })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openWheatDoors()

  expect(action(assigned(dialog), 'Remove', 'Magasin A › Door A1')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
  expect(await within(dialog).findByText('Unable to load the warehouse doors')).toBeInTheDocument()

  options.recover()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Retry' }))

  expect(await findAction(available(dialog), 'Add', 'Door A2')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled()
})

test('lets a door archived since it was assigned go, and takes it back', async () => {
  const withArchived = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
    productLots: [
      buildLot({
        id: 'lot-wheat',
        productName: 'Blé tendre',
        doorAssignments: [
          buildDoorPeriod({
            id: 'wheat-gone',
            warehouseDoor: { id: 'door-gone', name: 'Door Gone', status: 'ARCHIVED' },
            warehouse: { id: 'warehouse-a', name: 'Magasin A', status: 'AVAILABLE' },
          }),
        ],
      }),
      BARLEY,
    ],
  })
  const state = mockDischargePlanning({ detail: withArchived })

  renderDischargeTab(withArchived.id, 'product-lots')
  const dialog = await openWheatDoors()
  await findAction(available(dialog), 'Add', 'Door A2')

  expect(within(assigned(dialog)).getByText('Archived')).toBeInTheDocument()
  fireEvent.click(action(assigned(dialog), 'Remove', 'Magasin A › Door Gone'))
  fireEvent.click(action(available(dialog), 'Add', 'Door Gone'))
  fireEvent.click(action(assigned(dialog), 'Remove', 'Magasin A › Door Gone'))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  await waitFor(() =>
    expect(state.lotDoorRequests).toEqual([
      { lotId: 'lot-wheat', body: { assign: [], withdraw: ['door-gone'] } },
    ]),
  )
})

test('shows the two columns as tabs on a phone', async () => {
  window.innerWidth = 390
  mockDischargePlanning({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openWheatDoors()

  fireEvent.click(await findAction(available(dialog), 'Add', 'Door A2'))
  const assignedTab = within(dialog).getByRole('tab', { name: 'Assigned (2)' })
  expect(within(dialog).getByRole('tab', { name: 'Available (1)' })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  fireEvent.click(assignedTab)

  expect(await findAction(assigned(dialog), 'Remove', 'Magasin A › Door A2')).toBeVisible()
})
