import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { API_BASE_URL } from '@/features/docks/__tests__/support/fixtures'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const RETIRED_SCALE = WEIGHING_AREAS[1]

async function openAndStartReactivating(user: ReturnType<typeof userEvent.setup>) {
  mockDocks()
  renderCheckpoints('/checkpoints?status=all')
  await user.click(
    await screen.findByRole('button', {
      name: `View weighing area ${RETIRED_SCALE.name} (Archived)`,
    }),
  )
  await screen.findByRole('heading', { name: RETIRED_SCALE.name })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))
  await screen.findByRole('heading', { name: 'Reactivate weighing area?' })
}

test('an over-long comment is refused in a toast, keeps the dialog open, and a shortened resubmit succeeds', async () => {
  const user = userEvent.setup()
  let attempt = 0

  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas/${RETIRED_SCALE.id}/reactivate`, () => {
      attempt += 1
      if (attempt === 1) {
        return HttpResponse.json(
          {
            error: {
              code: 'E_VALIDATION_ERROR',
              message: 'Validation failure',
              details: [
                { field: 'comment', message: 'The comment field must not exceed 1000 characters' },
              ],
            },
          },
          { status: 422 },
        )
      }
      return HttpResponse.json({ data: { ...RETIRED_SCALE, status: 'AVAILABLE' } })
    }),
  )

  await openAndStartReactivating(user)
  // maxLength=1000 on the field itself blocks typing past the limit, so an over-long value that
  // reaches the server has to be set programmatically here — this proves the server-side rejection
  // path renders correctly, not that the UI's own client-side limit can be bypassed by typing.
  fireEvent.change(screen.getByRole('textbox', { name: /comment/i }), {
    target: { value: 'a'.repeat(1001) },
  })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(
    await screen.findByText(`Unable to reactivate weighing area “${RETIRED_SCALE.name}”`),
  ).toBeInTheDocument()
  // The field-level detail, not the generic "Validation failure", is what tells the administrator
  // what to fix.
  expect(screen.getByText('The comment field must not exceed 1000 characters')).toBeInTheDocument()
  // The dialog stays open and the typed comment is preserved, so the administrator can correct and
  // resubmit without reopening the weighing area (spec US3 scenario 3).
  expect(screen.getByRole('heading', { name: 'Reactivate weighing area?' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: /comment/i })).toHaveValue('a'.repeat(1001))

  fireEvent.change(screen.getByRole('textbox', { name: /comment/i }), {
    target: { value: 'Shortened' },
  })
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Weighing area reactivated')).toBeInTheDocument()
})

test('an already-available refusal surfaces in a toast with its own distinct reason', async () => {
  const user = userEvent.setup()

  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas/${RETIRED_SCALE.id}/reactivate`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_WEIGHING_AREA_ALREADY_AVAILABLE',
            message: 'Weighing area is already available',
          },
        },
        { status: 409 },
      ),
    ),
  )

  await openAndStartReactivating(user)
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Weighing area is already available')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Reactivate weighing area?' })).toBeInTheDocument()
})

test('a not-found refusal surfaces in a toast with its own distinct reason', async () => {
  const user = userEvent.setup()

  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas/${RETIRED_SCALE.id}/reactivate`, () =>
      HttpResponse.json(
        { error: { code: 'E_WEIGHING_AREA_NOT_FOUND', message: 'Weighing area not found' } },
        { status: 404 },
      ),
    ),
  )

  await openAndStartReactivating(user)
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Weighing area not found')).toBeInTheDocument()
})

test('a transient failure surfaces in a toast and a retry after recovery succeeds', async () => {
  const user = userEvent.setup()
  let attempt = 0

  server.use(
    http.post(`${API_BASE_URL}/api/v1/weighing-areas/${RETIRED_SCALE.id}/reactivate`, () => {
      attempt += 1
      if (attempt === 1) {
        return HttpResponse.json(
          { error: { code: 'E_SERVER_ERROR', message: 'Something broke on the server' } },
          { status: 500 },
        )
      }
      return HttpResponse.json({ data: { ...RETIRED_SCALE, status: 'AVAILABLE' } })
    }),
  )

  await openAndStartReactivating(user)
  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Something broke on the server')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reactivate' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Weighing area reactivated')).toBeInTheDocument()
})
