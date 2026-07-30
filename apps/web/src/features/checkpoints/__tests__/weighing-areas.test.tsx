import { screen, within } from '@testing-library/react'
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
