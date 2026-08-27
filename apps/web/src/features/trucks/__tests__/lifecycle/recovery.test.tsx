import { fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import { ACTIVE_OPERATIONS_ADMIN, API_BASE_URL, TRUCKS } from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

const TARGET = TRUCKS[0]

async function openAndStartArchiving() {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  renderTrucks()
  fireEvent.click(
    await screen.findByRole('button', { name: `${TARGET.registration}, Atlantic Transport` }),
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))

  return screen.findByRole('alertdialog')
}

test('a refusal keeps the dialog open with the typed comment, and a corrected resubmit succeeds', async () => {
  let attempt = 0

  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/${TARGET.id}/archive`, () => {
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
      return HttpResponse.json({ data: { ...TARGET, status: 'ARCHIVED' } })
    }),
  )

  const dialog = await openAndStartArchiving()
  const comment = within(dialog).getByRole('textbox', { name: 'Comment (optional)' })
  // maxLength=1000 on the field blocks typing past the limit, so an over-long value that reaches
  // the server has to be set programmatically here.
  fireEvent.change(comment, { target: { value: 'a'.repeat(1001) } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText(`Unable to archive truck “${TARGET.registration}”`),
  ).toBeInTheDocument()
  // The field-level detail, not the generic "Validation failure", is what says what to fix.
  expect(screen.getByText('The comment field must not exceed 1000 characters')).toBeInTheDocument()
  // The dialog stays open with the comment intact, so the administrator corrects and resubmits
  // without reopening the truck.
  expect(screen.getByRole('heading', { name: 'Archive truck?' })).toBeInTheDocument()
  expect(comment).toHaveValue('a'.repeat(1001))

  fireEvent.change(comment, { target: { value: 'Shortened' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText(`Truck “${TARGET.registration}” archived`)).toBeInTheDocument()
})

test('an in-use refusal names its own reason and leaves the truck available', async () => {
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/${TARGET.id}/archive`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_TRUCK_IN_USE',
            message: 'Truck is used by a planned or active discharge',
          },
        },
        { status: 409 },
      ),
    ),
  )

  const dialog = await openAndStartArchiving()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText('Truck is used by a planned or active discharge'),
  ).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Archive truck?' })).toBeInTheDocument()
})
