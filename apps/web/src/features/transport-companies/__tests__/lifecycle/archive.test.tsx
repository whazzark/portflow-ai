import { fireEvent, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { ADMIN_USER, TRANSPORT_COMPANIES } from '../support/fixtures'
import {
  mockTransportCompanies,
  mockTransportCompanyArchival,
  mockTransportCompanyArchivalFailure,
  renderTransportCompanies,
} from '../support/test-helpers'

async function openDetailsFor(companyName: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${companyName}` }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'View' }))
}

// The details panel is a modal Sheet: while it stays open (by design, so the archived context
// stays visible after a successful archival), the background tab list is correctly marked inert
// for real assistive technology. `hidden: true` opts back into querying it here because these
// assertions check business state, not the sighted/AT-visible surface at that exact moment.
function companyTabs() {
  return screen.findByRole('tablist', { name: 'Transport company status', hidden: true })
}

test('offers archival only to an administrator viewing an available company', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openDetailsFor('Atlantic Transport')

  expect(await screen.findByRole('button', { name: 'Archive company' })).toBeInTheDocument()
})

test('explains the outcome and offers an optional comment before archiving', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyArchival(TRANSPORT_COMPANIES)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openDetailsFor('Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Archive company' }))

  expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  expect(
    screen.getByText(/will remain readable but will no longer be selectable/i),
  ).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument()
})

test('cancelling the confirmation sends no request and leaves the company unchanged', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  const state = mockTransportCompanyArchival(TRANSPORT_COMPANIES)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openDetailsFor('Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Archive company' }))
  await screen.findByRole('alertdialog')

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(state.attempts).toBe(0)
  expect(await screen.findByRole('heading', { name: 'Atlantic Transport' })).toBeInTheDocument()
})

test('archiving moves the company to the Archived tab with its lifecycle context', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyArchival(TRANSPORT_COMPANIES)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  expect(
    within(await companyTabs()).getByRole('tab', { name: /Available \(2\)/, hidden: true }),
  ).toBeInTheDocument()

  await openDetailsFor('Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Archive company' }))
  await screen.findByRole('alertdialog')
  fireEvent.change(screen.getByRole('textbox', { name: /comment/i }), {
    target: { value: 'Provider no longer serves the site' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('Transport company archived')).toBeInTheDocument()
  const tabs = await companyTabs()
  expect(
    await within(tabs).findByRole('tab', {
      name: /Archived \(2\)/,
      selected: true,
      hidden: true,
    }),
  ).toBeInTheDocument()
  expect(
    within(tabs).getByRole('tab', { name: /Available \(1\)/, hidden: true }),
  ).toBeInTheDocument()

  const details = await screen.findByRole('heading', { name: 'Atlantic Transport' })
  const panel = details.closest('section') as HTMLElement
  expect(within(panel).getByText('Archive context')).toBeInTheDocument()
  expect(within(panel).getByText('Claire Martin')).toBeInTheDocument()
  expect(within(panel).getByText('Provider no longer serves the site')).toBeInTheDocument()
})

test('a truck-conflict refusal is shown in the dialog and the company stays available', async () => {
  mockTrucks()
  mockTransportCompanyArchivalFailure(409, {
    code: 'E_TRANSPORT_COMPANY_HAS_AVAILABLE_TRUCKS',
    message: 'Transport company still provides available trucks',
  })
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openDetailsFor('Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Archive company' }))
  await screen.findByRole('alertdialog')
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText('Transport company still provides available trucks'),
  ).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(
    within(await companyTabs()).getByRole('tab', { name: /Available \(2\)/, hidden: true }),
  ).toBeInTheDocument()
})
