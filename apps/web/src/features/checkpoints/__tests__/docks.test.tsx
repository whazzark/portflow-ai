import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

const DOCKS = [
  { id: 'dock-z', name: 'Zulu Dock', latitude: 48.1, longitude: 2.1, status: 'AVAILABLE' },
  { id: 'dock-a', name: 'Alpha Dock', latitude: 48.2, longitude: 2.2, status: 'AVAILABLE' },
  {
    id: 'dock-old',
    name: 'Old Dock',
    latitude: 48.3,
    longitude: 2.3,
    status: 'ARCHIVED',
    archiveComment: 'Replaced',
  },
]

function mockDocks() {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ADMIN })),
    http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: DOCKS })),
    http.get(`${API_BASE_URL}/api/v1/docks/:id`, ({ params }) => {
      const dock = DOCKS.find(({ id }) => id === params.id)
      return dock
        ? HttpResponse.json({ data: dock })
        : HttpResponse.json({ error: { message: 'Not found' } }, { status: 404 })
    }),
  )
}

test('browses, searches, sorts, switches lifecycle, and inspects docks', async () => {
  const user = userEvent.setup()
  mockDocks()
  const { router } = renderApp('/checkpoints')

  const available = await screen.findByRole('table', { name: 'Available docks' })
  expect(within(available).getByText('Alpha Dock')).toBeInTheDocument()
  expect(within(available).getByText('Zulu Dock')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Available \(2\)/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Archived \(1\)/ })).toBeInTheDocument()

  await user.type(screen.getByRole('textbox', { name: 'Search docks' }), 'zulu')
  expect(within(available).getByText('Zulu Dock')).toBeInTheDocument()
  expect(within(available).queryByText('Alpha Dock')).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ q: 'zulu' })

  await user.clear(screen.getByRole('textbox', { name: 'Search docks' }))
  await user.click(within(available).getByRole('button', { name: /Dock name/ }))
  expect(
    within(available)
      .getAllByRole('button', { name: /View dock/ })
      .map((button) => button.textContent),
  ).toEqual(['Zulu Dock', 'Alpha Dock'])
  expect(router.state.location.search).toMatchObject({ sort: 'desc' })

  await user.click(screen.getByRole('tab', { name: /Archived \(1\)/ }))
  const archived = await screen.findByRole('table', { name: 'Archived docks' })
  expect(within(archived).getByText('Old Dock')).toBeInTheDocument()
  expect(within(archived).getByText('Archived')).toBeInTheDocument()

  await user.click(within(archived).getByRole('button', { name: 'View dock Old Dock' }))
  expect(await screen.findByRole('dialog', { name: 'Old Dock' })).toBeInTheDocument()
  expect(
    within(screen.getByRole('dialog', { name: 'Old Dock' })).getByText('48.3, 2.3'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit dock' })).not.toBeInTheDocument()
})

test('offers a retry and distinguishes no matching docks', async () => {
  let attempts = 0
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ADMIN })),
    http.get(`${API_BASE_URL}/api/v1/docks`, () => {
      attempts += 1
      return attempts === 1
        ? HttpResponse.json({ error: { message: 'Temporary failure' } }, { status: 503 })
        : HttpResponse.json({ data: DOCKS })
    }),
  )

  const user = userEvent.setup()
  renderApp('/checkpoints')
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not load docks/i)
  await user.click(screen.getByRole('button', { name: 'Retry loading docks' }))
  await screen.findByRole('table', { name: 'Available docks' })
  await user.type(screen.getByRole('textbox', { name: 'Search docks' }), 'missing')
  expect(screen.getByText('No docks match your search')).toBeInTheDocument()
})

test('creates and edits an available dock with field and conflict feedback', async () => {
  const user = userEvent.setup()
  let docks = [...DOCKS]
  const requests: Array<{ method: string; body?: unknown }> = []

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ADMIN })),
    http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: docks })),
    http.get(`${API_BASE_URL}/api/v1/docks/:id`, ({ params }) => {
      const dock = docks.find(({ id }) => id === params.id)
      return dock
        ? HttpResponse.json({ data: dock })
        : HttpResponse.json({ error: { message: 'Not found' } }, { status: 404 })
    }),
    http.post(`${API_BASE_URL}/api/v1/docks`, async ({ request }) => {
      const body = await request.json()
      requests.push({ method: 'POST', body })
      if ((body as { name: string }).name === 'Zulu Dock') {
        return HttpResponse.json(
          {
            error: {
              code: 'E_VALIDATION_ERROR',
              message: 'The name has already been taken.',
              details: [{ field: 'name', message: 'The name has already been taken.' }],
            },
          },
          { status: 422 },
        )
      }
      const created = {
        id: 'dock-new',
        ...(body as object),
        status: 'AVAILABLE',
      }
      docks = [...docks, created as (typeof DOCKS)[number]]
      return HttpResponse.json({ data: created }, { status: 201 })
    }),
    http.patch(`${API_BASE_URL}/api/v1/docks/:id`, async ({ params, request }) => {
      const body = await request.json()
      requests.push({ method: 'PATCH', body })
      if ((body as { name: string }).name === 'Zulu Dock') {
        return HttpResponse.json(
          {
            error: {
              code: 'E_VALIDATION_ERROR',
              message: 'The name has already been taken.',
              details: [{ field: 'name', message: 'The name has already been taken.' }],
            },
          },
          { status: 422 },
        )
      }
      const updated = { ...docks.find(({ id }) => id === params.id), ...(body as object) }
      docks = docks.map((dock) => (dock.id === params.id ? updated : dock)) as typeof DOCKS
      return HttpResponse.json({ data: updated })
    }),
  )

  renderApp('/checkpoints')
  await screen.findByRole('table', { name: 'Available docks' })

  await user.click(screen.getByRole('button', { name: 'Create dock' }))
  const createDialog = await screen.findByRole('dialog', { name: 'Create dock' })
  await user.click(within(createDialog).getByRole('button', { name: 'Create dock' }))
  expect(screen.getByText('Dock name is required.')).toBeInTheDocument()

  await user.type(screen.getByRole('textbox', { name: 'Dock name' }), 'North Dock')
  await user.type(screen.getByRole('textbox', { name: 'Latitude' }), '48.4')
  await user.type(screen.getByRole('textbox', { name: 'Longitude' }), '2.4')
  await user.click(within(createDialog).getByRole('button', { name: 'Create dock' }))

  expect(await screen.findByRole('dialog', { name: 'North Dock' })).toBeInTheDocument()
  expect(requests[0]).toEqual({
    method: 'POST',
    body: { name: 'North Dock', latitude: 48.4, longitude: 2.4 },
  })

  await user.click(screen.getByRole('button', { name: 'Edit dock' }))
  const name = screen.getByRole('textbox', { name: 'Dock name' })
  await user.clear(name)
  await user.type(name, 'Zulu Dock')
  await user.click(screen.getByRole('button', { name: 'Save dock changes' }))
  expect((await screen.findAllByText('The name has already been taken.')).length).toBeGreaterThan(0)

  await user.clear(name)
  await user.type(name, 'North Dock Updated')
  await user.click(screen.getByRole('button', { name: 'Save dock changes' }))
  expect(await screen.findByRole('dialog', { name: 'North Dock Updated' })).toBeInTheDocument()
  expect(requests[2]).toEqual({
    method: 'PATCH',
    body: { name: 'North Dock Updated', latitude: 48.4, longitude: 2.4 },
  })
})

test('archives and reactivates a dock while recovering from blocked and stale outcomes', async () => {
  const user = userEvent.setup()
  let dock = { ...DOCKS[0] }
  const attempts = { archive: 0, reactivate: 0 }
  const requests: Array<{ path: string; body: unknown }> = []

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ADMIN })),
    http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: [dock] })),
    http.get(`${API_BASE_URL}/api/v1/docks/:id`, () => HttpResponse.json({ data: dock })),
    http.post(`${API_BASE_URL}/api/v1/docks/:id/archive`, async ({ request }) => {
      requests.push({ path: 'archive', body: await request.json() })
      attempts.archive += 1
      if (attempts.archive === 1) {
        return HttpResponse.json(
          {
            error: {
              code: 'E_DOCK_IN_USE',
              message: 'Dock is used by a planned or active discharge',
            },
          },
          { status: 409 },
        )
      }
      dock = { ...dock, status: 'ARCHIVED', archiveComment: 'Retired dock' }
      return HttpResponse.json({ data: dock })
    }),
    http.post(`${API_BASE_URL}/api/v1/docks/:id/reactivate`, async ({ request }) => {
      requests.push({ path: 'reactivate', body: await request.json() })
      attempts.reactivate += 1
      if (attempts.reactivate === 1) {
        return HttpResponse.json(
          { error: { code: 'E_DOCK_ALREADY_AVAILABLE', message: 'Dock is already available' } },
          { status: 409 },
        )
      }
      dock = { ...dock, status: 'AVAILABLE', archiveComment: undefined }
      return HttpResponse.json({ data: dock })
    }),
  )

  renderApp('/checkpoints')
  await screen.findByRole('table', { name: 'Available docks' })
  await user.click(screen.getByRole('button', { name: 'View dock Zulu Dock' }))

  const details = await screen.findByRole('dialog', { name: 'Zulu Dock' })
  fireEvent.click(within(details).getByRole('button', { name: 'Archive dock' }))
  const archiveDialog = screen.getByRole('alertdialog')
  fireEvent.change(within(archiveDialog).getByRole('textbox', { name: 'Comment (optional)' }), {
    target: { value: 'Retired dock' },
  })
  fireEvent.click(within(archiveDialog).getByRole('button', { name: 'Archive' }))
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(screen.getByText('Dock is used by a planned or active discharge')).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(within(details).getByText('Available')).toBeInTheDocument()

  fireEvent.click(within(archiveDialog).getByRole('button', { name: 'Archive' }))
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(within(details).getByText('Archived')).toBeInTheDocument()
  expect(within(details).getByText('Retired dock')).toBeInTheDocument()
  expect(requests[0]).toEqual({ path: 'archive', body: { comment: 'Retired dock' } })

  fireEvent.click(within(details).getByRole('button', { name: 'Reactivate dock' }))
  const reactivateDialog = screen.getByRole('alertdialog')
  fireEvent.click(within(reactivateDialog).getByRole('button', { name: 'Reactivate' }))
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(screen.getByText('Dock is already available')).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(within(details).getByText('Archived')).toBeInTheDocument()

  fireEvent.click(within(reactivateDialog).getByRole('button', { name: 'Reactivate' }))
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(within(details).getByText('Available')).toBeInTheDocument()
  expect(requests[2]).toEqual({ path: 'reactivate', body: { comment: null } })
})
