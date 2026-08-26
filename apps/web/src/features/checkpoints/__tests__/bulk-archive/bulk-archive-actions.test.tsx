import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { API_BASE_URL, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const BETA_DOCK = DOCKS[0]
const NORTH_DOCK = DOCKS[1]

async function enterSelectModeAndCheck(
  user: ReturnType<typeof userEvent.setup>,
  ...names: string[]
) {
  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  for (const name of names) {
    await user.click(screen.getByRole('button', { name: `Select dock ${name}` }))
  }
}

test('hides the bulk action bar until at least one dock is checked', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints()

  await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` })
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()

  await enterSelectModeAndCheck(user, NORTH_DOCK.name)

  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
})

test('archives a fully eligible selection and clears it', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/archive`, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({
        data: {
          updatedDocks: [
            { ...BETA_DOCK, status: 'ARCHIVED' },
            { ...NORTH_DOCK, status: 'ARCHIVED' },
          ],
          blockedDocks: [],
        },
      })
    }),
  )

  renderCheckpoints()
  await enterSelectModeAndCheck(user, BETA_DOCK.name, NORTH_DOCK.name)

  expect(screen.getByText('2 selected')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Archive selected' }))
  await screen.findByRole('heading', { name: 'Archive selected docks?' })
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('2 docks archived')).toBeInTheDocument()
  expect(capturedBody).toMatchObject({
    ids: [BETA_DOCK.id, NORTH_DOCK.id],
    comment: null,
  })
  expect(await screen.findByText('0 selected')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Deselect dock ${BETA_DOCK.name}` }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Deselect dock ${NORTH_DOCK.name}` }),
  ).not.toBeInTheDocument()
})

test('surfaces a failed archive request as a toast, not an inline error', async () => {
  const user = userEvent.setup()

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/archive`, () =>
      HttpResponse.json(
        { error: { code: 'E_SERVER_ERROR', message: 'Something broke on the server' } },
        { status: 500 },
      ),
    ),
  )

  renderCheckpoints()
  await enterSelectModeAndCheck(user, NORTH_DOCK.name)

  await user.click(screen.getByRole('button', { name: 'Archive selected' }))
  await screen.findByRole('heading', { name: 'Archive selected docks?' })
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('Unable to archive docks')).toBeInTheDocument()
  expect(screen.getByText('Something broke on the server')).toBeInTheDocument()
  // The dialog stays open on failure, so the administrator can retry without reselecting.
  expect(screen.getByRole('heading', { name: 'Archive selected docks?' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Archive' })).toBeEnabled()
})

test('keeps only the in-use blocked docks checked and lists every blocker with its reason', async () => {
  const user = userEvent.setup()

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/archive`, () =>
      HttpResponse.json({
        data: {
          updatedDocks: [{ ...BETA_DOCK, status: 'ARCHIVED' }],
          blockedDocks: [{ id: NORTH_DOCK.id, name: NORTH_DOCK.name, reason: 'IN_USE' }],
        },
      }),
    ),
  )

  renderCheckpoints()
  await enterSelectModeAndCheck(user, BETA_DOCK.name, NORTH_DOCK.name)

  await user.click(screen.getByRole('button', { name: 'Archive selected' }))
  await screen.findByRole('heading', { name: 'Archive selected docks?' })
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('1 dock archived; 1 dock unchanged')).toBeInTheDocument()
  expect(
    screen.getByText(`${NORTH_DOCK.name}: used by an active or planned discharge`),
  ).toBeInTheDocument()
  // No dedicated retry control: the still-checked blocked dock and the same "Archive selected"
  // button already let the administrator resubmit without a second, redundant affordance.
  expect(screen.getByText('1 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
})
