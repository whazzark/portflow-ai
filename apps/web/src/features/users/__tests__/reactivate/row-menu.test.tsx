import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { mockUsersWithReactivation, renderUsers } from '../support/test-helpers'

// The menu is portaled out of the table, so its items are queried from `screen` rather than through
// the row — which the directory re-renders underneath them.
const openRowMenu = async (name: string, table: string) => {
  await screen.findByRole('table', { name: table })
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
  await screen.findByRole('menu')
}

const openStatusView = async (user: ReturnType<typeof userEvent.setup>, view: string) => {
  await user.click(await screen.findByRole('tab', { name: new RegExp(view) }))
}

test('ends a deactivated row menu with the reactivation, not styled as destructive', async () => {
  const user = userEvent.setup()
  mockUsersWithReactivation()

  renderUsers()
  await openStatusView(user, 'Deactivated')
  await openRowMenu('David Évrard', 'Deactivated users')

  const items = screen.getAllByRole('menuitem')
  expect(items.at(-1)?.textContent).toBe('Reactivate')
  expect(screen.getByRole('menuitem', { name: 'Reactivate' })).toHaveAttribute(
    'data-variant',
    'default',
  )
})

test('reactivates a user from its row without opening the record', async () => {
  const user = userEvent.setup()
  mockUsersWithReactivation()

  renderUsers()
  await openStatusView(user, 'Deactivated')
  await openRowMenu('David Évrard', 'Deactivated users')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Reactivate' }))

  // The confirmation is the one the record footer uses, down to the sentence it makes.
  const confirmation = await screen.findByRole('alertdialog')
  expect(
    within(confirmation).getByRole('heading', { name: 'Reactivate user?' }),
  ).toBeInTheDocument()
  expect(within(confirmation).getByText(/David Évrard/)).toBeInTheDocument()
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('User “David Évrard” reactivated')).toBeInTheDocument()
  // The record sheet was never opened: the row menu is enough on its own.
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Deactivated \(0\)/ })).toBeInTheDocument(),
  )
})

test.each([
  ['Active', 'Amélie Bernard'],
  ['Pending', 'Chloé Durand'],
  ['Cancelled', 'Élodie Fabre'],
])('does not offer it on an %s row', async (view, name) => {
  const user = userEvent.setup()
  mockUsersWithReactivation()

  renderUsers()
  await openStatusView(user, view)
  await openRowMenu(name, `${view} users`)

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Reactivate' })).not.toBeInTheDocument()
})
