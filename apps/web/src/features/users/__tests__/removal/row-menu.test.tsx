import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { mockUsersWithRemoval, renderUsers } from '../support/test-helpers'

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

test.each([
  ['Pending', 'Chloé Durand'],
  ['Cancelled', 'Élodie Fabre'],
])('ends a %s row menu with the removal', async (view, name) => {
  const user = userEvent.setup()
  mockUsersWithRemoval()

  renderUsers()
  await openStatusView(user, view)
  await openRowMenu(name, `${view} users`)

  const items = screen.getAllByRole('menuitem').map((item) => item.textContent)
  expect(items.at(-1)).toBe('Remove')
  expect(screen.queryByRole('menuitem', { name: 'Deactivate' })).not.toBeInTheDocument()
})

test('removes a user from its row in three interactions, without opening the record', async () => {
  const user = userEvent.setup()
  mockUsersWithRemoval()

  renderUsers()
  await openStatusView(user, 'Pending')
  await openRowMenu('Chloé Durand', 'Pending users')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }))

  // The confirmation is the one the record footer uses, down to the sentence it makes.
  const confirmation = await screen.findByRole('alertdialog')
  expect(within(confirmation).getByRole('heading', { name: 'Remove user?' })).toBeInTheDocument()
  expect(within(confirmation).getByText(/Chloé Durand/)).toBeInTheDocument()
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Remove' }))

  expect(await screen.findByText('User “Chloé Durand” removed')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  // The record sheet was never opened: the row menu is enough on its own.
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Pending \(0\)/ })).toBeInTheDocument(),
  )
})
