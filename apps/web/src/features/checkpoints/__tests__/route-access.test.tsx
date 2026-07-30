import { screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

const API_BASE_URL = 'http://localhost:3333'

const ADMIN = {
  id: 1,
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'admin@portflow.test',
  role: 'OPERATIONS_ADMIN',
  accessStatus: 'ACTIVE',
}

const OBSERVER = { ...ADMIN, role: 'OBSERVER', email: 'observer@portflow.test' }

function mockSession(user: typeof ADMIN) {
  server.use(http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })))
}

test('lets an administrator open Checkpoints and normalizes unsafe URL state', async () => {
  mockSession(ADMIN)

  const invalidSearch = [
    '/checkpoints?resource=',
    'unknown&status=',
    'unknown&q=  &sort=',
    'unknown&mode=edit',
  ].join('')
  const { router } = renderApp(invalidSearch)

  expect(await screen.findByRole('heading', { name: 'Checkpoints' })).toBeInTheDocument()
  expect(
    within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', {
      name: 'Checkpoints',
    }),
  ).toHaveAttribute('href', '/checkpoints')
  expect(router.state.location.search).toEqual({
    resource: 'docks',
    status: 'available',
    q: '',
    sort: 'asc',
  })
})

test('does not expose the workbench to a non-administrator', async () => {
  mockSession(OBSERVER)

  renderApp('/checkpoints')

  expect(await screen.findByRole('alert')).toHaveTextContent(/administrator access required/i)
  expect(screen.queryByRole('heading', { name: 'Checkpoints' })).not.toBeInTheDocument()
  expect(
    within(screen.getByRole('navigation', { name: 'Primary' })).queryByRole('link', {
      name: 'Checkpoints',
    }),
  ).not.toBeInTheDocument()
})
