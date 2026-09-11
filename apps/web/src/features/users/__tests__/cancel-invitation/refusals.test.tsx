import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, USERS } from '../support/fixtures'
import {
  mockCancellationRefused,
  mockUsersWithCancellation,
  renderUsers,
} from '../support/test-helpers'

// Started from the row menu, whose confirmation stays mounted whatever the refreshed collection
// says, so every refusal is read in place.
const confirmFromRowMenu = async () => {
  await screen.findByRole('table', { name: 'Pending users' })
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for Chloé Durand' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Cancel invitation' }))

  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel invitation' }))
}

test.each([
  [
    'E_USER_ALREADY_ACTIVATED',
    409,
    'This user has already activated their access. Deactivate them instead.',
  ],
  [
    'E_USER_ALREADY_DEACTIVATED',
    409,
    'This user activated their access and has since been deactivated. There is no invitation left to cancel.',
  ],
  [
    'E_USER_CANCELLED_INVITATION',
    409,
    'This invitation has already been cancelled by someone else.',
  ],
  ['E_USER_NOT_FOUND', 404, 'This user no longer exists.'],
])('explains a %s refusal in the administrator terms', async (code, status, sentence) => {
  mockUsersWithCancellation()
  mockCancellationRefused(code, 'API wording the workbench does not show', status)

  renderUsers('/users?status=pending')
  await confirmFromRowMenu()

  expect(
    await screen.findByText('Unable to cancel invitation for “Chloé Durand”'),
  ).toBeInTheDocument()
  expect(screen.getByText(sentence)).toBeInTheDocument()
  expect(screen.queryByText('API wording the workbench does not show')).not.toBeInTheDocument()
})

test('falls back to the API message for a refusal it has no sentence for', async () => {
  mockUsersWithCancellation()
  mockCancellationRefused('E_SOMETHING_NEW', 'Something new went wrong')

  renderUsers('/users?status=pending')
  await confirmFromRowMenu()

  expect(await screen.findByText('Something new went wrong')).toBeInTheDocument()
})

test('refreshes the collection after a refusal', async () => {
  let reads = 0
  mockUsersWithCancellation()
  mockCancellationRefused('E_USER_CANCELLED_INVITATION', 'Already cancelled')
  server.use(
    http.get(`${API_BASE_URL}/api/v1/users`, () => {
      reads += 1

      return HttpResponse.json({ data: USERS })
    }),
  )

  renderUsers('/users?status=pending')
  await confirmFromRowMenu()
  const readsBeforeRefusal = reads

  await screen.findByText('This invitation has already been cancelled by someone else.')
  await waitFor(() => expect(reads).toBeGreaterThan(readsBeforeRefusal))
})
