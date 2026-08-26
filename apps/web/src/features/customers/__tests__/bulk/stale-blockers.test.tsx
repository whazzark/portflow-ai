import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

/**
 * A stale blocker is one the customer collection cannot explain on its own: the server refused the
 * customer without returning a refreshed DTO for it. The outcome still has to leave that customer
 * selected and retryable, and has to name why it was refused.
 */
test.each([
  ['NOT_FOUND', 'not found'],
  ['ALREADY_ARCHIVED', 'already archived'],
] as const)('keeps a stale %s blocker selected and retryable', async (reason, reasonLabel) => {
  let attempts = 0

  mockCustomers()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/customers/archive`, () => {
      attempts += 1
      return HttpResponse.json({
        data: {
          updatedCustomers: [],
          blockedCustomers: [
            { id: 'available-1', code: reason === 'NOT_FOUND' ? undefined : 'AVAIL-01', reason },
          ],
        },
      })
    }),
  )

  renderCustomers()
  const table = await screen.findByRole('table', { name: 'Available customers' })
  fireEvent.click(within(table).getByRole('checkbox', { name: 'Select all available customers' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument(),
  )

  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Archive' }),
  )

  // The outcome names the reason rather than leaving the administrator to guess it.
  expect(await screen.findByText(new RegExp(reasonLabel))).toBeInTheDocument()

  // The toolbar stays up with only the blocked customer selected, so its own button is the retry.
  await waitFor(() => expect(screen.getByText('1 selected')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Archive' }),
  )

  await waitFor(() => expect(attempts).toBe(2))

  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument(),
  )
})
