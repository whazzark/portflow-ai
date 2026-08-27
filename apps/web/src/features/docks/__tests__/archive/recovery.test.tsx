import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { API_BASE_URL, DOCKS } from '@/features/docks/__tests__/support/fixtures'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../../../checkpoints/__tests__/support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const NORTH_DOCK = DOCKS[1]

async function openAndStartArchiving(user: ReturnType<typeof userEvent.setup>) {
  mockDocks()
  renderCheckpoints()
  await user.click(
    await screen.findByRole('button', { name: `View dock ${NORTH_DOCK.name} (Available)` }),
  )
  await screen.findByRole('heading', { name: NORTH_DOCK.name })
  await user.click(screen.getByRole('button', { name: 'Archive' }))
  await screen.findByRole('heading', { name: 'Archive dock?' })
}

test('a refusal keeps the dialog open with the typed comment, and a corrected resubmit succeeds', async () => {
  const user = userEvent.setup()
  let attempt = 0

  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/${NORTH_DOCK.id}/archive`, () => {
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
      return HttpResponse.json({ data: { ...NORTH_DOCK, status: 'ARCHIVED' } })
    }),
  )

  await openAndStartArchiving(user)
  // maxLength=1000 on the field blocks typing past the limit, so an over-long value that reaches
  // the server has to be set programmatically here.
  fireEvent.change(screen.getByRole('textbox', { name: /comment/i }), {
    target: { value: 'a'.repeat(1001) },
  })
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText(`Unable to archive dock “${NORTH_DOCK.name}”`)).toBeInTheDocument()
  // The field-level detail, not the generic "Validation failure", is what says what to fix.
  expect(screen.getByText('The comment field must not exceed 1000 characters')).toBeInTheDocument()
  // The dialog stays open with the comment intact, so the administrator corrects and resubmits
  // without reopening the dock.
  expect(screen.getByRole('heading', { name: 'Archive dock?' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: /comment/i })).toHaveValue('a'.repeat(1001))

  fireEvent.change(screen.getByRole('textbox', { name: /comment/i }), {
    target: { value: 'Shortened' },
  })
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText(`Dock “${NORTH_DOCK.name}” archived`)).toBeInTheDocument()
})

test('an in-use refusal names its own reason and leaves the dock available', async () => {
  const user = userEvent.setup()

  server.use(
    http.post(`${API_BASE_URL}/api/v1/docks/${NORTH_DOCK.id}/archive`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_DOCK_IN_USE',
            message: 'Dock is used by a planned or active discharge',
          },
        },
        { status: 409 },
      ),
    ),
  )

  await openAndStartArchiving(user)
  await user.click(screen.getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText('Dock is used by a planned or active discharge'),
  ).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Archive dock?' })).toBeInTheDocument()
})
