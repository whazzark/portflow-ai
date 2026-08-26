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

test('pre-fills the edit form with the current name, phone number, and email address', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openEditFor('Atlantic Transport')

  expect(await screen.findByRole('heading', { name: 'Edit transport company' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Company name' })).toHaveValue('Atlantic Transport')
  expect(screen.getByRole('textbox', { name: 'Contact phone' })).toHaveValue('+33 2 40 12 34 56')
  expect(screen.getByRole('textbox', { name: 'Contact email' })).toHaveValue(
    'dispatch@atlantic-transport.test',
  )
})

test('shows empty, required contact fields for a company registered before this feature', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openEditFor('Nordic Haulers')

  expect(await screen.findByRole('heading', { name: 'Edit transport company' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Contact phone' })).toHaveValue('')
  expect(screen.getByRole('textbox', { name: 'Contact email' })).toHaveValue('')
  expect(screen.getByRole('textbox', { name: 'Contact phone' })).toBeRequired()
  expect(screen.getByRole('textbox', { name: 'Contact email' })).toBeRequired()
})

test('lets an administrator record contact details and see them reflected in the directory', async () => {
  const updated = {
    ...TRANSPORT_COMPANIES[3],
    contactPhone: '+33 1 98 76 54 32',
    contactEmail: 'dispatch@nordic-haulers.test',
  }
  let currentCompanies = TRANSPORT_COMPANIES

  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  server.use(
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: currentCompanies }),
    ),
    http.patch(`${API_BASE_URL}/api/v1/transport-companies/${TRANSPORT_COMPANIES[3].id}`, () => {
      currentCompanies = currentCompanies.map((company) =>
        company.id === updated.id ? updated : company,
      )
      return HttpResponse.json({ data: updated })
    }),
  )

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openEditFor('Nordic Haulers')

  fireEvent.change(await screen.findByRole('textbox', { name: 'Contact phone' }), {
    target: { value: '+33 1 98 76 54 32' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Contact email' }), {
    target: { value: 'dispatch@nordic-haulers.test' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('heading', { name: 'Nordic Haulers' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit transport company' })).not.toBeInTheDocument()

  // Reopen the edit form (from the still-open details panel, not the list — the sheet makes the
  // background list inert) to prove the recorded values round-trip through the API, rather than
  // asserting on the read-only details display, which is built by a later story.
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  expect(await screen.findByRole('textbox', { name: 'Contact phone' })).toHaveValue(
    '+33 1 98 76 54 32',
  )
  expect(screen.getByRole('textbox', { name: 'Contact email' })).toHaveValue(
    'dispatch@nordic-haulers.test',
  )
})

test('attaches a 422 carrying two field errors to the phone and email inputs', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/transport-companies/${TRANSPORT_COMPANIES[0].id}`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_VALIDATION_ERROR',
            details: [
              {
                field: 'contactPhone',
                message: 'The contactPhone field must be a valid phone number',
              },
              {
                field: 'contactEmail',
                message: 'The contactEmail field must be a valid email address',
              },
            ],
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
  fireEvent.change(await screen.findByRole('textbox', { name: 'Contact phone' }), {
    target: { value: 'not a phone' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(
    await screen.findByText('The contactPhone field must be a valid phone number'),
  ).toBeInTheDocument()
  expect(
    screen.getByText('The contactEmail field must be a valid email address'),
  ).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Edit transport company' })).toBeInTheDocument()
})

test('shows a toast for a non-field refusal and lets the administrator correct and resubmit', async () => {
  const updated = { ...TRANSPORT_COMPANIES[0], contactEmail: 'corrected@atlantic-transport.test' }
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
              code: 'E_TRANSPORT_COMPANY_NAME_CONFLICT',
              message: 'Transport company name is already in use',
            },
          },
          { status: 409 },
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
  expect(await screen.findByRole('heading', { name: 'Edit transport company' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Unable to update transport company')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Edit transport company' })).toBeInTheDocument()

  fireEvent.change(screen.getByRole('textbox', { name: 'Contact email' }), {
    target: { value: 'corrected@atlantic-transport.test' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('heading', { name: 'Atlantic Transport' })).toBeInTheDocument()
  expect(attempt).toBe(2)
})

test('cancelling an edit leaves the company unchanged', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openEditFor('Atlantic Transport')
  fireEvent.change(await screen.findByRole('textbox', { name: 'Contact phone' }), {
    target: { value: '+33 9 99 99 99 99' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Back to details' }))

  expect(await screen.findByRole('heading', { name: 'Atlantic Transport' })).toBeInTheDocument()
  expect(screen.getByText('+33 2 40 12 34 56')).toBeInTheDocument()
})
