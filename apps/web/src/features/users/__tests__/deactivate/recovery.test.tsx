import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import {
  mockDeactivationUnreachable,
  mockUsersWithDeactivation,
  renderUsers,
} from '../support/test-helpers'

test('reports a retryable failure and changes nothing when the API is unreachable', async () => {
  const user = userEvent.setup()
  mockUsersWithDeactivation()
  mockDeactivationUnreachable()

  renderUsers()
  const table = await screen.findByRole('table', { name: 'Active users' })
  await user.click(within(table).getByRole('button', { name: 'View user Amélie Bernard' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }))
  await screen.findByRole('heading', { name: 'Deactivate user?' })
  await user.click(screen.getByRole('button', { name: 'Deactivate' }))

  expect(await screen.findByText('Unable to deactivate user “Amélie Bernard”')).toBeInTheDocument()
  expect(await screen.findByText(/check your connection/i)).toBeInTheDocument()
  // Nothing was recorded, so the confirmation is still there to retry from.
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.queryByText('User “Amélie Bernard” deactivated')).not.toBeInTheDocument(),
  )
})
