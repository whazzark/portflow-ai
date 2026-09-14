import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import { API_BASE_URL } from '../support/fixtures'
import { renderUsers } from '../support/test-helpers'
import {
  mockRestorationRefused,
  mockUsersWithRestoration,
  startRestorationFromRecord,
} from './helpers'

const COMMENT = { name: 'Comment (optional)' }

test('names the user and what the restoration means before confirming', async () => {
  const user = userEvent.setup()
  mockUsersWithRestoration()

  renderUsers('/users?status=cancelled')
  const dialog = await startRestorationFromRecord(user)

  expect(within(dialog).getByRole('heading', { name: 'Restore invitation?' })).toBeInTheDocument()
  expect(
    within(dialog).getByText(/Élodie Fabre's invitation will be pending again/),
  ).toBeInTheDocument()
  expect(within(dialog).getByText(/valid for 7 days, will be shown once/)).toBeInTheDocument()
  expect(
    within(dialog).getByText(/Any link they were given before stays unusable/),
  ).toBeInTheDocument()
})

test('offers an optional comment of at most 1,000 characters', async () => {
  const user = userEvent.setup()
  mockUsersWithRestoration()

  renderUsers('/users?status=cancelled')
  const dialog = await startRestorationFromRecord(user)

  expect(within(dialog).getByRole('textbox', COMMENT)).toHaveAttribute('maxLength', '1000')
})

test('reads Cancel and Restore', async () => {
  const user = userEvent.setup()
  mockUsersWithRestoration()

  renderUsers('/users?status=cancelled')
  const dialog = await startRestorationFromRecord(user)

  const labels = within(dialog)
    .getAllByRole('button')
    .map((button) => button.textContent)
  expect(labels).toEqual(['Cancel', 'Restore'])
})

test('keeps the invitation cancelled and discards the comment when dismissed', async () => {
  const user = userEvent.setup()
  const { requests } = mockUsersWithRestoration()

  renderUsers('/users?status=cancelled')
  let dialog = await startRestorationFromRecord(user)
  await user.type(within(dialog).getByRole('textbox', COMMENT), 'Draft')
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(requests).toHaveLength(0)

  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restore' }))
  dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByRole('textbox', COMMENT)).toHaveValue('')
})

test('sends nothing when dismissed with Escape', async () => {
  const user = userEvent.setup()
  const { requests } = mockUsersWithRestoration()

  renderUsers('/users?status=cancelled')
  await startRestorationFromRecord(user)
  await user.keyboard('{Escape}')

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(requests).toHaveLength(0)
})

test('sends the typed comment', async () => {
  const user = userEvent.setup()
  const { requests } = mockUsersWithRestoration()

  renderUsers('/users?status=cancelled')
  const dialog = await startRestorationFromRecord(user)
  await user.type(within(dialog).getByRole('textbox', COMMENT), 'Start date confirmed.')
  await user.click(within(dialog).getByRole('button', { name: 'Restore' }))

  await waitFor(() => expect(requests).toHaveLength(1))
  expect(requests[0]).toEqual({ id: 'cancelled-1', body: { comment: 'Start date confirmed.' } })
})

test('sends a null comment when the field was left empty', async () => {
  const user = userEvent.setup()
  const { requests } = mockUsersWithRestoration()

  renderUsers('/users?status=cancelled')
  const dialog = await startRestorationFromRecord(user)
  await user.click(within(dialog).getByRole('button', { name: 'Restore' }))

  await waitFor(() => expect(requests).toHaveLength(1))
  expect(requests[0]).toEqual({ id: 'cancelled-1', body: { comment: null } })
})

test('shows the restoration in progress, locks the dialog, and refuses a second submission', async () => {
  const user = userEvent.setup()
  mockUsersWithRestoration()
  let calls = 0
  server.use(
    http.post(`${API_BASE_URL}/api/v1/users/:id/restore-invitation`, async () => {
      calls += 1
      await delay('infinite')

      return HttpResponse.json({})
    }),
  )

  renderUsers('/users?status=cancelled')
  const dialog = await startRestorationFromRecord(user)
  await user.click(within(dialog).getByRole('button', { name: 'Restore' }))

  const pending = await within(dialog).findByRole('button', { name: 'Restoring…' })
  expect(pending).toBeDisabled()
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(within(dialog).getByRole('textbox', COMMENT)).toBeDisabled()
  await user.click(pending)
  expect(calls).toBe(1)

  // The answer may carry the only working link: nothing dismisses the dialog while it is awaited.
  await user.keyboard('{Escape}')
  expect(screen.getByRole('alertdialog')).toBe(dialog)
})

test('shows why an over-long comment was refused, and keeps it to shorten', async () => {
  const user = userEvent.setup()
  mockUsersWithRestoration()
  mockRestorationRefused('E_VALIDATION_ERROR', 'Validation failure', 422, undefined, [
    { field: 'comment', message: 'The comment field must not be greater than 1000 characters' },
  ])

  renderUsers('/users?status=cancelled')
  const dialog = await startRestorationFromRecord(user)
  await user.type(within(dialog).getByRole('textbox', COMMENT), 'Too long, as the API says.')
  await user.click(within(dialog).getByRole('button', { name: 'Restore' }))

  expect(
    await screen.findByText('The comment field must not be greater than 1000 characters'),
  ).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toBe(dialog)
  expect(within(dialog).getByRole('textbox', COMMENT)).toHaveValue('Too long, as the API says.')
})
