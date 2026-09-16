import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { buildDischargeDetail, listedDischarge } from '../support/fixtures'
import {
  allowFormJourneyTime,
  change,
  mockTruckPlanning,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'))

async function openAddTrucks() {
  const pool = await screen.findByRole('region', { name: 'Truck pool' })
  fireEvent.click(within(pool).getAllByRole('button', { name: 'Add trucks' })[0])

  return screen.findByRole('dialog', { name: 'Add trucks' })
}

test('reserves the trucks chosen across searches and shows them in the pool', async () => {
  const state = mockTruckPlanning({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'truck-pool')
  const sheet = await openAddTrucks()

  const cedar = await within(sheet).findByRole('checkbox', { name: 'Select CE-101-DR' })
  expect(
    within(sheet).getByRole('button', { name: 'Also held by MV Ocean Cedar · Active' }),
  ).toBeInTheDocument()
  fireEvent.click(cedar)

  change(within(sheet).getByRole('textbox', { name: 'Search trucks' }), 'loire')
  expect(
    within(sheet).queryByRole('checkbox', { name: 'Select CE-101-DR' }),
  ).not.toBeInTheDocument()
  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select LO-202-RE' }))
  change(within(sheet).getByRole('textbox', { name: 'Search trucks' }), '')
  expect(within(sheet).getByText('2 selected')).toBeInTheDocument()

  fireEvent.click(within(sheet).getByRole('button', { name: 'Reserve' }))

  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Add trucks' })).not.toBeInTheDocument(),
  )
  expect(await screen.findByText('2 trucks reserved')).toBeInTheDocument()
  expect(state.requests).toEqual([
    { kind: 'reserve', truckIds: ['candidate-cedar', 'candidate-loire'] },
  ])
  const pool = screen.getByRole('region', { name: 'Truck pool' })
  expect(pool).toHaveTextContent('CE-101-DR')
  expect(pool).toHaveTextContent('LO-202-RE')
})

test('offers nothing to reserve until a truck is selected', async () => {
  mockTruckPlanning({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'truck-pool')
  const sheet = await openAddTrucks()

  await within(sheet).findByRole('checkbox', { name: 'Select CE-101-DR' })
  expect(within(sheet).getByRole('button', { name: 'Reserve' })).toBeDisabled()
})

test('says when every available truck is already in the pool', async () => {
  mockTruckPlanning({ detail: PLANNED, candidates: [] })

  renderDischargeTab(PLANNED.id, 'truck-pool')
  const sheet = await openAddTrucks()

  expect(await within(sheet).findByText('No trucks to add')).toBeInTheDocument()
})

test('lets the candidates be loaded again after they failed to load', async () => {
  let failures = 1
  const state = mockTruckPlanning({
    detail: PLANNED,
    respondToCandidates: () => {
      if (failures > 0) {
        failures -= 1
        return { status: 500, body: { error: { code: 'E_INTERNAL', message: 'Boom' } } }
      }
      return undefined
    },
  })

  renderDischargeTab(PLANNED.id, 'truck-pool')
  const sheet = await openAddTrucks()

  expect(await within(sheet).findByText('Unable to load trucks')).toBeInTheDocument()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Retry' }))
  expect(
    await within(sheet).findByRole('checkbox', { name: 'Select CE-101-DR' }),
  ).toBeInTheDocument()
  expect(state.candidateRequests).toBeGreaterThanOrEqual(2)
})

test('keeps the sheet and its selection when a truck can no longer be reserved', async () => {
  mockTruckPlanning({
    detail: PLANNED,
    respondToReserve: () => ({
      status: 422,
      body: {
        error: {
          code: 'E_VALIDATION_ERROR',
          message: 'Validation failure',
          details: [
            {
              field: 'truckIds.0',
              rule: 'availableTruck',
              message: 'This truck is no longer available to reserve',
            },
          ],
        },
      },
    }),
  })

  renderDischargeTab(PLANNED.id, 'truck-pool')
  const sheet = await openAddTrucks()
  fireEvent.click(await within(sheet).findByRole('checkbox', { name: 'Select PO-303-RT' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Reserve' }))

  expect(
    await within(sheet).findByText('Some trucks can no longer be reserved'),
  ).toBeInTheDocument()
  expect(
    within(sheet).getByText('This truck is no longer available to reserve'),
  ).toBeInTheDocument()
  expect(within(sheet).getByRole('checkbox', { name: 'Select PO-303-RT' })).toBeChecked()
})

test('closes and refreshes when the discharge has started meanwhile', async () => {
  const state = mockTruckPlanning({
    detail: PLANNED,
    respondToReserve: () => ({
      status: 409,
      body: {
        error: {
          code: 'E_DISCHARGE_NOT_PLANNED',
          message: 'Only a planned discharge can be corrected',
        },
      },
    }),
  })

  renderDischargeTab(PLANNED.id, 'truck-pool')
  const sheet = await openAddTrucks()
  fireEvent.click(await within(sheet).findByRole('checkbox', { name: 'Select PO-303-RT' }))
  const requestsBefore = state.detailRequests
  fireEvent.click(within(sheet).getByRole('button', { name: 'Reserve' }))

  expect(
    await screen.findByText('This discharge has started and can no longer be corrected'),
  ).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Add trucks' })).not.toBeInTheDocument(),
  )
  await waitFor(() => expect(state.detailRequests).toBeGreaterThan(requestsBefore))
})

test('keeps the selection when the reservation could not be sent', async () => {
  mockTruckPlanning({ detail: PLANNED, respondToReserve: () => 'network-error' })

  renderDischargeTab(PLANNED.id, 'truck-pool')
  const sheet = await openAddTrucks()
  fireEvent.click(await within(sheet).findByRole('checkbox', { name: 'Select PO-303-RT' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Reserve' }))

  expect(await screen.findByText('Unable to reserve trucks')).toBeInTheDocument()
  expect(within(sheet).getByRole('checkbox', { name: 'Select PO-303-RT' })).toBeChecked()
})
