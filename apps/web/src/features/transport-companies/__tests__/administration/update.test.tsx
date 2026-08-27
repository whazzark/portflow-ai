import { fireEvent, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { server } from '@/test/msw/server'
import { ADMIN_USER, API_BASE_URL, TRANSPORT_COMPANIES } from '../support/fixtures'
import { mockTransportCompanies, renderTransportCompanies } from '../support/test-helpers'

async function openEditFor(companyName: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${companyName}` }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
}

test('lets an administrator open, pre-fill, and save a rename in the detail pane', async () => {
  const updated = {
    ...TRANSPORT_COMPANIES[0],
    name: 'Atlantique Transport Routier',
    updatedAt: '2026-08-22T00:00:00.000Z',
  }
  let currentCompanies = TRANSPORT_COMPANIES

  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  server.use(
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: currentCompanies }),
    ),
    http.patch(`${API_BASE_URL}/api/v1/transport-companies/${TRANSPORT_COMPANIES[0].id}`, () => {
      currentCompanies = currentCompanies.map((company) =>
        company.id === updated.id ? updated : company,
      )
      return HttpResponse.json({ data: updated })
    }),
  )

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openEditFor('Atlantic Transport')

  expect(await screen.findByRole('heading', { name: 'Edit transport company' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Company name' })).toHaveValue('Atlantic Transport')

  fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Atlantique Transport Routier' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(
    await screen.findByRole('heading', { name: 'Atlantique Transport Routier' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit transport company' })).not.toBeInTheDocument()
})

test('lets an administrator cancel an edit without changing the company', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openEditFor('Atlantic Transport')
  expect(await screen.findByRole('heading', { name: 'Edit transport company' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Back to details' }))

  expect(await screen.findByRole('heading', { name: 'Atlantic Transport' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit transport company' })).not.toBeInTheDocument()
})

test('attaches a validation refusal to the name field and allows resubmission', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/transport-companies/${TRANSPORT_COMPANIES[0].id}`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_VALIDATION_ERROR',
            details: [{ field: 'name', message: 'The name field must not be blank' }],
            message: 'Validation failure',
          },
        },
        { status: 422 },
      ),
    ),
  )

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openEditFor('Atlantic Transport')
  fireEvent.change(await screen.findByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Something' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('The name field must not be blank')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Edit transport company' })).toBeInTheDocument()
})

test('shows a distinct toast for a duplicate name conflict', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/transport-companies/${TRANSPORT_COMPANIES[0].id}`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_TRANSPORT_COMPANY_NAME_CONFLICT',
            message: 'Transport company name is already in use',
          },
        },
        { status: 409 },
      ),
    ),
  )

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openEditFor('Atlantic Transport')
  fireEvent.change(await screen.findByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Bêta Logistique' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(
    await screen.findByText('Unable to update transport company “Atlantic Transport”'),
  ).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Edit transport company' })).toBeInTheDocument()
})

test('allows correcting and resubmitting after a refusal without reopening the company', async () => {
  const updated = { ...TRANSPORT_COMPANIES[0], name: 'Corrected Name' }
  let attempt = 0
  let currentCompanies = TRANSPORT_COMPANIES

  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  server.use(
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: currentCompanies }),
    ),
    http.patch(`${API_BASE_URL}/api/v1/transport-companies/${TRANSPORT_COMPANIES[0].id}`, () => {
      attempt += 1
      if (attempt === 1) {
        return HttpResponse.json(
          {
            error: {
              code: 'E_VALIDATION_ERROR',
              details: [{ field: 'name', message: 'The name field must not be blank' }],
              message: 'Validation failure',
            },
          },
          { status: 422 },
        )
      }
      currentCompanies = currentCompanies.map((company) =>
        company.id === updated.id ? updated : company,
      )
      return HttpResponse.json({ data: updated })
    }),
  )

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openEditFor('Atlantic Transport')
  fireEvent.change(await screen.findByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Bad Value' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('The name field must not be blank')).toBeInTheDocument()

  fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Corrected Name' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('heading', { name: 'Corrected Name' })).toBeInTheDocument()
})
