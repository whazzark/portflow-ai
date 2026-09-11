import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import {
  ACTIVE_USERS_WITHOUT_LIFECYCLE,
  OPERATIONS_ADMIN,
  ORGANIZATION_ADMIN,
  USERS,
} from '../support/fixtures'
import { mockIdentityCorrection, mockUsers, renderUsers } from '../support/test-helpers'

// The menu is portaled out of the table, so its items are queried from `screen` rather than through
// the row — which the directory re-renders underneath them.
const openRowMenu = async (name: string, table = 'Active users') => {
  await screen.findByRole('table', { name: table }, { timeout: 5000 })
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
  await screen.findByRole('menu')
}

test('offers the correction from the row, between consultation and the access actions', async () => {
  mockIdentityCorrection()

  renderUsers()
  await openRowMenu('Amélie Bernard')

  const items = screen.getAllByRole('menuitem').map((item) => item.textContent)
  expect(items).toEqual(['View', 'Edit', 'Deactivate'])
})

test('opens the correction straight from the row', async () => {
  mockIdentityCorrection()

  const { router } = renderUsers()
  await openRowMenu('Amélie Bernard')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))

  const panel = await screen.findByRole('dialog')
  expect(within(panel).getByRole('heading', { name: 'Edit user' })).toBeInTheDocument()
  expect(within(panel).getByRole('textbox', { name: 'First name' })).toHaveValue('Amélie')
  expect(router.state.location.search).toMatchObject({ userId: 'active-1', mode: 'edit' })
})

test('offers the correction on a row of any access status', async () => {
  const user = userEvent.setup()
  mockIdentityCorrection()

  renderUsers()
  await user.click(await screen.findByRole('tab', { name: /Pending/ }))
  await openRowMenu('Chloé Durand', 'Pending users')

  expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
})

test('never offers it on the viewer own row', async () => {
  // The viewer *is* the row: correcting your own identity is the self-service path.
  mockIdentityCorrection({ ...ORGANIZATION_ADMIN, id: 'active-1' }, USERS)

  renderUsers()
  await openRowMenu('Amélie Bernard')

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
})

test('never offers it to a viewer who is no organization admin', async () => {
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  await openRowMenu('Amélie Bernard')

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
})
