import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { API_BASE_URL } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

beforeEach(() => {
  mockDocks()
})

test('blocks submission with a clear message until a location has been placed', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View weighing area Alpha Scale (Available)' })
  await user.click(screen.getByRole('button', { name: 'New weighing area' }))

  expect(
    screen.getByText('A location must be placed before this weighing area can be created.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Create weighing area' })).toBeDisabled()
})

test('rejects a blank weighing area name with an inline field error and keeps the pending placement', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View weighing area Alpha Scale (Available)' })
  await user.click(screen.getByRole('button', { name: 'New weighing area' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))

  await user.click(screen.getByRole('button', { name: 'Create weighing area' }))

  expect(await screen.findByText('Weighing area name is required.')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('10.5')
})

test('rejects a duplicate weighing area name inline on the name field and keeps entered values (available fixture)', async () => {
  const user = userEvent.setup()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_WEIGHING_AREA_NAME_CONFLICT',
            message: 'Weighing area name is already in use',
          },
        },
        { status: 409 },
      ),
    ),
  )
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View weighing area Alpha Scale (Available)' })
  await user.click(screen.getByRole('button', { name: 'New weighing area' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))
  await user.type(
    screen.getByRole('textbox', { name: 'Weighing area name' }),
    WEIGHING_AREAS[0].name,
  )
  await user.click(screen.getByRole('button', { name: 'Create weighing area' }))

  expect(await screen.findByText('Weighing area name is already in use')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Weighing area name' })).toHaveValue(
    WEIGHING_AREAS[0].name,
  )
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('10.5')
})

test('rejects a duplicate weighing area name matching an archived fixture', async () => {
  const user = userEvent.setup()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_WEIGHING_AREA_NAME_CONFLICT',
            message: 'Weighing area name is already in use',
          },
        },
        { status: 409 },
      ),
    ),
  )
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View weighing area Alpha Scale (Available)' })
  await user.click(screen.getByRole('button', { name: 'New weighing area' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))
  await user.type(
    screen.getByRole('textbox', { name: 'Weighing area name' }),
    WEIGHING_AREAS[1].name,
  )
  await user.click(screen.getByRole('button', { name: 'Create weighing area' }))

  expect(await screen.findByText('Weighing area name is already in use')).toBeInTheDocument()
})

test('creates successfully when the submitted name matches an existing dock name', async () => {
  const user = userEvent.setup()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
      HttpResponse.json(
        {
          data: {
            id: 'created-weighing-area-dock-name',
            name: 'North Dock',
            latitude: 10.5,
            longitude: 20.5,
            status: 'AVAILABLE',
            archivedAt: null,
            archivedByUserId: null,
            archiveComment: null,
            reactivatedAt: null,
            reactivatedByUserId: null,
            reactivationComment: null,
            createdAt: '2026-08-24T00:00:00.000Z',
            updatedAt: '2026-08-24T00:00:00.000Z',
          },
        },
        { status: 201 },
      ),
    ),
  )
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View dock North Dock (Available)' })
  await user.click(screen.getByRole('button', { name: 'New weighing area' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))
  await user.type(screen.getByRole('textbox', { name: 'Weighing area name' }), 'North Dock')
  await user.click(screen.getByRole('button', { name: 'Create weighing area' }))

  expect(await screen.findByText('Weighing area created')).toBeInTheDocument()
})

test('rejects a manually edited out-of-range coordinate and disables submission', async () => {
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View weighing area Alpha Scale (Available)' })
  await user.click(screen.getByRole('button', { name: 'New weighing area' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))
  await user.type(screen.getByRole('textbox', { name: 'Weighing area name' }), 'South Scale')

  const latitudeInput = screen.getByRole('textbox', { name: 'Latitude' })
  await user.clear(latitudeInput)
  await user.type(latitudeInput, '91')

  expect(await screen.findByText('Latitude must be between -90 and 90.')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Create weighing area' })).toBeDisabled(),
  )
})

test('shows an error toast and preserves the pending marker on a server failure', async () => {
  const user = userEvent.setup()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas`, () =>
      HttpResponse.json(
        { error: { code: 'E_INTERNAL', message: 'Unexpected error' } },
        { status: 500 },
      ),
    ),
  )
  renderCheckpoints()

  await screen.findByRole('button', { name: 'View weighing area Alpha Scale (Available)' })
  await user.click(screen.getByRole('button', { name: 'New weighing area' }))
  await user.click(screen.getByRole('button', { name: 'Simulate map click to place checkpoint' }))
  await user.type(screen.getByRole('textbox', { name: 'Weighing area name' }), 'South Scale')
  await user.click(screen.getByRole('button', { name: 'Create weighing area' }))

  expect(
    await screen.findByText('Unable to create weighing area “South Scale”'),
  ).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Weighing area name' })).toHaveValue('South Scale')
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('10.5')
})
