import { fireEvent, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import type { CustomerDto } from '@/features/customers/types'
import { server } from '@/test/msw/server'
import { API_BASE_URL, CUSTOMERS } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('creates a customer and exposes it in the list and detail sheet', async () => {
  const created: CustomerDto = {
    ...CUSTOMERS[0],
    id: 'created-1',
    code: 'NEW-04',
    companyName: 'New Harbor',
  }
  let currentCustomers = CUSTOMERS

  mockCustomers()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/customers`, () =>
      HttpResponse.json({ data: currentCustomers }),
    ),
    http.post(`${API_BASE_URL}/api/v1/customers`, () => {
      currentCustomers = [...currentCustomers, created]
      return HttpResponse.json({ data: created }, { status: 201 })
    }),
  )

  renderCustomers()
  await screen.findByRole('table', { name: 'Available customers' })
  fireEvent.click(screen.getByRole('button', { name: 'Create customer' }))

  fireEvent.change(await screen.findByRole('textbox', { name: 'Customer code' }), {
    target: { value: created.code },
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), {
    target: { value: created.companyName },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create customer' }))

  expect(await screen.findByRole('heading', { name: created.companyName })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(
    await screen.findByRole('button', { name: `View customer ${created.code}` }),
  ).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: 'Available (3)' })).toBeInTheDocument(),
  )
})
