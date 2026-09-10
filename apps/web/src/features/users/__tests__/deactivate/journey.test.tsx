import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { mockUsersWithDeactivation, renderUsers } from '../support/test-helpers'

const openActiveRecord = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  const table = await screen.findByRole('table', { name: 'Active users' })
  await user.click(within(table).getByRole('button', { name: `View user ${name}` }))

  return screen.getByRole('dialog')
}

test('deactivates an active user from the access record', async () => {
  const user = userEvent.setup()
  mockUsersWithDeactivation()

  renderUsers()
  const record = await openActiveRecord(user, 'Amélie Bernard')

  await user.click(within(record).getByRole('button', { name: 'Deactivate' }))
  await screen.findByRole('heading', { name: 'Deactivate user?' })
  await user.click(screen.getByRole('button', { name: 'Deactivate' }))

  expect(await screen.findByText('User “Amélie Bernard” deactivated')).toBeInTheDocument()
})

test('names the user and what the deactivation means before confirming', async () => {
  const user = userEvent.setup()
  mockUsersWithDeactivation()

  renderUsers()
  const record = await openActiveRecord(user, 'Amélie Bernard')
  await user.click(within(record).getByRole('button', { name: 'Deactivate' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(/Amélie Bernard/)).toBeInTheDocument()
  expect(within(dialog).getByText(/no longer sign in/i)).toBeInTheDocument()
  expect(within(dialog).getByText(/stays visible and attributed/i)).toBeInTheDocument()
  // A user access status change records a date and an actor, never a comment.
  expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
})

test('leaves the user untouched when the confirmation is cancelled', async () => {
  const user = userEvent.setup()
  mockUsersWithDeactivation()

  renderUsers()
  const record = await openActiveRecord(user, 'Amélie Bernard')
  await user.click(within(record).getByRole('button', { name: 'Deactivate' }))
  await screen.findByRole('heading', { name: 'Deactivate user?' })
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  // The record sheet is modal, so the tabs behind it are out of the accessibility tree while it is
  // open: what a cancellation is observable as here is the record still offering the action.
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }),
  ).toBeInTheDocument()
  expect(screen.queryByText('User “Amélie Bernard” deactivated')).not.toBeInTheDocument()
})

test('moves the user to the deactivated view and follows both counts without a reload', async () => {
  const user = userEvent.setup()
  mockUsersWithDeactivation()

  renderUsers()
  expect(await screen.findByRole('tab', { name: /Active \(2\)/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Deactivated \(1\)/ })).toBeInTheDocument()

  const record = await openActiveRecord(user, 'Amélie Bernard')
  await user.click(within(record).getByRole('button', { name: 'Deactivate' }))
  await screen.findByRole('heading', { name: 'Deactivate user?' })
  await user.click(screen.getByRole('button', { name: 'Deactivate' }))

  await waitFor(() => expect(screen.getByRole('tab', { name: /Active \(1\)/ })).toBeInTheDocument())
  expect(screen.getByRole('tab', { name: /Deactivated \(2\)/ })).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /Deactivated \(2\)/ }))
  const deactivated = await screen.findByRole('table', { name: 'Deactivated users' })
  expect(within(deactivated).getByText('Amélie Bernard')).toBeInTheDocument()
})

test('closes the record once its user has left the visible view', async () => {
  const user = userEvent.setup()
  mockUsersWithDeactivation()

  renderUsers()
  const record = await openActiveRecord(user, 'Amélie Bernard')
  await user.click(within(record).getByRole('button', { name: 'Deactivate' }))
  await screen.findByRole('heading', { name: 'Deactivate user?' })
  await user.click(screen.getByRole('button', { name: 'Deactivate' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

test('records the deactivation in the access history the reopened record shows', async () => {
  const user = userEvent.setup()
  mockUsersWithDeactivation()

  renderUsers()
  const record = await openActiveRecord(user, 'Amélie Bernard')
  await user.click(within(record).getByRole('button', { name: 'Deactivate' }))
  await screen.findByRole('heading', { name: 'Deactivate user?' })
  await user.click(screen.getByRole('button', { name: 'Deactivate' }))

  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Deactivated \(2\)/ })).toBeInTheDocument(),
  )
  await user.click(screen.getByRole('tab', { name: /Deactivated \(2\)/ }))
  const table = await screen.findByRole('table', { name: 'Deactivated users' })
  await user.click(within(table).getByRole('button', { name: 'View user Amélie Bernard' }))

  const reopened = screen.getByRole('dialog')
  const history = within(reopened).getByRole('list', { name: 'Access history' })
  expect(within(history).getByText(/Deactivated/)).toBeInTheDocument()
  expect(within(history).getByText(/Claire Martin/)).toBeInTheDocument()
})
