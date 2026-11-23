import { fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL } from '../support/fixtures'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

function conflict(code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status: 409 })
}

async function submitCreation(code: string, companyName: string) {
  const sheet = await screen.findByRole('dialog', { name: 'Create customer' })
  fireEvent.change(within(sheet).getByRole('textbox', { name: 'Customer code' }), {
    target: { value: code },
  })
  fireEvent.change(within(sheet).getByRole('textbox', { name: 'Company name' }), {
    target: { value: companyName },
  })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Create customer' }))

  return sheet
}

test('names the customer that already uses a code on the code field', async () => {
  mockCustomers()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/customers`, () =>
      conflict('E_CUSTOMER_CODE_CONFLICT', 'Customer code is already in use'),
    ),
  )

  renderCustomers('/customers?mode=create')
  const sheet = await submitCreation(' acme-01 ', 'Acme Minerals')

  const code = within(sheet).getByRole('textbox', { name: 'Customer code' })
  expect(await within(sheet).findByText('Already used by Acme Logistics.')).toBeInTheDocument()
  expect(code).toHaveAttribute('aria-invalid', 'true')
  expect(code).toHaveValue(' acme-01 ')
  expect(within(sheet).getByRole('textbox', { name: 'Company name' })).toHaveValue('Acme Minerals')
  expect(screen.queryByText(/Unable to create customer/)).not.toBeInTheDocument()
})

test('falls back to a generic owner when the list does not hold it', async () => {
  mockCustomers()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/customers`, () =>
      conflict('E_CUSTOMER_CODE_CONFLICT', 'Customer code is already in use'),
    ),
  )

  renderCustomers('/customers?mode=create')
  const sheet = await submitCreation('GHOST-09', 'Ghost Shipping')

  expect(await within(sheet).findByText('Already used by another customer.')).toBeInTheDocument()
})

test('names the customer that already uses a company name on the company field', async () => {
  mockCustomers()
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/customers/available-1`, () =>
      conflict('E_CUSTOMER_COMPANY_NAME_CONFLICT', 'Customer company name is already in use'),
    ),
  )

  renderCustomers('/customers?customerId=available-1&mode=edit')
  const sheet = await screen.findByRole('dialog', { name: 'Edit customer' })
  fireEvent.change(within(sheet).getByRole('textbox', { name: 'Company name' }), {
    target: { value: 'bêta maritime' },
  })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

  expect(await within(sheet).findByText('Already used by BETA-02.')).toBeInTheDocument()
  expect(within(sheet).getByRole('textbox', { name: 'Company name' })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
})
