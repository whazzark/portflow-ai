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

const ALPHA_SCALE = WEIGHING_AREAS[0]
const BETA_SCALE = WEIGHING_AREAS[2]

async function openEditWeighingArea(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', {
      name: `View weighing area ${ALPHA_SCALE.name} (Available)`,
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await screen.findByRole('heading', { name: 'Edit weighing area' })
}

test('rejects a blank weighing area name with an inline field error and preserves the position', async () => {
  const user = userEvent.setup()
  renderCheckpoints()
  await openEditWeighingArea(user)

  const nameInput = screen.getByRole('textbox', { name: 'Weighing area name' })
  await user.clear(nameInput)
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Weighing area name is required.')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue(
    String(ALPHA_SCALE.latitude),
  )
  expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue(
    String(ALPHA_SCALE.longitude),
  )
})

test('rejects a whitespace-only weighing area name', async () => {
  const user = userEvent.setup()
  renderCheckpoints()
  await openEditWeighingArea(user)

  const nameInput = screen.getByRole('textbox', { name: 'Weighing area name' })
  await user.clear(nameInput)
  await user.type(nameInput, '   ')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Weighing area name is required.')).toBeInTheDocument()
})

test('rejects an over-long weighing area name without saving', async () => {
  const user = userEvent.setup()
  renderCheckpoints()
  await openEditWeighingArea(user)

  const nameInput = screen.getByRole('textbox', { name: 'Weighing area name' })
  await user.clear(nameInput)
  await user.click(nameInput)
  await user.paste('a'.repeat(256))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(nameInput).toHaveAttribute('aria-invalid', 'true'))
  expect(screen.queryByText(`Weighing area “${ALPHA_SCALE.name}” updated`)).not.toBeInTheDocument()
})

test('rejects a manually edited out-of-range coordinate and disables submission', async () => {
  const user = userEvent.setup()
  renderCheckpoints()
  await openEditWeighingArea(user)

  const latitudeInput = screen.getByRole('textbox', { name: 'Latitude' })
  await user.clear(latitudeInput)
  await user.type(latitudeInput, '91')

  expect(await screen.findByText('Latitude must be between -90 and 90.')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled())
})

test('rejects a non-numeric coordinate', async () => {
  const user = userEvent.setup()
  renderCheckpoints()
  await openEditWeighingArea(user)

  const longitudeInput = screen.getByRole('textbox', { name: 'Longitude' })
  await user.clear(longitudeInput)
  await user.type(longitudeInput, 'abc')

  expect(await screen.findByText('Longitude must be a number.')).toBeInTheDocument()
})

test('rejects a duplicate weighing area name inline on the name field and keeps entered values', async () => {
  const user = userEvent.setup()
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/weighing-areas/${ALPHA_SCALE.id}`, () =>
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
  await openEditWeighingArea(user)

  const nameInput = screen.getByRole('textbox', { name: 'Weighing area name' })
  await user.clear(nameInput)
  await user.type(nameInput, BETA_SCALE.name)
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Weighing area name is already in use')).toBeInTheDocument()
  expect(nameInput).toHaveValue(BETA_SCALE.name)
  expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue(
    String(ALPHA_SCALE.latitude),
  )
})

test('recovers from a rejected submission by correcting and resubmitting without reopening', async () => {
  const user = userEvent.setup()
  let callCount = 0

  server.use(
    http.patch(`${API_BASE_URL}/api/v1/weighing-areas/${ALPHA_SCALE.id}`, () => {
      callCount += 1
      if (callCount === 1) {
        return HttpResponse.json(
          {
            error: {
              code: 'E_WEIGHING_AREA_NAME_CONFLICT',
              message: 'Weighing area name is already in use',
            },
          },
          { status: 409 },
        )
      }
      return HttpResponse.json({ data: { ...ALPHA_SCALE, name: 'Corrected Scale' } })
    }),
  )

  renderCheckpoints()
  await openEditWeighingArea(user)

  const nameInput = screen.getByRole('textbox', { name: 'Weighing area name' })
  await user.clear(nameInput)
  await user.type(nameInput, BETA_SCALE.name)
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Weighing area name is already in use')).toBeInTheDocument()

  await user.clear(nameInput)
  await user.type(nameInput, 'Corrected Scale')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Weighing area “Corrected Scale” updated')).toBeInTheDocument()
})
