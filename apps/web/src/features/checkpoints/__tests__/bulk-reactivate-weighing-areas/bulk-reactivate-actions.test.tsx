import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { API_BASE_URL } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const ALPHA_SCALE = WEIGHING_AREAS[0]
const RETIRED_SCALE = WEIGHING_AREAS[1]
const GAMMA_SCALE = WEIGHING_AREAS[3]

async function enterSelectModeAndCheck(
  user: ReturnType<typeof userEvent.setup>,
  ...names: string[]
) {
  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))
  for (const name of names) {
    await user.click(screen.getByRole('button', { name: `Select weighing area ${name}` }))
  }
}

test('reactivates a fully eligible selection with a shared comment and clears it', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas/reactivate`, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({
        data: {
          updatedWeighingAreas: [
            { ...RETIRED_SCALE, status: 'AVAILABLE' },
            { ...GAMMA_SCALE, status: 'AVAILABLE' },
          ],
          blockedWeighingAreas: [],
        },
      })
    }),
  )

  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=archived')
  await enterSelectModeAndCheck(user, RETIRED_SCALE.name, GAMMA_SCALE.name)

  await user.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  await screen.findByRole('heading', { name: 'Reactivate selected weighing areas?' })
  expect(
    screen.getByText('These weighing areas will be offered again for new operational work.'),
  ).toBeInTheDocument()
  await user.type(screen.getByRole('textbox', { name: /comment/i }), 'Weighing lane reopened')
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('2 weighing areas reactivated')).toBeInTheDocument()
  expect(capturedBody).toMatchObject({
    ids: [RETIRED_SCALE.id, GAMMA_SCALE.id],
    comment: 'Weighing lane reopened',
  })
  expect(screen.queryByText('2 selected')).not.toBeInTheDocument()
})

test('reports each blocked weighing area with its reason and still clears the whole selection', async () => {
  const user = userEvent.setup()

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas/reactivate`, () =>
      HttpResponse.json({
        data: {
          updatedWeighingAreas: [{ ...RETIRED_SCALE, status: 'AVAILABLE' }],
          blockedWeighingAreas: [
            { id: GAMMA_SCALE.id, name: GAMMA_SCALE.name, reason: 'ALREADY_AVAILABLE' },
          ],
        },
      }),
    ),
  )

  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=archived')
  await enterSelectModeAndCheck(user, RETIRED_SCALE.name, GAMMA_SCALE.name)

  await user.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  await screen.findByRole('heading', { name: 'Reactivate selected weighing areas?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('1 weighing area reactivated; 1 unchanged')).toBeInTheDocument()
  expect(screen.getByText(`${GAMMA_SCALE.name}: already available`)).toBeInTheDocument()
  // Neither reactivation blocker becomes eligible on a retry, so nothing stays checked — not even
  // the blocked entry, unlike the archive path's IN_USE handling.
  expect(screen.queryByText('2 selected')).not.toBeInTheDocument()
  expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
})

test('an all-blocked submission reports every reason rather than an error', async () => {
  const user = userEvent.setup()

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas/reactivate`, () =>
      HttpResponse.json({
        data: {
          updatedWeighingAreas: [],
          blockedWeighingAreas: [
            { id: RETIRED_SCALE.id, name: RETIRED_SCALE.name, reason: 'ALREADY_AVAILABLE' },
            { id: GAMMA_SCALE.id, reason: 'NOT_FOUND' },
          ],
        },
      }),
    ),
  )

  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=archived')
  await enterSelectModeAndCheck(user, RETIRED_SCALE.name, GAMMA_SCALE.name)

  await user.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  await screen.findByRole('heading', { name: 'Reactivate selected weighing areas?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('0 weighing areas reactivated; 2 unchanged')).toBeInTheDocument()
  expect(
    screen.getByText(`${RETIRED_SCALE.name}: already available, ${GAMMA_SCALE.id}: not found`),
  ).toBeInTheDocument()
})

test('a failing request is reported and leaves the selection intact', async () => {
  const user = userEvent.setup()

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas/reactivate`, () =>
      HttpResponse.json(
        { error: { code: 'E_SERVER_ERROR', message: 'Something broke on the server' } },
        { status: 500 },
      ),
    ),
  )

  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=archived')
  await enterSelectModeAndCheck(user, RETIRED_SCALE.name, GAMMA_SCALE.name)

  await user.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  await screen.findByRole('heading', { name: 'Reactivate selected weighing areas?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Unable to reactivate weighing areas')).toBeInTheDocument()
  expect(screen.getByText('Something broke on the server')).toBeInTheDocument()
  expect(screen.getByText('2 selected')).toBeInTheDocument()
})

test('an available selection still archives, leaving the archive direction untouched', async () => {
  const user = userEvent.setup()
  let archiveCalled = false

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas/archive`, () => {
      archiveCalled = true
      return HttpResponse.json({
        data: {
          updatedWeighingAreas: [{ ...ALPHA_SCALE, status: 'ARCHIVED' }],
          blockedWeighingAreas: [],
        },
      })
    }),
  )

  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=available')
  await enterSelectModeAndCheck(user, ALPHA_SCALE.name)

  await user.click(screen.getByRole('button', { name: 'Archive selected' }))
  await screen.findByRole('heading', { name: 'Archive selected weighing areas?' })
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('1 weighing area archived')).toBeInTheDocument()
  expect(archiveCalled).toBe(true)
})
