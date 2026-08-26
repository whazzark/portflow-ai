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

const RETIRED_DOCK = DOCKS[2]

async function enterSelectModeAndCheck(
  user: ReturnType<typeof userEvent.setup>,
  ...names: string[]
) {
  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  for (const name of names) {
    await user.click(screen.getByRole('button', { name: `Select dock ${name}` }))
  }
}

test('reactivates a fully eligible selection and clears it', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/reactivate`, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({
        data: {
          updatedDocks: [{ ...RETIRED_DOCK, status: 'AVAILABLE' }],
          blockedDocks: [],
        },
      })
    }),
  )

  renderCheckpoints()
  await enterSelectModeAndCheck(user, RETIRED_DOCK.name)

  expect(screen.getByText('1 selected')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  await screen.findByRole('heading', { name: 'Reactivate selected docks?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('1 dock reactivated')).toBeInTheDocument()
  expect(capturedBody).toMatchObject({
    ids: [RETIRED_DOCK.id],
    comment: null,
  })
  expect(await screen.findByText('0 selected')).toBeInTheDocument()
})

test('reactivates a selection with a shared comment', async () => {
  const user = userEvent.setup()
  let capturedBody: unknown

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/reactivate`, async ({ request }) => {
      capturedBody = await request.json()
      return HttpResponse.json({
        data: { updatedDocks: [{ ...RETIRED_DOCK, status: 'AVAILABLE' }], blockedDocks: [] },
      })
    }),
  )

  renderCheckpoints()
  await enterSelectModeAndCheck(user, RETIRED_DOCK.name)

  await user.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  await screen.findByRole('heading', { name: 'Reactivate selected docks?' })
  await user.type(screen.getByRole('textbox', { name: /comment/i }), 'Quay reopened')
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('1 dock reactivated')).toBeInTheDocument()
  expect(capturedBody).toMatchObject({ comment: 'Quay reopened' })
})

test('surfaces a failed reactivation request as a toast, not an inline error', async () => {
  const user = userEvent.setup()

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/reactivate`, () =>
      HttpResponse.json(
        { error: { code: 'E_SERVER_ERROR', message: 'Something broke on the server' } },
        { status: 500 },
      ),
    ),
  )

  renderCheckpoints()
  await enterSelectModeAndCheck(user, RETIRED_DOCK.name)

  await user.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  await screen.findByRole('heading', { name: 'Reactivate selected docks?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Unable to reactivate docks')).toBeInTheDocument()
  expect(screen.getByText('Something broke on the server')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Reactivate selected docks?' })).toBeInTheDocument()
  // The selection is left intact so the administrator can retry without reselecting.
  expect(screen.getByText('1 selected')).toBeInTheDocument()
})

test('a mixed result clears the whole selection, blocked docks included, and lists each reason', async () => {
  const user = userEvent.setup()

  mockDocks()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/reactivate`, () =>
      HttpResponse.json({
        data: {
          updatedDocks: [{ ...RETIRED_DOCK, status: 'AVAILABLE' }],
          blockedDocks: [{ id: '99999999-9999-4999-8999-999999999999', reason: 'NOT_FOUND' }],
        },
      }),
    ),
  )

  renderCheckpoints()
  await user.click(await screen.findByRole('button', { name: 'Select docks' }))
  await user.click(screen.getByRole('button', { name: `Select dock ${RETIRED_DOCK.name}` }))

  await user.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  await screen.findByRole('heading', { name: 'Reactivate selected docks?' })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('1 dock reactivated; 1 dock unchanged')).toBeInTheDocument()
  expect(screen.getByText('99999999-9999-4999-8999-999999999999: not found')).toBeInTheDocument()
  // Unlike archiving's IN_USE, neither reactivation blocker is retryable — the whole selection
  // is cleared rather than leaving the blocked entry checked.
  expect(await screen.findByText('0 selected')).toBeInTheDocument()
})
