import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL } from '../support/fixtures'
import { mockUsersWithReactivation, renderUsers } from '../support/test-helpers'

const openDeactivatedRecord = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole('tab', { name: /Deactivated/ }))
  const table = await screen.findByRole('table', { name: 'Deactivated users' })
  await user.click(within(table).getByRole('button', { name: `View user ${name}` }))

  return screen.getByRole('dialog')
}

const confirmReactivation = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByRole('heading', { name: 'Reactivate user?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))
}

test('reactivates a deactivated user from the access record', async () => {
  const user = userEvent.setup()
  mockUsersWithReactivation()

  renderUsers()
  const record = await openDeactivatedRecord(user, 'David Évrard')

  await user.click(within(record).getByRole('button', { name: 'Reactivate' }))
  await confirmReactivation(user)

  expect(await screen.findByText('User “David Évrard” reactivated')).toBeInTheDocument()
})

test('closes the record and moves the user to the active view without a reload', async () => {
  const user = userEvent.setup()
  mockUsersWithReactivation()

  renderUsers()
  expect(await screen.findByRole('tab', { name: /Active \(2\)/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Deactivated \(1\)/ })).toBeInTheDocument()

  const record = await openDeactivatedRecord(user, 'David Évrard')
  await user.click(within(record).getByRole('button', { name: 'Reactivate' }))
  await confirmReactivation(user)

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('tab', { name: /Deactivated \(0\)/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Active \(3\)/ })).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /Active \(3\)/ }))
  const active = await screen.findByRole('table', { name: 'Active users' })
  expect(within(active).getByText('David Évrard')).toBeInTheDocument()
})

test('names the user and what the reactivation means before confirming', async () => {
  const user = userEvent.setup()
  mockUsersWithReactivation()

  renderUsers()
  const record = await openDeactivatedRecord(user, 'David Évrard')
  await user.click(within(record).getByRole('button', { name: 'Reactivate' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(/David Évrard/)).toBeInTheDocument()
  expect(within(dialog).getByText(/can sign in again/i)).toBeInTheDocument()
  expect(within(dialog).getByText(/must choose a new password/i)).toBeInTheDocument()
  // A user access status change records a date and an actor, never a comment.
  expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
})

test('leaves the user untouched when the confirmation is cancelled', async () => {
  const user = userEvent.setup()
  const { requests } = mockUsersWithReactivation()

  renderUsers()
  const record = await openDeactivatedRecord(user, 'David Évrard')
  await user.click(within(record).getByRole('button', { name: 'Reactivate' }))
  await screen.findByRole('heading', { name: 'Reactivate user?' })
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Reactivate' }),
  ).toBeInTheDocument()
  expect(requests).toEqual([])
})

test('shows the reactivation in flight and blocks a second submission', async () => {
  const user = userEvent.setup()
  let release: () => void = () => undefined
  let submissions = 0
  const { requests } = mockUsersWithReactivation()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/users/:id/reactivate`, async () => {
      submissions += 1
      await new Promise<void>((resolve) => {
        release = resolve
      })

      return HttpResponse.json(
        { error: { code: 'E_USER_ALREADY_ACTIVE', message: 'User is already active' } },
        { status: 409 },
      )
    }),
  )

  renderUsers()
  const record = await openDeactivatedRecord(user, 'David Évrard')
  await user.click(within(record).getByRole('button', { name: 'Reactivate' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  const pending = await within(dialog).findByRole('button', { name: 'Reactivating…' })
  expect(pending).toBeDisabled()
  await user.click(pending)

  release()
  await screen.findByText('Unable to reactivate user “David Évrard”')
  expect(submissions).toBe(1)
  expect(requests).toEqual([])
})

test('shows the outstanding renewal in the active view once reactivated', async () => {
  const user = userEvent.setup()
  mockUsersWithReactivation()

  renderUsers()
  const record = await openDeactivatedRecord(user, 'David Évrard')
  await user.click(within(record).getByRole('button', { name: 'Reactivate' }))
  await confirmReactivation(user)

  await waitFor(() => expect(screen.getByRole('tab', { name: /Active \(3\)/ })).toBeInTheDocument())
  await user.click(screen.getByRole('tab', { name: /Active \(3\)/ }))
  const active = await screen.findByRole('table', { name: 'Active users' })
  const row = within(active).getByText('David Évrard').closest('tr')

  if (!row) {
    throw new Error('Expected David Évrard to have a row in the active view')
  }
  expect(within(row).getByText('Renewal required')).toBeInTheDocument()
})

test('records the reactivation after the deactivation in the reopened record', async () => {
  const user = userEvent.setup()
  mockUsersWithReactivation()

  renderUsers()
  const record = await openDeactivatedRecord(user, 'David Évrard')
  await user.click(within(record).getByRole('button', { name: 'Reactivate' }))
  await confirmReactivation(user)

  await waitFor(() => expect(screen.getByRole('tab', { name: /Active \(3\)/ })).toBeInTheDocument())
  await user.click(screen.getByRole('tab', { name: /Active \(3\)/ }))
  const active = await screen.findByRole('table', { name: 'Active users' })
  await user.click(within(active).getByRole('button', { name: 'View user David Évrard' }))

  const reopened = screen.getByRole('dialog')
  const entries = within(within(reopened).getByRole('list', { name: 'Access history' }))
    .getAllByRole('listitem')
    .map((entry) => entry.textContent ?? '')
  const deactivated = entries.findIndex((entry) => entry.startsWith('Deactivated'))
  const reactivated = entries.findIndex((entry) => entry.startsWith('Reactivated'))
  expect(deactivated).toBeGreaterThanOrEqual(0)
  expect(reactivated).toBeGreaterThan(deactivated)
  expect(entries[reactivated]).toMatch(/Claire Martin/)
  expect(within(reopened).getByText('Renewal required')).toBeInTheDocument()
})
