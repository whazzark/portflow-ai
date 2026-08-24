import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { server } from '@/test/msw/server'
import {
  ADMIN_USER,
  API_BASE_URL,
  createdTransportCompany,
  TRANSPORT_COMPANIES,
} from '../support/fixtures'
import {
  mockTransportCompanies,
  mockTransportCompanyCreation,
  mockTransportCompanyCreationFailure,
  renderTransportCompanies,
} from '../support/test-helpers'

function openCreateForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Create transport company' }))
}

// The embedded truck panel renders its own Available/Archived tabs, so company counts must be
// read from the company tablist rather than from the whole document.
function companyTab(name: string) {
  return within(screen.getByRole('tablist', { name: 'Transport company status' })).getByRole(
    'tab',
    { name },
  )
}

test('lets an administrator create a company and lands on its details', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  const state = mockTransportCompanyCreation()

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  openCreateForm()

  expect(
    await screen.findByRole('heading', { name: 'Create transport company' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Company name' })).toHaveValue('')

  fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Atlantique Transport Routier' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create transport company' }))

  expect(
    await screen.findByRole('heading', { name: 'Atlantique Transport Routier' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Create transport company' }),
  ).not.toBeInTheDocument()
  expect(state.attempts).toBe(1)
})

test('shows the created company in the available directory without a manual refresh', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyCreation()

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  expect(companyTab('Available (2)')).toBeInTheDocument()

  openCreateForm()
  fireEvent.change(await screen.findByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Baie Douarnenez Transports' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create transport company' }))

  // The open sheet marks the rest of the page inert, so the directory can only be read once it
  // is closed. Closing first is also how an administrator actually returns to the list.
  expect(
    await screen.findByRole('heading', { name: 'Baie Douarnenez Transports' }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

  await waitFor(() => expect(companyTab('Available (3)')).toBeInTheDocument())
  expect(
    within(screen.getByRole('list', { name: 'Available transport companies' })).getByText(
      'Baie Douarnenez Transports',
    ),
  ).toBeInTheDocument()
})

test('restores the create form from the URL after a reload', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyCreation()

  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderTransportCompanies('/transport-resources?companyDetailsMode=create')

  expect(
    await screen.findByRole('heading', { name: 'Create transport company' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Company name' })).toHaveValue('')
})

test('offers creation from the empty available collection', async () => {
  mockTrucks()
  mockTransportCompanies([], ADMIN_USER)
  mockTransportCompanyCreation([])

  renderTransportCompanies()
  expect(await screen.findByText('No available transport companies')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Create a transport company' }))
  fireEvent.change(await screen.findByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Première Société' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create transport company' }))

  expect(await screen.findByRole('heading', { name: 'Première Société' })).toBeInTheDocument()
})

test('creates nothing when the administrator cancels', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  const state = mockTransportCompanyCreation()

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  openCreateForm()
  expect(
    await screen.findByRole('heading', { name: 'Create transport company' }),
  ).toBeInTheDocument()

  fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Abandonnée' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(state.attempts).toBe(0)
  expect(companyTab('Available (2)')).toBeInTheDocument()
})

test('creates a company whose name the server trims', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyCreation()

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  openCreateForm()
  fireEvent.change(await screen.findByRole('textbox', { name: 'Company name' }), {
    target: { value: '  Grand OUEST Camions  ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create transport company' }))

  expect(await screen.findByRole('heading', { name: 'Grand OUEST Camions' })).toBeInTheDocument()
})

test('attaches a validation refusal to the name field and keeps the form open', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyCreationFailure(422, {
    code: 'E_VALIDATION_ERROR',
    details: [{ field: 'name', message: 'The name field must not be blank' }],
    message: 'Validation failure',
  })

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  openCreateForm()
  fireEvent.change(await screen.findByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Something' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create transport company' }))

  expect(await screen.findByText('The name field must not be blank')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Create transport company' })).toBeInTheDocument()
})

test('shows a distinct toast for a duplicate name conflict', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyCreationFailure(409, {
    code: 'E_TRANSPORT_COMPANY_NAME_CONFLICT',
    message: 'Transport company name is already in use',
  })

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  openCreateForm()
  fireEvent.change(await screen.findByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Atlantic Transport' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create transport company' }))

  expect(await screen.findByText('Unable to create transport company')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Create transport company' })).toBeInTheDocument()
})

test('allows correcting and resubmitting after a refusal, creating exactly one company', async () => {
  let attempt = 0
  let companies = TRANSPORT_COMPANIES
  const created = createdTransportCompany('Corrected Name')

  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  server.use(
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: companies }),
    ),
    http.post(`${API_BASE_URL}/api/v1/transport-companies`, () => {
      attempt += 1
      if (attempt === 1) {
        return HttpResponse.json(
          {
            error: {
              code: 'E_TRANSPORT_COMPANY_NAME_CONFLICT',
              message: 'Transport company name is already in use',
            },
          },
          { status: 409 },
        )
      }
      companies = [...companies, created]
      return HttpResponse.json({ data: created }, { status: 201 })
    }),
  )

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  openCreateForm()
  fireEvent.change(await screen.findByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Atlantic Transport' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create transport company' }))
  expect(await screen.findByText('Unable to create transport company')).toBeInTheDocument()

  fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Corrected Name' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create transport company' }))

  expect(await screen.findByRole('heading', { name: 'Corrected Name' })).toBeInTheDocument()
  expect(attempt).toBe(2)
  expect(companies.filter((company) => company.name === 'Corrected Name')).toHaveLength(1)
})

test('refuses a blank name before reaching the server', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  const state = mockTransportCompanyCreation()

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  openCreateForm()
  fireEvent.change(await screen.findByRole('textbox', { name: 'Company name' }), {
    target: { value: '   ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create transport company' }))

  expect(await screen.findByText('Company name is required.')).toBeInTheDocument()
  expect(state.attempts).toBe(0)
})

test('shows the created company as a selectable provider owning no truck', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyCreation()

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  openCreateForm()
  fireEvent.change(await screen.findByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Sans Camion Transports' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create transport company' }))
  await screen.findByRole('heading', { name: 'Sans Camion Transports' })
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

  const directory = await screen.findByRole('list', { name: 'Available transport companies' })
  fireEvent.click(within(directory).getByText('Sans Camion Transports'))

  expect(await screen.findByText('No available trucks')).toBeInTheDocument()
})
