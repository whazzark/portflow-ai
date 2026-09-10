import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { API_BASE_URL, DOCK_OBSERVER } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const ALPHA_SCALE = WEIGHING_AREAS[0]
const RETIRED_SCALE = WEIGHING_AREAS[1]

test('does not offer editing to a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(
    await screen.findByRole('button', {
      name: `View weighing area ${ALPHA_SCALE.name} (Available)`,
    }),
  )
  await screen.findByRole('heading', { name: ALPHA_SCALE.name })

  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

test('does not offer editing an archived weighing area, even to an administrator', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await user.click(
    await screen.findByRole('button', {
      name: `View weighing area ${RETIRED_SCALE.name} (Archived)`,
    }),
  )
  await screen.findByRole('heading', { name: RETIRED_SCALE.name })

  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  expect(
    screen.getByText('Archived weighing areas cannot receive new operations.'),
  ).toBeInTheDocument()
})

test('ignores a direct edit=weighing-area URL for a non-administrator', async () => {
  mockDocks(DOCK_OBSERVER)
  renderCheckpoints(`/checkpoints?checkpoint=weighing-area:${ALPHA_SCALE.id}&edit=weighing-area`)

  expect(await screen.findByRole('heading', { name: ALPHA_SCALE.name })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit weighing area' })).not.toBeInTheDocument()
})

test('ignores a direct edit=weighing-area URL for an archived weighing area', async () => {
  mockDocks()
  renderCheckpoints(`/checkpoints?checkpoint=weighing-area:${RETIRED_SCALE.id}&edit=weighing-area`)

  expect(await screen.findByRole('heading', { name: RETIRED_SCALE.name })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit weighing area' })).not.toBeInTheDocument()
})

test('keeps the form open and names reactivation when the weighing area was archived mid-edit', async () => {
  mockDocks()
  const user = userEvent.setup()
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/weighing-areas/${ALPHA_SCALE.id}`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_WEIGHING_AREA_ARCHIVED',
            message: 'Archived weighing areas are read-only',
          },
        },
        { status: 409 },
      ),
    ),
  )
  renderCheckpoints()

  await user.click(
    await screen.findByRole('button', {
      name: `View weighing area ${ALPHA_SCALE.name} (Available)`,
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await screen.findByRole('heading', { name: 'Edit weighing area' })

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText(/reactivate the weighing area/i)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Edit weighing area' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Weighing area name' })).toHaveValue(ALPHA_SCALE.name)
})

test('exits edit mode and clears the selection when the weighing area is no longer found', async () => {
  mockDocks()
  const user = userEvent.setup()
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/weighing-areas/${ALPHA_SCALE.id}`, () =>
      HttpResponse.json(
        { error: { code: 'E_WEIGHING_AREA_NOT_FOUND', message: 'Weighing area not found' } },
        { status: 404 },
      ),
    ),
  )
  const { router } = renderCheckpoints()

  await user.click(
    await screen.findByRole('button', {
      name: `View weighing area ${ALPHA_SCALE.name} (Available)`,
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await screen.findByRole('heading', { name: 'Edit weighing area' })

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Edit weighing area' })).not.toBeInTheDocument(),
  )
  expect((router.state.location.search as { checkpointId?: string }).checkpointId).toBeUndefined()
  expect((router.state.location.search as { edit?: string }).edit).toBeUndefined()
})
