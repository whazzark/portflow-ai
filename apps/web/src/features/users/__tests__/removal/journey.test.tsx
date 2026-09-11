import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL } from '../support/fixtures'
import { mockUsersWithRemoval, renderUsers } from '../support/test-helpers'

const openRecord = async (user: ReturnType<typeof userEvent.setup>, view: string, name: string) => {
  await user.click(await screen.findByRole('tab', { name: new RegExp(view) }))
  const table = await screen.findByRole('table', { name: `${view} users` })
  await user.click(within(table).getByRole('button', { name: `View user ${name}` }))

  return screen.getByRole('dialog')
}

test.each([
  ['Pending', 'Chloé Durand'],
  ['Cancelled', 'Élodie Fabre'],
])('removes a %s user from the access record', async (view, name) => {
  const user = userEvent.setup()
  mockUsersWithRemoval()

  renderUsers()
  const record = await openRecord(user, view, name)

  await user.click(within(record).getByRole('button', { name: 'Remove' }))
  await screen.findByRole('heading', { name: 'Remove user?' })
  await user.click(screen.getByRole('button', { name: 'Remove' }))

  expect(await screen.findByText(`User “${name}” removed`)).toBeInTheDocument()
})

test('names the user and what the removal means before confirming', async () => {
  const user = userEvent.setup()
  mockUsersWithRemoval()

  renderUsers()
  const record = await openRecord(user, 'Pending', 'Chloé Durand')
  await user.click(within(record).getByRole('button', { name: 'Remove' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText(/Chloé Durand/)).toBeInTheDocument()
  expect(within(dialog).getByText(/permanently/i)).toBeInTheDocument()
  expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument()
  expect(within(dialog).getByText(/activation link/i)).toBeInTheDocument()
  expect(within(dialog).getByText(/invited again/i)).toBeInTheDocument()
  // One confirmation, nothing to type (FR-017).
  expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
})

test('shows the removal in flight and blocks a second submission', async () => {
  const user = userEvent.setup()
  let release: () => void = () => undefined
  mockUsersWithRemoval()
  server.use(
    http.delete(`${API_BASE_URL}/api/v1/users/:id`, async () => {
      await new Promise<void>((resolve) => {
        release = resolve
      })

      return new HttpResponse(null, { status: 204 })
    }),
  )

  renderUsers()
  const record = await openRecord(user, 'Pending', 'Chloé Durand')
  await user.click(within(record).getByRole('button', { name: 'Remove' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

  expect(await within(dialog).findByRole('button', { name: 'Removing…' })).toBeDisabled()

  release()
  expect(await screen.findByText('User “Chloé Durand” removed')).toBeInTheDocument()
})

test('leaves the user untouched when the confirmation is cancelled', async () => {
  const user = userEvent.setup()
  mockUsersWithRemoval()

  renderUsers()
  const record = await openRecord(user, 'Pending', 'Chloé Durand')
  await user.click(within(record).getByRole('button', { name: 'Remove' }))
  await screen.findByRole('heading', { name: 'Remove user?' })
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }),
  ).toBeInTheDocument()
  expect(screen.queryByText('User “Chloé Durand” removed')).not.toBeInTheDocument()
})

test('closes the record and drops the user from the view and its count without a reload', async () => {
  const user = userEvent.setup()
  mockUsersWithRemoval()

  renderUsers()
  expect(await screen.findByRole('tab', { name: /Pending \(1\)/ })).toBeInTheDocument()

  const record = await openRecord(user, 'Pending', 'Chloé Durand')
  await user.click(within(record).getByRole('button', { name: 'Remove' }))
  await screen.findByRole('heading', { name: 'Remove user?' })
  await user.click(screen.getByRole('button', { name: 'Remove' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('tab', { name: /Pending \(0\)/ })).toBeInTheDocument()
  expect(screen.queryByText('Chloé Durand')).not.toBeInTheDocument()
})
