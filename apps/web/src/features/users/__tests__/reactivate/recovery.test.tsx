import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import {
  mockReactivationUnreachable,
  mockUsersWithReactivation,
  renderUsers,
} from '../support/test-helpers'

const confirmReactivation = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('tab', { name: /Deactivated/ }))
  const table = await screen.findByRole('table', { name: 'Deactivated users' })
  await user.click(within(table).getByRole('button', { name: 'View user David Évrard' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reactivate' }))
  await screen.findByRole('heading', { name: 'Reactivate user?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))
}

test('reports a retryable failure and changes nothing when the API is unreachable', async () => {
  const user = userEvent.setup()
  mockUsersWithReactivation()
  mockReactivationUnreachable()

  renderUsers()
  await confirmReactivation(user)

  expect(await screen.findByText('Unable to reactivate user “David Évrard”')).toBeInTheDocument()
  expect(await screen.findByText(/check your connection/i)).toBeInTheDocument()
  // Nothing was recorded, so the confirmation is still there to retry from.
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(screen.queryByText('User “David Évrard” reactivated')).not.toBeInTheDocument()
})

test('reactivates the user exactly once when retried after the API is back', async () => {
  const user = userEvent.setup()
  mockUsersWithReactivation()
  mockReactivationUnreachable()

  renderUsers()
  await confirmReactivation(user)
  await screen.findByText('Unable to reactivate user “David Évrard”')

  // The API is reachable again: the collection handler, with its reactivation, is registered afresh.
  const { requests } = mockUsersWithReactivation()
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reactivate' }),
  )

  expect(await screen.findByText('User “David Évrard” reactivated')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Deactivated \(0\)/ })).toBeInTheDocument(),
  )
  expect(requests).toEqual(['deactivated-1'])
})
