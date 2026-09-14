import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { renderUsers } from '../support/test-helpers'
import { CANCELLED_USER, mockUsersWithRestoration, NEW_LINK, openCancelledRowMenu } from './helpers'

test('offers the restoration in a cancelled row menu, between Edit and Remove', async () => {
  mockUsersWithRestoration()

  renderUsers('/users?status=cancelled')
  await openCancelledRowMenu(CANCELLED_USER)

  const items = screen.getAllByRole('menuitem').map((item) => item.textContent)
  expect(items).toEqual(['View', 'Edit', 'Restore', 'Remove'])
})

test.each([
  ['active', 'Amélie Bernard'],
  ['pending', 'Chloé Durand'],
  ['deactivated', 'David Évrard'],
])('never offers it in a %s row menu', async (view, name) => {
  mockUsersWithRestoration()

  renderUsers(`/users?status=${view}`)
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
  await screen.findByRole('menu')

  expect(screen.queryByRole('menuitem', { name: 'Restore' })).not.toBeInTheDocument()
})

test('restores from the row menu with the same confirmation, and the link outlives the row', async () => {
  const user = userEvent.setup()
  const { requests } = mockUsersWithRestoration()

  renderUsers('/users?status=cancelled')
  await openCancelledRowMenu(CANCELLED_USER)
  await user.click(screen.getByRole('menuitem', { name: 'Restore' }))

  const confirmation = await screen.findByRole('alertdialog')
  expect(
    within(confirmation).getByRole('heading', { name: 'Restore invitation?' }),
  ).toBeInTheDocument()
  await user.click(within(confirmation).getByRole('button', { name: 'Restore' }))

  expect(await screen.findByTestId('activation-link')).toHaveTextContent(NEW_LINK)
  expect(requests).toEqual([{ id: 'cancelled-1', body: { comment: null } }])

  // The refresh drops the row the menu hung from; the outcome, held by the page, stays. The page
  // behind the modal outcome is hidden from the accessibility tree, hence `hidden: true`.
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: `Actions for ${CANCELLED_USER}`, hidden: true }),
    ).not.toBeInTheDocument(),
  )
  expect(screen.getByTestId('activation-link')).toHaveTextContent(NEW_LINK)

  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Done' }))
  await user.click(screen.getByRole('tab', { name: /Pending \(2\)/ }))
  const pending = await screen.findByRole('table', { name: 'Pending users' })
  expect(within(pending).getByText(CANCELLED_USER)).toBeInTheDocument()
})
