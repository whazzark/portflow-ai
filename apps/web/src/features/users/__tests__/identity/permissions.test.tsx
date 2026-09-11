import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { UserDto } from '@/features/users/types'
import {
  ACTIVE_USERS_WITHOUT_LIFECYCLE,
  OPERATIONS_ADMIN,
  ORGANIZATION_ADMIN,
  USERS,
} from '../support/fixtures'
import { mockIdentityCorrection, mockUsers, renderUsers } from '../support/test-helpers'

/** The viewer, listed among the users they administer — an administrator sees their own record. */
const VIEWERS_OWN_RECORD = {
  ...USERS[0],
  id: ORGANIZATION_ADMIN.id,
  firstName: ORGANIZATION_ADMIN.firstName,
  lastName: ORGANIZATION_ADMIN.lastName,
  email: ORGANIZATION_ADMIN.email,
} as UserDto

const openRecordFor = async (name: string) => {
  const table = await screen.findByRole('table', { name: 'Active users' }, { timeout: 5000 })
  fireEvent.click(within(table).getByRole('button', { name: `View user ${name}` }))

  return screen.findByRole('dialog')
}

test('offers the correction to an organization admin on another user', async () => {
  mockIdentityCorrection()

  renderUsers()
  const record = await openRecordFor('Amélie Bernard')

  expect(within(record).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
})

test('offers no correction on the administrator’s own record', async () => {
  mockIdentityCorrection(ORGANIZATION_ADMIN, [VIEWERS_OWN_RECORD, USERS[1]])

  renderUsers()
  const record = await openRecordFor('Claire Martin')

  expect(within(record).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

test('opens nothing when an administrator hand-types the mode on their own record', async () => {
  mockIdentityCorrection(ORGANIZATION_ADMIN, [VIEWERS_OWN_RECORD, USERS[1]])

  renderUsers(`/users?userId=${ORGANIZATION_ADMIN.id}&mode=edit`)

  const record = await screen.findByRole('dialog')
  expect(within(record).queryByRole('heading', { name: 'Edit identity' })).not.toBeInTheDocument()
  expect(within(record).getByRole('heading', { name: /Claire Martin/ })).toBeInTheDocument()
})

test('offers no correction to an operations admin', async () => {
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  const record = await openRecordFor('Amélie Bernard')

  expect(within(record).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

test('opens nothing when an operations admin hand-types the mode', async () => {
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers('/users?userId=active-1&mode=edit')

  const record = await screen.findByRole('dialog')
  await waitFor(() =>
    expect(within(record).getByRole('heading', { name: /Amélie Bernard/ })).toBeInTheDocument(),
  )
  expect(within(record).queryByRole('heading', { name: 'Edit identity' })).not.toBeInTheDocument()
})
