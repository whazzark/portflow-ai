import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { toDateTimeLocalValue } from '@/helpers/dates'

import { AVAILABLE_DOCKS, buildDischargeDetail, listedDischarge } from '../support/fixtures'
import {
  allowFormJourneyTime,
  change,
  chooseOption,
  mockDischargeCorrections,
  renderDischargeDetail,
} from '../support/test-helpers'

allowFormJourneyTime()

const ATLANTIC_DAWN = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  vesselImo: null,
  vesselComment: 'Berth 4',
})

async function openEditSheet() {
  // Editing acts on the whole discharge, so it sits beside its name, as starting does.
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))

  return screen.findByRole('dialog', { name: 'Edit discharge' })
}

test('corrects the identity of a planned discharge from its detail', async () => {
  const state = mockDischargeCorrections({ detail: ATLANTIC_DAWN })

  renderDischargeDetail(ATLANTIC_DAWN.id)
  const sheet = await openEditSheet()

  expect(within(sheet).getByRole('textbox', { name: 'Vessel name' })).toHaveValue(
    'MV Atlantic Dawn',
  )
  expect(within(sheet).getByRole('textbox', { name: 'IMO number' })).toHaveValue('')
  expect(within(sheet).getByLabelText(/^Expected start/)).toHaveValue(
    toDateTimeLocalValue(ATLANTIC_DAWN.expectedStartAt),
  )
  // The current dock stays offered even though it is not among the available docks listed.
  expect(within(sheet).getByRole('combobox', { name: 'Dock' })).toHaveValue(ATLANTIC_DAWN.dock.name)

  change(within(sheet).getByRole('textbox', { name: 'Vessel name' }), 'MV Atlantic Renamed')
  await chooseOption(sheet, 'Dock', AVAILABLE_DOCKS[1].name)
  const detailRequestsBeforeSave = state.detailRequests
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(await within(sheet).findByRole('button', { name: 'Saving…' })).toBeDisabled()
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Edit discharge' })).not.toBeInTheDocument(),
  )
  expect(
    await screen.findByRole('heading', { level: 1, name: 'MV Atlantic Renamed' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Discharge “MV Atlantic Renamed” updated')).toBeInTheDocument()
  expect(state.identityRequests).toEqual([
    {
      vesselName: 'MV Atlantic Renamed',
      vesselImo: null,
      vesselComment: 'Berth 4',
      dockId: AVAILABLE_DOCKS[1].id,
      expectedStartAt: expect.stringMatching(/[+-]\d{2}:\d{2}$/),
    },
  ])
  expect(state.detailRequests).toBe(detailRequestsBeforeSave)
})

test('keeps the sheet open with the refused value explained', async () => {
  mockDischargeCorrections({
    detail: ATLANTIC_DAWN,
    respondToIdentity: () => ({
      status: 422,
      body: {
        error: {
          code: 'E_VALIDATION_ERROR',
          message: 'Validation failure',
          details: [
            { field: 'dockId', message: 'This dock is no longer available', rule: 'availableDock' },
          ],
        },
      },
    }),
  })

  renderDischargeDetail(ATLANTIC_DAWN.id)
  const sheet = await openEditSheet()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(await within(sheet).findByText('This dock is no longer available')).toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'Edit discharge' })).toBeInTheDocument()
})

test('closes and refreshes when the discharge has started in the meantime', async () => {
  const state = mockDischargeCorrections({
    detail: ATLANTIC_DAWN,
    respondToIdentity: () => {
      state.current = { ...state.current, status: 'ACTIVE' }

      return {
        status: 409,
        body: {
          error: {
            code: 'E_DISCHARGE_NOT_PLANNED',
            message: 'Only a planned discharge can be corrected',
          },
        },
      }
    },
  })

  renderDischargeDetail(ATLANTIC_DAWN.id)
  const sheet = await openEditSheet()
  const detailRequestsBeforeSave = state.detailRequests
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(
    await screen.findByText('This discharge has started and can no longer be corrected'),
  ).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Edit discharge' })).not.toBeInTheDocument(),
  )
  await waitFor(() => expect(state.detailRequests).toBeGreaterThan(detailRequestsBeforeSave))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument(),
  )
})

test('opens the sheet at once and keeps the current dock while the docks load', async () => {
  mockDischargeCorrections({ detail: ATLANTIC_DAWN, docksDelayMs: 400 })

  renderDischargeDetail(ATLANTIC_DAWN.id)
  const sheet = await openEditSheet()
  const dock = within(sheet).getByRole('combobox', { name: 'Dock' })

  expect(within(sheet).getByRole('textbox', { name: 'Vessel name' })).toHaveValue(
    'MV Atlantic Dawn',
  )
  expect(dock).toHaveAttribute('aria-busy', 'true')
  expect(dock).toHaveValue(ATLANTIC_DAWN.dock.name)

  await waitFor(() => expect(dock).not.toHaveAttribute('aria-busy', 'true'))
  expect(dock).toHaveValue(ATLANTIC_DAWN.dock.name)
})
