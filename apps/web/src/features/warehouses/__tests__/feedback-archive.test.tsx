import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, WAREHOUSES } from './support/fixtures'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const NORTH_SHED = WAREHOUSES[0]
const ARCHIVE_URL = `${API_BASE_URL}/api/v1/warehouses/${NORTH_SHED.id}/archive`

async function openArchiveDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: `View warehouse ${NORTH_SHED.name} (Available)` }),
  )
  await user.click(await screen.findByRole('button', { name: 'Archive' }))

  return screen.findByRole('alertdialog')
}

function refuse(code: string, message: string, status = 409) {
  return http.post(ARCHIVE_URL, () => HttpResponse.json({ error: { code, message } }, { status }))
}

test('keeps the dialog and the typed comment after a refusal', async () => {
  mockWarehouses()
  server.use(
    refuse(
      'E_WAREHOUSE_IN_USE',
      'A door of this warehouse is used by a planned or active discharge',
    ),
  )
  const user = userEvent.setup()
  renderWarehouses()

  const dialog = await openArchiveDialog(user)
  await user.type(within(dialog).getByRole('textbox'), 'Retiring the building')
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText(/Unable to archive warehouse/)).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(within(screen.getByRole('alertdialog')).getByRole('textbox')).toHaveValue(
    'Retiring the building',
  )
})

test('distinguishes each refusal reason', async () => {
  const cases = [
    ['E_WAREHOUSE_IN_USE', 'A door of this warehouse is used by a planned or active discharge'],
    ['E_WAREHOUSE_ALREADY_ARCHIVED', 'Warehouse is already archived'],
    ['E_WAREHOUSE_NOT_FOUND', 'Warehouse not found'],
  ] as const

  for (const [code, message] of cases) {
    mockWarehouses()
    server.use(refuse(code, message, code === 'E_WAREHOUSE_NOT_FOUND' ? 404 : 409))
    const user = userEvent.setup()
    const { unmount } = renderWarehouses()

    const dialog = await openArchiveDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

    expect(await screen.findByText(message)).toBeInTheDocument()
    unmount()
  }
})

test('surfaces the field-level detail of a comment validation failure', async () => {
  mockWarehouses()
  server.use(
    http.post(ARCHIVE_URL, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_VALIDATION_ERROR',
            message: 'Validation failure',
            details: [
              {
                field: 'comment',
                message: 'The comment field must not exceed 1000 characters',
                rule: 'maxLength',
              },
            ],
          },
        },
        { status: 422 },
      ),
    ),
  )
  const user = userEvent.setup()
  renderWarehouses()

  const dialog = await openArchiveDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText('The comment field must not exceed 1000 characters'),
  ).toBeInTheDocument()
})

test('recovers when a transient failure is resolved and the archival is retried', async () => {
  let attempts = 0
  mockWarehouses()
  server.use(
    http.post(ARCHIVE_URL, () => {
      attempts += 1
      if (attempts === 1) {
        return HttpResponse.json(
          { error: { code: 'E_INTERNAL_ERROR', message: 'Service temporarily unavailable' } },
          { status: 503 },
        )
      }

      return HttpResponse.json({
        data: {
          warehouse: { ...NORTH_SHED, status: 'ARCHIVED' },
          archivedDoorCount: 1,
        },
      })
    }),
  )
  const user = userEvent.setup()
  renderWarehouses()

  const dialog = await openArchiveDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))
  expect(await screen.findByText('Service temporarily unavailable')).toBeInTheDocument()

  // The dialog is still open, so the retry needs no reopening.
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText(`Warehouse “${NORTH_SHED.name}” archived with 1 door`),
  ).toBeInTheDocument()
  expect(attempts).toBe(2)
})
