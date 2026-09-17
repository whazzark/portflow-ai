import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { startableDetail } from '../support/fixtures'
import {
  allowFormJourneyTime,
  type DischargeWriteAnswer,
  mockDischargeStart,
  renderDischargeDetail,
} from '../support/test-helpers'

allowFormJourneyTime()

const refusal = (status: number, code: string): DischargeWriteAnswer => ({
  status,
  body: { error: { code, message: code } },
})

test.each([
  [409, 'E_DISCHARGE_NOT_PLANNED', 'This discharge has already started'],
  [404, 'E_DISCHARGE_NOT_FOUND', 'This discharge has already started'],
  [403, 'E_AUTHORIZATION_FAILURE', 'You are not allowed to start discharges'],
])('closes the review when the start answers %i %s', async (status, code, message) => {
  const detail = startableDetail()
  const state = mockDischargeStart({ detail, respondToStart: () => refusal(status, code) })
  renderDischargeDetail(detail.id)

  fireEvent.click(await screen.findByRole('button', { name: 'Start' }))
  const dialog = await screen.findByRole('dialog', { name: 'Start MV Atlantic Dawn' })
  const confirm = within(dialog).getByRole('button', { name: 'Start discharge' })
  await waitFor(() => expect(confirm).toBeEnabled())
  const detailRequests = state.detailRequests
  if (code === 'E_DISCHARGE_NOT_PLANNED') {
    // Another tab started it: the refreshed detail is the active one.
    state.current = { ...state.current, status: 'ACTIVE', startedAt: '2026-10-04T05:47:00.000Z' }
  }

  fireEvent.click(confirm)

  expect(await screen.findByText(message)).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  if (code !== 'E_AUTHORIZATION_FAILURE') {
    await waitFor(() => expect(state.detailRequests).toBeGreaterThan(detailRequests))
  }
  if (code === 'E_DISCHARGE_NOT_PLANNED') {
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument(),
    )
  }
})

test.each([
  [409, 'E_DISCHARGE_NOT_PLANNED', 'This discharge has already started'],
  [404, 'E_DISCHARGE_NOT_FOUND', 'This discharge has already started'],
])('closes the review when the check answers %i %s', async (status, code, message) => {
  const detail = startableDetail()
  mockDischargeStart({ detail, respondToCheck: () => refusal(status, code) })
  renderDischargeDetail(detail.id)

  fireEvent.click(await screen.findByRole('button', { name: 'Start' }))

  expect(await screen.findByText(message)).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
