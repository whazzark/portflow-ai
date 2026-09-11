import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import {
  mockCancellationLostRace,
  mockUsersWithCancellation,
  renderUsers,
} from '../support/test-helpers'

// The menu is portaled out of the table, so its items are queried from `screen` rather than through
// the row — which the directory re-renders underneath them.
const openRowMenu = async (name: string) => {
  await screen.findByRole('table', { name: 'Pending users' })
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
  await screen.findByRole('menu')
}

test('cancels an invitation from its row without opening the record', async () => {
  const { requests } = mockUsersWithCancellation()

  renderUsers('/users?status=pending')
  await openRowMenu('Chloé Durand')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Cancel invitation' }))

  // The same confirmation as the record footer's.
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByRole('heading', { name: 'Cancel invitation?' })).toBeInTheDocument()
  expect(within(dialog).getByRole('textbox', { name: 'Comment (optional)' })).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Keep invitation' })).toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel invitation' }))

  expect(await screen.findByText('Invitation for “Chloé Durand” cancelled')).toBeInTheDocument()
  expect(requests).toHaveLength(1)
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Pending \(0\)/ })).toBeInTheDocument(),
  )
  expect(screen.getByRole('tab', { name: /Cancelled \(2\)/ })).toBeInTheDocument()
})

test('keeps the row confirmation open with the reason when someone else cancelled first', async () => {
  mockCancellationLostRace('pending-1')

  renderUsers('/users?status=pending')
  await openRowMenu('Chloé Durand')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Cancel invitation' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel invitation' }))

  expect(
    await screen.findByText('This invitation has already been cancelled by someone else.'),
  ).toBeInTheDocument()
  // The refreshed collection agrees with the refusal: the user has left the pending view.
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Pending \(0\)/ })).toBeInTheDocument(),
  )
  expect(screen.getByRole('tab', { name: /Cancelled \(2\)/ })).toBeInTheDocument()
})
