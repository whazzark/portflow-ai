import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { mockUsersWithCancellation, renderUsers } from '../support/test-helpers'

const PENDING_USER = 'Chloé Durand'

const openPendingRecord = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  const table = await screen.findByRole('table', { name: 'Pending users' })
  await user.click(within(table).getByRole('button', { name: `View user ${name}` }))

  return screen.getByRole('dialog')
}

const cancelFromRecord = async (user: ReturnType<typeof userEvent.setup>, comment?: string) => {
  const record = await openPendingRecord(user, PENDING_USER)
  await user.click(within(record).getByRole('button', { name: 'Cancel invitation' }))

  const dialog = await screen.findByRole('alertdialog')
  if (comment !== undefined) {
    await user.type(within(dialog).getByRole('textbox', { name: 'Comment (optional)' }), comment)
  }
  await user.click(within(dialog).getByRole('button', { name: 'Cancel invitation' }))
}

test('cancels a pending invitation from the access record', async () => {
  const user = userEvent.setup()
  mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  await cancelFromRecord(user)

  expect(await screen.findByText('Invitation for “Chloé Durand” cancelled')).toBeInTheDocument()
})

test('stays on the pending view, closes the record, and follows both counts', async () => {
  const user = userEvent.setup()
  mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  expect(await screen.findByRole('tab', { name: /Pending \(1\)/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Cancelled \(1\)/ })).toBeInTheDocument()

  await cancelFromRecord(user)

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Pending \(0\)/ })).toBeInTheDocument(),
  )
  expect(screen.getByRole('tab', { name: /Cancelled \(2\)/ })).toBeInTheDocument()
  // No navigation: the view the administrator was working through is still the selected one.
  expect(screen.getByRole('tab', { name: /Pending \(0\)/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  await user.click(screen.getByRole('tab', { name: /Cancelled \(2\)/ }))
  const cancelled = await screen.findByRole('table', { name: 'Cancelled users' })
  expect(within(cancelled).getByText(PENDING_USER)).toBeInTheDocument()
})

test('records the cancellation in the access history the reopened record shows', async () => {
  const user = userEvent.setup()
  mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  await cancelFromRecord(user)

  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Cancelled \(2\)/ })).toBeInTheDocument(),
  )
  await user.click(screen.getByRole('tab', { name: /Cancelled \(2\)/ }))
  const table = await screen.findByRole('table', { name: 'Cancelled users' })
  await user.click(within(table).getByRole('button', { name: `View user ${PENDING_USER}` }))

  const reopened = screen.getByRole('dialog')
  const history = within(reopened).getByRole('list', { name: 'Access history' })
  expect(within(history).getByText('Invited')).toBeInTheDocument()
  expect(within(history).getByText('Cancelled')).toBeInTheDocument()
  expect(within(history).getByText('by Claire Martin')).toBeInTheDocument()
  // The cancelled record offers no second cancellation.
  expect(
    within(reopened).queryByRole('button', { name: 'Cancel invitation' }),
  ).not.toBeInTheDocument()
})

const reopenFromCancelledView = async (user: ReturnType<typeof userEvent.setup>) => {
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Cancelled \(2\)/ })).toBeInTheDocument(),
  )
  await user.click(screen.getByRole('tab', { name: /Cancelled \(2\)/ }))
  const table = await screen.findByRole('table', { name: 'Cancelled users' })
  await user.click(within(table).getByRole('button', { name: `View user ${PENDING_USER}` }))

  return within(screen.getByRole('dialog')).getByRole('list', { name: 'Access history' })
}

test('shows the comment under the cancellation in the access history', async () => {
  const user = userEvent.setup()
  mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  await cancelFromRecord(user, '  Hired elsewhere.  ')

  const history = await reopenFromCancelledView(user)
  expect(within(history).getByText('“Hired elsewhere.”')).toBeInTheDocument()
})

test('shows no comment line when the cancellation carried none', async () => {
  const user = userEvent.setup()
  mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  await cancelFromRecord(user)

  const history = await reopenFromCancelledView(user)
  expect(within(history).queryByText(/^“.*”$/)).not.toBeInTheDocument()
})
