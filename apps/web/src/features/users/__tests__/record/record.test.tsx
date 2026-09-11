import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ACTIVE_USERS_WITHOUT_LIFECYCLE, OPERATIONS_ADMIN, USERS } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'

const openRecordFor = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  const table = await screen.findByRole('table', { name: 'Active users' })
  await user.click(within(table).getByRole('button', { name: `View user ${name}` }))

  return screen.getByRole('dialog')
}

test('shows identity, role, and access status from the retrieved collection', async () => {
  const user = userEvent.setup()
  mockUsers()

  renderUsers()
  const record = await openRecordFor(user, 'Amélie Bernard')

  expect(within(record).getByRole('heading', { name: /Amélie Bernard/ })).toBeInTheDocument()
  expect(within(record).getByText('amelie.bernard@portflow.test')).toBeInTheDocument()
  expect(within(record).getByText('Organization admin')).toBeInTheDocument()
  expect(within(record).getByText('Active')).toBeInTheDocument()
})

test('holds the open record in the URL', async () => {
  const user = userEvent.setup()
  mockUsers()

  const { router } = renderUsers()
  await openRecordFor(user, 'Amélie Bernard')

  expect(router.state.location.search).toMatchObject({ userId: 'active-1' })
})

test('presents the recorded lifecycle events oldest first with their responsible administrator', async () => {
  const user = userEvent.setup()
  mockUsers()

  renderUsers()
  const record = await openRecordFor(user, 'Amélie Bernard')
  const history = within(record).getByRole('list', { name: 'Access history' })
  const events = within(history).getAllByRole('listitem')

  expect(events).toHaveLength(2)
  expect(events[0]).toHaveTextContent('Invited')
  expect(events[0]).toHaveTextContent('Yann Le Goff')
  expect(events[1]).toHaveTextContent('Activated')
})

test('keeps an event whose responsible administrator was never recorded', async () => {
  const user = userEvent.setup()
  mockUsers()

  renderUsers()
  const record = await openRecordFor(user, 'Amélie Bernard')
  const history = within(record).getByRole('list', { name: 'Access history' })
  const activated = within(history).getAllByRole('listitem')[1]

  expect(activated).toHaveTextContent('Activated')
  expect(activated).not.toHaveTextContent('Yann Le Goff')
})

test('omits an unrecorded lifecycle event rather than showing it blank', async () => {
  const user = userEvent.setup()
  mockUsers()

  renderUsers()
  const record = await openRecordFor(user, 'Amélie Bernard')
  const history = within(record).getByRole('list', { name: 'Access history' })

  expect(within(history).queryByText(/Cancelled/)).not.toBeInTheDocument()
  expect(within(history).queryByText(/Deactivated/)).not.toBeInTheDocument()
  expect(within(history).queryByText(/Reactivated/)).not.toBeInTheDocument()
  expect(within(history).queryByText('Not specified')).not.toBeInTheDocument()
})

// Deactivation was added to this record by GH-20 and is covered by `../deactivate/`; the edit
// (identity correction, GH-24, and role change, GH-28) is covered by `../identity/` and
// `../role-change/`, and is not an access action anyway. Every other access action still belongs
// to a slice that has not shipped, and the record must not grow one by accident.
test('offers no access action but the deactivation', async () => {
  const user = userEvent.setup()
  mockUsers()

  renderUsers()
  const record = await openRecordFor(user, 'Amélie Bernard')

  for (const action of [
    /invite/i,
    /cancel/i,
    /reactivate/i,
    /change role/i,
    /delete/i,
    /remove/i,
  ]) {
    expect(within(record).queryByRole('button', { name: action })).not.toBeInTheDocument()
  }
})

test('opens the record without issuing another consultation request', async () => {
  const user = userEvent.setup()
  mockUsers()
  const requests = vi.fn()
  const { server } = await import('@/test/msw/server')
  server.events.on('request:start', ({ request }) => {
    if (new URL(request.url).pathname === '/api/v1/users') {
      requests()
    }
  })

  renderUsers()
  await screen.findByRole('table', { name: 'Active users' })
  const before = requests.mock.calls.length

  await openRecordFor(user, 'Amélie Bernard')

  expect(requests.mock.calls.length).toBe(before)
  server.events.removeAllListeners()
})

test('carries no lifecycle block for an operations admin', async () => {
  const user = userEvent.setup()
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  const record = await openRecordFor(user, 'Amélie Bernard')

  expect(within(record).getByText('Organization admin')).toBeInTheDocument()
  expect(within(record).queryByRole('list', { name: 'Access history' })).not.toBeInTheDocument()
})

test('closes the record when its user leaves the visible view', async () => {
  const user = userEvent.setup()
  mockUsers()

  const { router } = renderUsers()
  await openRecordFor(user, 'Amélie Bernard')

  expect(screen.getByRole('dialog')).toBeInTheDocument()

  // The record stays addressed by its userId; only the visible view changes underneath it.
  await router.navigate({
    to: '/users',
    search: {
      search: '',
      status: 'pending',
      role: 'all',
      sort: 'name',
      order: 'asc',
      userId: 'active-1',
      mode: 'view',
    },
  })

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

test('restores an open record from the initial URL', async () => {
  mockUsers()

  renderUsers('/users?status=deactivated&userId=deactivated-1')

  const record = await screen.findByRole('dialog')

  expect(within(record).getByRole('heading', { name: /David Évrard/ })).toBeInTheDocument()
  // Scoped to the status field: "Deactivated" is also the label of a recorded lifecycle event.
  expect(within(record).getByText('Access status').parentElement).toHaveTextContent('Deactivated')
})

test('drops a userId naming no user of the visible view', async () => {
  mockUsers(undefined, USERS)

  const { router } = renderUsers('/users?status=active&userId=pending-1')

  await screen.findByRole('table', { name: 'Active users' })

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  // Dropped from the URL, not merely ignored: left there it would reopen on its own below.
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('userId'))
})

test('does not reopen a dropped record when its user comes back into view', async () => {
  const user = userEvent.setup()
  mockUsers(undefined, USERS)

  renderUsers('/users?status=active&userId=pending-1')

  await screen.findByRole('table', { name: 'Active users' })
  await user.click(screen.getByRole('tab', { name: /Pending/ }))
  await screen.findByRole('table', { name: 'Pending users' })

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
