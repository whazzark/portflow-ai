import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, USERS } from '../support/fixtures'
import {
  mockIdentityCorrection,
  mockIdentityCorrectionRefused,
  renderUsers,
} from '../support/test-helpers'

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value } })

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

test('reports a server failure without presenting the correction as applied', async () => {
  mockIdentityCorrectionRefused(
    { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong. Please try again.' },
    500,
  )

  renderUsers('/users?userId=active-1&mode=edit')

  expect(await screen.findByRole('heading', { name: 'Edit user' })).toBeInTheDocument()
  fill('First name', 'Amelie')
  submit()

  expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
  // Still in the editor, with what was typed: the correction was not applied, and saying so is the
  // whole point of the state.
  expect(screen.getByRole('heading', { name: 'Edit user' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'First name' })).toHaveValue('Amelie')
})

test('applies the correction on a retry once the failure clears', async () => {
  const { corrections, collection } = mockIdentityCorrection()
  let failNext = true

  server.use(
    http.patch(`${API_BASE_URL}/api/v1/users/:id`, async ({ params, request }) => {
      if (failNext) {
        failNext = false

        return HttpResponse.json(
          { error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Service unavailable' } },
          { status: 503 },
        )
      }

      const body = (await request.json()) as Record<string, string>
      corrections.push({ id: String(params.id), body })
      const target = collection.find((user) => user.id === params.id)
      Object.assign(target as object, body)

      return HttpResponse.json({ data: target })
    }),
  )

  const { router } = renderUsers('/users?userId=active-1&mode=edit')

  expect(await screen.findByRole('heading', { name: 'Edit user' })).toBeInTheDocument()
  fill('First name', 'Amelie')
  submit()
  expect(await screen.findByText('Service unavailable')).toBeInTheDocument()

  submit()

  await waitFor(() => expect(router.state.location.search).toMatchObject({ mode: 'view' }))
  expect(corrections).toHaveLength(1)
  expect(collection[0]).toMatchObject({ firstName: 'Amelie' })
}, 15000)

test('follows the collection when the corrected user leaves the visible view', async () => {
  // The record is a view over the collection: a user the refreshed collection no longer shows in
  // this view cannot keep an open record over stale values.
  const { collection } = mockIdentityCorrection()

  server.use(
    http.patch(`${API_BASE_URL}/api/v1/users/:id`, async ({ params, request }) => {
      const body = (await request.json()) as Record<string, string>
      const index = collection.findIndex((user) => user.id === params.id)
      const corrected = { ...collection[index], ...body, accessStatus: 'DEACTIVATED' as const }
      collection[index] = corrected

      return HttpResponse.json({ data: corrected })
    }),
  )

  const { router } = renderUsers('/users?userId=active-1&mode=edit')

  expect(await screen.findByRole('heading', { name: 'Edit user' })).toBeInTheDocument()
  fill('First name', 'Amelie')
  submit()

  await waitFor(() => expect(router.state.location.search.userId).toBeUndefined())
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}, 15000)

test('keeps the previous identity visible in the collection while a correction fails', async () => {
  mockIdentityCorrectionRefused(
    { code: 'E_INTERNAL_SERVER_ERROR', message: 'Service unavailable' },
    503,
  )

  renderUsers()

  const table = await screen.findByRole('table', { name: 'Active users' }, { timeout: 5000 })
  fireEvent.click(
    within(table).getByRole('button', {
      name: `View user ${USERS[0].firstName} ${USERS[0].lastName}`,
    }),
  )
  const record = await screen.findByRole('dialog')
  fireEvent.click(within(record).getByRole('button', { name: 'Edit' }))
  expect(await screen.findByRole('heading', { name: 'Edit user' })).toBeInTheDocument()
  fill('First name', 'Amelie')
  submit()

  expect(await screen.findByText('Service unavailable')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Back to details' }))
  expect(await screen.findByRole('heading', { name: /Amélie Bernard/ })).toBeInTheDocument()
}, 15000)
