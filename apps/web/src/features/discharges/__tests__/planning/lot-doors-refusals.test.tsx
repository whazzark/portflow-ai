import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import { REMOVE_FROM_SHIFT_FIRST } from '@/features/discharges/ui/planning/door-transfer-row'
import {
  DOORS_NOT_REMOVABLE_MESSAGE,
  DOORS_NOT_SELECTABLE_MESSAGE,
} from '@/features/discharges/ui/planning/lot-warehouse-doors-dialog'
import {
  buildDischargeDetail,
  buildDoorPeriod,
  buildDoorSelection,
  buildLot,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  mockDischargePlanning,
  openLotMenu,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const SHIFT = buildShift({ id: 'shift-first', warehouseDoors: [buildDoorSelection()] })
const SHIFT_NAME = `Shift ${formatShiftPeriod(SHIFT)}`
const WHEAT = buildLot({
  id: 'lot-wheat',
  productName: 'Blé tendre',
  doorAssignments: [buildDoorPeriod({ id: 'wheat-a1' })],
})
const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  productLots: [WHEAT],
  shifts: [SHIFT],
})

const validationError = (field: string, rule: string, message: string) => ({
  status: 422,
  body: {
    error: {
      code: 'E_VALIDATION_ERROR',
      message: 'Validation failure',
      details: [{ field, rule, message }],
    },
  },
})

const available = (dialog: HTMLElement) => within(dialog).getByRole('region', { name: 'Available' })
const assigned = (dialog: HTMLElement) =>
  within(dialog).getByRole('region', { name: 'Assigned to this lot' })

async function openWheatDoors() {
  const menu = await openLotMenu('Cargill France · Blé tendre')
  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Assign doors' }))
  const dialog = await screen.findByRole('dialog', { name: 'Warehouse doors' })
  await within(available(dialog)).findByRole('button', { name: 'Add', description: /^Door B1/ })

  return dialog
}

test('locks a door a planned shift uses in the lot’s column, naming the shift', async () => {
  mockDischargePlanning({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openWheatDoors()
  const row = within(assigned(dialog)).getByRole('listitem')

  expect(within(row).getByRole('link', { name: SHIFT_NAME })).toBeInTheDocument()
  expect(within(row).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  expect(within(row).getByText(REMOVE_FROM_SHIFT_FIRST)).toHaveClass('sr-only')
})

test('opens the shift using a door from its lock, leaving the doors dialog', async () => {
  mockDischargePlanning({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openWheatDoors()
  fireEvent.click(within(assigned(dialog)).getByRole('link', { name: SHIFT_NAME }))

  expect(await screen.findByRole('dialog', { name: SHIFT_NAME })).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'Warehouse doors' })).not.toBeInTheDocument()
})

test('locks a door the API says a shift took meanwhile, and saves once it is taken back', async () => {
  // The page still believes no shift uses the door; the API knows better.
  const stale = { ...PLANNED, shifts: [buildShift({ id: 'shift-first' })] }
  const state = mockDischargePlanning({
    detail: stale,
    respondToLotDoors: () => {
      state.current = PLANNED

      return validationError(
        'withdraw.0',
        'selectedByPlannedShift',
        'This warehouse door is still selected for a planned shift',
      )
    },
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openWheatDoors()
  fireEvent.click(within(assigned(dialog)).getByRole('button', { name: 'Remove' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  const alert = await within(dialog).findByRole('alert')
  expect(alert).toHaveTextContent(DOORS_NOT_REMOVABLE_MESSAGE)
  await waitFor(() => expect(alert).toHaveFocus())
  const back = await within(available(dialog)).findByRole('button', {
    name: 'Add',
    description: `Door A1 ${SHIFT_NAME} ${REMOVE_FROM_SHIFT_FIRST}`,
  })

  fireEvent.click(back)
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Warehouse doors' })).not.toBeInTheDocument(),
  )
  expect(state.lotDoorRequests).toHaveLength(1)
})

test('shows a door refused as no longer available on its row, keeping the choices', async () => {
  mockDischargePlanning({
    detail: PLANNED,
    respondToLotDoors: () =>
      validationError(
        'assign.0',
        'availableWarehouseDoor',
        'This warehouse door is no longer available',
      ),
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openWheatDoors()
  fireEvent.click(
    within(available(dialog)).getByRole('button', { name: 'Add', description: /^Door B1/ }),
  )
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  const alert = await within(dialog).findByRole('alert')
  expect(alert).toHaveTextContent(DOORS_NOT_SELECTABLE_MESSAGE)
  await waitFor(() => expect(alert).toHaveFocus())
  expect(
    within(assigned(dialog)).getByRole('button', { name: 'Remove', description: /^Magasin B/ }),
  ).toHaveAccessibleDescription('Magasin B › Door B1 This warehouse door is no longer available')
})

test('keeps the dialog open with the choices on an unexpected failure', async () => {
  mockDischargePlanning({
    detail: PLANNED,
    respondToLotDoors: () => ({
      status: 500,
      body: { error: { code: 'E_INTERNAL', message: 'Something broke' } },
    }),
  })

  renderDischargeTab(PLANNED.id, 'product-lots')
  const dialog = await openWheatDoors()
  fireEvent.click(
    within(available(dialog)).getByRole('button', { name: 'Add', description: /^Door B1/ }),
  )
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Unable to update the warehouse doors')).toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'Warehouse doors' })).toBeInTheDocument()
  expect(
    within(assigned(dialog)).getByRole('button', { name: 'Remove', description: /^Magasin B/ }),
  ).toBeInTheDocument()
})
