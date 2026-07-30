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

const WEIGHING_AREAS = [
  { id: 'area-z', name: 'Zulu Scale', latitude: 48.1, longitude: 2.1, status: 'AVAILABLE' },
  { id: 'area-a', name: 'Alpha Scale', latitude: 48.2, longitude: 2.2, status: 'AVAILABLE' },
  {
    id: 'area-old',
    name: 'Old Scale',
    latitude: 48.3,
    longitude: 2.3,
    status: 'ARCHIVED',
    archiveComment: 'Replaced',
  },
]

function mockWeighingAreas() {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ADMIN })),
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
      HttpResponse.json({ data: WEIGHING_AREAS }),
    ),
    http.get(`${API_BASE_URL}/api/v1/weighing-areas/:id`, ({ params }) => {
      const area = WEIGHING_AREAS.find(({ id }) => id === params.id)
      return area
        ? HttpResponse.json({ data: area })
        : HttpResponse.json({ error: { message: 'Not found' } }, { status: 404 })
    }),
  )
}

test('browses, searches, sorts, switches lifecycle, and inspects weighing areas', async () => {
  const user = userEvent.setup()
  mockWeighingAreas()
  const { router } = renderApp('/checkpoints?resource=weighing-areas')

  const available = await screen.findByRole('table', { name: 'Available weighing areas' })
  expect(within(available).getByText('Alpha Scale')).toBeInTheDocument()
  expect(within(available).getByText('Zulu Scale')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Available \(2\)/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Archived \(1\)/ })).toBeInTheDocument()

  await user.type(screen.getByRole('textbox', { name: 'Search weighing areas' }), 'zulu')
  expect(within(available).getByText('Zulu Scale')).toBeInTheDocument()
  expect(within(available).queryByText('Alpha Scale')).not.toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({ q: 'zulu' })

  await user.clear(screen.getByRole('textbox', { name: 'Search weighing areas' }))
  await user.click(within(available).getByRole('button', { name: /Weighing area name/ }))
  expect(
    within(available)
      .getAllByRole('button', { name: /View weighing area/ })
      .map((button) => button.textContent),
  ).toEqual(['Zulu Scale', 'Alpha Scale'])
  expect(router.state.location.search).toMatchObject({ sort: 'desc' })

  await user.click(screen.getByRole('tab', { name: /Archived \(1\)/ }))
  const archived = await screen.findByRole('table', { name: 'Archived weighing areas' })
  expect(within(archived).getByText('Old Scale')).toBeInTheDocument()
  expect(within(archived).getByText('Archived')).toBeInTheDocument()

  await user.click(within(archived).getByRole('button', { name: 'View weighing area Old Scale' }))
  expect(await screen.findByRole('dialog', { name: 'Old Scale' })).toBeInTheDocument()
  expect(
    within(screen.getByRole('dialog', { name: 'Old Scale' })).getByText('48.3, 2.3'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit weighing area' })).not.toBeInTheDocument()
})

test('creates and edits an available weighing area with field and conflict feedback', async () => {
  const user = userEvent.setup()
  let areas = [...WEIGHING_AREAS]
  const requests: Array<{ method: string; body?: unknown }> = []

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ADMIN })),
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () => HttpResponse.json({ data: areas })),
    http.get(`${API_BASE_URL}/api/v1/weighing-areas/:id`, ({ params }) => {
      const area = areas.find(({ id }) => id === params.id)
      return area
        ? HttpResponse.json({ data: area })
        : HttpResponse.json({ error: { message: 'Not found' } }, { status: 404 })
    }),
    http.post(`${API_BASE_URL}/api/v1/weighing-areas`, async ({ request }) => {
      const body = await request.json()
      requests.push({ method: 'POST', body })
      if ((body as { name: string }).name === 'Zulu Scale') {
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
        id: 'area-new',
        ...(body as object),
        status: 'AVAILABLE',
      }
      areas = [...areas, created as (typeof WEIGHING_AREAS)[number]]
      return HttpResponse.json({ data: created }, { status: 201 })
    }),
    http.patch(`${API_BASE_URL}/api/v1/weighing-areas/:id`, async ({ params, request }) => {
      const body = await request.json()
      requests.push({ method: 'PATCH', body })
      if ((body as { name: string }).name === 'Zulu Scale') {
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
      const updated = { ...areas.find(({ id }) => id === params.id), ...(body as object) }
      areas = areas.map((area) => (area.id === params.id ? updated : area)) as typeof areas
      return HttpResponse.json({ data: updated })
    }),
  )

  renderApp('/checkpoints?resource=weighing-areas')
  await screen.findByRole('table', { name: 'Available weighing areas' })

  await user.click(screen.getByRole('button', { name: 'Create weighing area' }))
  const createDialog = await screen.findByRole('dialog', { name: 'Create weighing area' })
  await user.click(within(createDialog).getByRole('button', { name: 'Create weighing area' }))
  expect(screen.getByText('Weighing area name is required.')).toBeInTheDocument()

  await user.type(screen.getByRole('textbox', { name: 'Weighing area name' }), 'North Scale')
  await user.type(screen.getByRole('textbox', { name: 'Latitude' }), '48.4')
  await user.type(screen.getByRole('textbox', { name: 'Longitude' }), '2.4')
  await user.click(within(createDialog).getByRole('button', { name: 'Create weighing area' }))

  expect(await screen.findByRole('dialog', { name: 'North Scale' })).toBeInTheDocument()
  expect(requests[0]).toEqual({
    method: 'POST',
    body: { name: 'North Scale', latitude: 48.4, longitude: 2.4 },
  })

  await user.click(screen.getByRole('button', { name: 'Edit weighing area' }))
  const name = screen.getByRole('textbox', { name: 'Weighing area name' })
  await user.clear(name)
  await user.type(name, 'Zulu Scale')
  await user.click(screen.getByRole('button', { name: 'Save weighing area changes' }))
  expect((await screen.findAllByText('The name has already been taken.')).length).toBeGreaterThan(0)

  await user.clear(name)
  await user.type(name, 'North Scale Updated')
  await user.click(screen.getByRole('button', { name: 'Save weighing area changes' }))
  expect(await screen.findByRole('dialog', { name: 'North Scale Updated' })).toBeInTheDocument()
  expect(requests[2]).toEqual({
    method: 'PATCH',
    body: { name: 'North Scale Updated', latitude: 48.4, longitude: 2.4 },
  })
})

test('archives and reactivates a weighing area while recovering from blocked and stale outcomes', async () => {
  const user = userEvent.setup()
  let area = { ...WEIGHING_AREAS[0] }
  const attempts = { archive: 0, reactivate: 0 }
  const requests: Array<{ path: string; body: unknown }> = []

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ADMIN })),
    http.get(`${API_BASE_URL}/api/v1/weighing-areas`, () => HttpResponse.json({ data: [area] })),
    http.get(`${API_BASE_URL}/api/v1/weighing-areas/:id`, () => HttpResponse.json({ data: area })),
    http.post(`${API_BASE_URL}/api/v1/weighing-areas/:id/archive`, async ({ request }) => {
      requests.push({ path: 'archive', body: null })
      attempts.archive += 1
      if (attempts.archive === 1) {
        return HttpResponse.json(
          {
            error: {
              code: 'E_WEIGHING_AREA_IN_USE',
              message: 'Weighing area is used by a planned or active discharge',
            },
          },
          { status: 409 },
        )
      }
      area = { ...area, status: 'ARCHIVED', archiveComment: 'Replaced scale' }
      return HttpResponse.json({ data: area })
    }),
    http.post(`${API_BASE_URL}/api/v1/weighing-areas/:id/reactivate`, () => {
      requests.push({ path: 'reactivate', body: null })
      attempts.reactivate += 1
      if (attempts.reactivate === 1) {
        return HttpResponse.json(
          {
            error: {
              code: 'E_WEIGHING_AREA_ALREADY_AVAILABLE',
              message: 'Weighing area is already available',
            },
          },
          { status: 409 },
        )
      }
      area = { ...area, status: 'AVAILABLE', archiveComment: undefined }
      return HttpResponse.json({ data: area })
    }),
  )

  renderApp('/checkpoints?resource=weighing-areas')
  await screen.findByRole('table', { name: 'Available weighing areas' })
  await user.click(screen.getByRole('button', { name: 'View weighing area Zulu Scale' }))

  const details = await screen.findByRole('dialog', { name: 'Zulu Scale' })
  fireEvent.click(within(details).getByRole('button', { name: 'Archive weighing area' }))
  const archiveDialog = screen.getByRole('alertdialog')
  fireEvent.change(within(archiveDialog).getByRole('textbox', { name: 'Comment (optional)' }), {
    target: { value: 'Replaced scale' },
  })
  fireEvent.click(within(archiveDialog).getByRole('button', { name: 'Archive' }))
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(screen.getByText('Weighing area is used by a planned or active discharge')).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(within(details).getByText('Available')).toBeInTheDocument()

  fireEvent.click(within(archiveDialog).getByRole('button', { name: 'Archive' }))
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(within(details).getByText('Archived')).toBeInTheDocument()
  expect(within(details).getByText('Replaced scale')).toBeInTheDocument()
  expect(requests[0]).toEqual({ path: 'archive', body: null })

  fireEvent.click(within(details).getByRole('button', { name: 'Reactivate weighing area' }))
  const reactivateDialog = screen.getByRole('alertdialog')
  fireEvent.click(within(reactivateDialog).getByRole('button', { name: 'Reactivate' }))
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(screen.getByText('Weighing area is already available')).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(within(details).getByText('Archived')).toBeInTheDocument()

  fireEvent.click(within(reactivateDialog).getByRole('button', { name: 'Reactivate' }))
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(within(details).getByText('Available')).toBeInTheDocument()
  expect(requests[2]).toEqual({ path: 'reactivate', body: null })
})
