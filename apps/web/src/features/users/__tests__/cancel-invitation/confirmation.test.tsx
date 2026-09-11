import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL } from '../support/fixtures'
import { mockUsersWithCancellation, renderUsers } from '../support/test-helpers'

const openConfirmation = async (user: ReturnType<typeof userEvent.setup>) => {
  const table = await screen.findByRole('table', { name: 'Pending users' })
  await user.click(within(table).getByRole('button', { name: 'View user Chloé Durand' }))
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel invitation' }),
  )

  return screen.findByRole('alertdialog')
}

test('names the user and what the cancellation means before confirming', async () => {
  const user = userEvent.setup()
  mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  const dialog = await openConfirmation(user)

  expect(within(dialog).getByRole('heading', { name: 'Cancel invitation?' })).toBeInTheDocument()
  expect(within(dialog).getByText(/Chloé Durand/)).toBeInTheDocument()
  expect(within(dialog).getByText(/no longer be able to activate their access/)).toBeInTheDocument()
  expect(within(dialog).getByText(/stops working immediately/)).toBeInTheDocument()
})

test('offers an optional comment of at most 1,000 characters', async () => {
  const user = userEvent.setup()
  mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  const dialog = await openConfirmation(user)

  const comment = within(dialog).getByRole('textbox', { name: 'Comment (optional)' })
  expect(comment).toHaveAttribute('maxLength', '1000')
})

test('reads Keep invitation and Cancel invitation, and no other button starts with Cancel', async () => {
  const user = userEvent.setup()
  mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  const dialog = await openConfirmation(user)

  const labels = within(dialog)
    .getAllByRole('button')
    .map((button) => button.textContent)
  expect(labels).toContain('Keep invitation')
  expect(labels).toContain('Cancel invitation')
  expect(labels.filter((label) => label?.startsWith('Cancel'))).toEqual(['Cancel invitation'])
})

test('keeps the invitation and discards the comment when dismissed', async () => {
  const user = userEvent.setup()
  const { requests } = mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  let dialog = await openConfirmation(user)
  await user.type(within(dialog).getByRole('textbox', { name: 'Comment (optional)' }), 'Draft')
  await user.click(within(dialog).getByRole('button', { name: 'Keep invitation' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(requests).toHaveLength(0)

  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel invitation' }),
  )
  dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByRole('textbox', { name: 'Comment (optional)' })).toHaveValue('')
})

test('sends nothing when dismissed with Escape', async () => {
  const user = userEvent.setup()
  const { requests } = mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  await openConfirmation(user)
  await user.keyboard('{Escape}')

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(requests).toHaveLength(0)
})

test('sends the typed comment, or null when the field is empty', async () => {
  const user = userEvent.setup()
  const { requests } = mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  const dialog = await openConfirmation(user)
  await user.type(
    within(dialog).getByRole('textbox', { name: 'Comment (optional)' }),
    'Hired elsewhere.',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Cancel invitation' }))

  await waitFor(() => expect(requests).toHaveLength(1))
  expect(requests[0]).toEqual({ id: 'pending-1', body: { comment: 'Hired elsewhere.' } })
})

test('sends a null comment when the field was left empty', async () => {
  const user = userEvent.setup()
  const { requests } = mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  const dialog = await openConfirmation(user)
  await user.click(within(dialog).getByRole('button', { name: 'Cancel invitation' }))

  await waitFor(() => expect(requests).toHaveLength(1))
  expect(requests[0]).toEqual({ id: 'pending-1', body: { comment: null } })
})

test('shows the cancellation in progress, freezes the comment, and refuses a second submission', async () => {
  const user = userEvent.setup()
  mockUsersWithCancellation()
  let calls = 0
  server.use(
    http.post(`${API_BASE_URL}/api/v1/users/:id/cancel-invitation`, async () => {
      calls += 1
      await delay('infinite')

      return HttpResponse.json({})
    }),
  )

  renderUsers('/users?status=pending')
  const dialog = await openConfirmation(user)
  await user.click(within(dialog).getByRole('button', { name: 'Cancel invitation' }))

  const pending = await within(dialog).findByRole('button', { name: 'Cancelling…' })
  expect(pending).toBeDisabled()
  expect(within(dialog).getByRole('textbox', { name: 'Comment (optional)' })).toBeDisabled()
  await user.click(pending)
  expect(calls).toBe(1)
})

test('leaves the deactivation confirmation as it was', async () => {
  const user = userEvent.setup()
  mockUsersWithCancellation()

  renderUsers()
  const table = await screen.findByRole('table', { name: 'Active users' })
  await user.click(within(table).getByRole('button', { name: 'View user Amélie Bernard' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
})
