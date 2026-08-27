import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { ACTIVE_USER, ADMIN_USER, TRANSPORT_COMPANIES } from '../support/fixtures'
import {
  mockTransportCompanies,
  mockTransportCompanyArchival,
  renderTransportCompanies,
} from '../support/test-helpers'

const AVAILABLE = TRANSPORT_COMPANIES.find(
  (company) => company.status === 'AVAILABLE',
) as TransportCompanyDto
const ARCHIVED = TRANSPORT_COMPANIES.find(
  (company) => company.status === 'ARCHIVED',
) as TransportCompanyDto

// The menu is portaled out of the list, so its items are queried from `screen`.
async function openRowMenu(name: string, list = 'Available transport companies') {
  await screen.findByRole('list', { name: list })
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
  await screen.findByRole('menu')
}

test('offers view, edit, and the lifecycle action from an available row', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  renderTransportCompanies()

  await openRowMenu(AVAILABLE.name)

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Archive' })).toBeInTheDocument()
})

test('offers reactivation, and no edit, from an archived row', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderTransportCompanies('/transport-resources?companyStatus=archived')

  await openRowMenu(ARCHIVED.name, 'Archived transport companies')

  expect(screen.getByRole('menuitem', { name: 'Reactivate' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Archive' })).not.toBeInTheDocument()
})

test('leaves a non-administrator with consultation only', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ACTIVE_USER)
  renderTransportCompanies()

  await openRowMenu(AVAILABLE.name)

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Archive' })).not.toBeInTheDocument()
})

test('archives a company from its row without opening the detail pane', async () => {
  mockTrucks()
  const state = mockTransportCompanyArchival(TRANSPORT_COMPANIES)
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  renderTransportCompanies()

  await openRowMenu(AVAILABLE.name)
  fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' }))

  // The confirmation is the one the detail pane uses, down to its comment field.
  const dialog = await screen.findByRole('alertdialog')
  expect(
    within(dialog).getByRole('heading', { name: 'Archive transport company?' }),
  ).toBeInTheDocument()
  fireEvent.change(within(dialog).getByRole('textbox', { name: /comment/i }), {
    target: { value: 'Contract ended' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  await waitFor(() => expect(state.attempts).toBe(1))
  expect(
    await screen.findByText(`Transport company “${AVAILABLE.name}” archived`),
  ).toBeInTheDocument()
})
