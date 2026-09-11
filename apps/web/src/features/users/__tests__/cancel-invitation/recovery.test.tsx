import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL } from '../support/fixtures'
import {
  mockCancellationRefused,
  mockCancellationUnreachable,
  mockUsersWithCancellation,
  renderUsers,
} from '../support/test-helpers'

const confirmWithComment = async (user: ReturnType<typeof userEvent.setup>, comment: string) => {
  const table = await screen.findByRole('table', { name: 'Pending users' })
  await user.click(within(table).getByRole('button', { name: 'View user Chloé Durand' }))
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel invitation' }),
  )

  const dialog = await screen.findByRole('alertdialog')
  await user.type(within(dialog).getByRole('textbox', { name: 'Comment (optional)' }), comment)
  await user.click(within(dialog).getByRole('button', { name: 'Cancel invitation' }))

  return dialog
}

test('keeps the confirmation and the comment when the API is unreachable, then retries', async () => {
  const user = userEvent.setup()
  const { requests } = mockUsersWithCancellation()
  mockCancellationUnreachable()

  renderUsers('/users?status=pending')
  const dialog = await confirmWithComment(user, 'Hired elsewhere.')

  expect(
    await screen.findByText('Unable to cancel invitation for “Chloé Durand”'),
  ).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(within(dialog).getByRole('textbox', { name: 'Comment (optional)' })).toHaveValue(
    'Hired elsewhere.',
  )
  const confirm = within(dialog).getByRole('button', { name: 'Cancel invitation' })
  expect(confirm).toBeEnabled()

  // The API is back: the same click, from the same dialog, goes through exactly once.
  server.resetHandlers()
  const recovered = mockUsersWithCancellation()
  await user.click(confirm)

  expect(await screen.findByText('Invitation for “Chloé Durand” cancelled')).toBeInTheDocument()
  expect(recovered.requests).toEqual([{ id: 'pending-1', body: { comment: 'Hired elsewhere.' } }])
  expect(requests).toHaveLength(0)
})

test('keeps the confirmation and the comment on a server error', async () => {
  const user = userEvent.setup()
  mockUsersWithCancellation()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/users/:id/cancel-invitation`, () =>
      HttpResponse.json(
        { error: { code: 'E_INTERNAL', message: 'Something went wrong' } },
        { status: 500 },
      ),
    ),
  )

  renderUsers('/users?status=pending')
  const dialog = await confirmWithComment(user, 'Hired elsewhere.')

  expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
  expect(within(dialog).getByRole('textbox', { name: 'Comment (optional)' })).toHaveValue(
    'Hired elsewhere.',
  )
  expect(within(dialog).getByRole('button', { name: 'Cancel invitation' })).toBeEnabled()
})

test('keeps the comment and shows the field-level reason on a validation refusal', async () => {
  const user = userEvent.setup()
  mockUsersWithCancellation()
  mockCancellationRefused('E_VALIDATION_ERROR', 'Validation failure', 422, [
    {
      field: 'comment',
      message: 'The comment field must not be greater than 1000 characters',
      rule: 'maxLength',
    },
  ])

  renderUsers('/users?status=pending')
  const dialog = await confirmWithComment(user, 'Too long, as far as the API is concerned.')

  expect(
    await screen.findByText('The comment field must not be greater than 1000 characters'),
  ).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument())
  expect(within(dialog).getByRole('textbox', { name: 'Comment (optional)' })).toHaveValue(
    'Too long, as far as the API is concerned.',
  )
})
