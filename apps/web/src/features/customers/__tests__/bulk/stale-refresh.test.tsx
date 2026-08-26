import { fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import type { CustomerDto } from '@/features/customers/types'
import { server } from '@/test/msw/server'
import { API_BASE_URL, CUSTOMERS } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('retains a not-found blocker after its customer disappears on refetch', async () => {
  let currentCustomers: CustomerDto[] = CUSTOMERS
  const requestBodies: unknown[] = []
  let initialArchiveCompleted = false
  let listRequests = 0
  let resolveFirstRequest!: () => void
  let resolveRefetch!: () => void
  const firstRequestReceived = new Promise<void>((resolve) => {
    resolveFirstRequest = resolve
  })
  const refetchReceived = new Promise<void>((resolve) => {
    resolveRefetch = resolve
  })

  mockCustomers()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/customers`, () => {
      listRequests += 1
      if (initialArchiveCompleted) {
        resolveRefetch()
      }
      return HttpResponse.json({ data: currentCustomers })
    }),
    http.post(`${API_BASE_URL}/api/v1/customers/archive`, async ({ request }) => {
      requestBodies.push(await request.json())
      currentCustomers = currentCustomers.filter((customer) => customer.id !== 'available-1')
      resolveFirstRequest()
      initialArchiveCompleted = true

      return HttpResponse.json({
        data: {
          updatedCustomers: [],
          blockedCustomers: [
            {
              id: 'available-1',
              code: null,
              companyName: null,
              reason: 'NOT_FOUND',
            },
          ],
        },
      })
    }),
  )

  renderCustomers()
  const table = await screen.findByRole('table', { name: 'Available customers' })
  const initialListRequests = listRequests
  fireEvent.click(within(table).getByRole('checkbox', { name: 'Select customer ACME-01' }))
  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  fireEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Archive' }),
  )

  await firstRequestReceived
  await withTimeout(refetchReceived, 'Customer list was not refetched')
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(document.body.textContent).toContain('1 customer unchanged')
  expect(document.body.textContent).toContain('not found')
  expect(document.body.textContent).toContain('Available (1)')

  expect(listRequests).toBeGreaterThan(initialListRequests)
  // The blocked customer stays selected, so the toolbar's own button offers the retry.
  expect(document.body.textContent).toContain('Archive selected')
  expect(requestBodies).toEqual([{ ids: ['available-1'], comment: null }])
})

function withTimeout(promise: Promise<void>, message: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), 1_000)),
  ])
}
