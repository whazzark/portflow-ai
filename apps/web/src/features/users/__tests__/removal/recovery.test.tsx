import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { mockRemovalUnreachable, mockUsersWithRemoval, renderUsers } from '../support/test-helpers'

const confirmRemoval = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('tab', { name: /Pending/ }))
  const table = await screen.findByRole('table', { name: 'Pending users' })
  await user.click(within(table).getByRole('button', { name: 'View user Chloé Durand' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
  await screen.findByRole('heading', { name: 'Remove user?' })
  await user.click(screen.getByRole('button', { name: 'Remove' }))
}

test('reports a retryable failure and removes nothing when the API is unreachable', async () => {
  const user = userEvent.setup()
  mockUsersWithRemoval()
  mockRemovalUnreachable()

  renderUsers()
  await confirmRemoval(user)

  expect(await screen.findByText('Unable to remove user “Chloé Durand”')).toBeInTheDocument()
  expect(await screen.findByText(/check your connection/i)).toBeInTheDocument()
  // Nothing was removed, so the confirmation is still there to retry from, over a listed user. The
  // record sheet is modal, which takes the tabs behind it out of the accessibility tree.
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Pending \(1\)/, hidden: true })).toBeInTheDocument()
  expect(screen.queryByText('User “Chloé Durand” removed')).not.toBeInTheDocument()
})

test('removes the user exactly once when retried after the API is back', async () => {
  const user = userEvent.setup()
  mockUsersWithRemoval()
  mockRemovalUnreachable()

  renderUsers()
  await confirmRemoval(user)
  await screen.findByText('Unable to remove user “Chloé Durand”')

  // The API is reachable again: the collection handler, with its removal, is registered afresh.
  mockUsersWithRemoval()
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }))

  expect(await screen.findByText('User “Chloé Durand” removed')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Pending \(0\)/ })).toBeInTheDocument(),
  )
  expect(screen.queryByText(/no longer exists/i)).not.toBeInTheDocument()
})
