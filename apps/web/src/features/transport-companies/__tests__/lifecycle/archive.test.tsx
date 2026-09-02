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

  expect(await screen.findByRole('button', { name: 'Archive' })).toBeInTheDocument()
})

test('explains the outcome and offers an optional comment before archiving', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyArchival(TRANSPORT_COMPANIES)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openDetailsFor('Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))

  expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  expect(
    screen.getByText(/remains readable but is no longer available for new operations/i),
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
  fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))
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
    within(await companyTabs()).getByRole('tab', { name: /Available \(3\)/, hidden: true }),
  ).toBeInTheDocument()

  await openDetailsFor('Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))
  await screen.findByRole('alertdialog')
  fireEvent.change(screen.getByRole('textbox', { name: /comment/i }), {
    target: { value: 'Provider no longer serves the site' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText('Transport company “Atlantic Transport” archived'),
  ).toBeInTheDocument()
  const tabs = await companyTabs()
  expect(
    await within(tabs).findByRole('tab', {
      name: /Archived \(2\)/,
      selected: true,
      hidden: true,
    }),
  ).toBeInTheDocument()
  expect(
    within(tabs).getByRole('tab', { name: /Available \(2\)/, hidden: true }),
  ).toBeInTheDocument()

  await screen.findByRole('heading', { name: 'Atlantic Transport' })
  const panel = screen.getByRole('dialog', { hidden: true })
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
  fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))
  await screen.findByRole('alertdialog')
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText('Transport company still provides available trucks'),
  ).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(
    within(await companyTabs()).getByRole('tab', { name: /Available \(3\)/, hidden: true }),
  ).toBeInTheDocument()
})

test('a validation refusal shows its field-level detail and keeps the typed comment', async () => {
  mockTrucks()
  mockTransportCompanyArchivalFailure(422, {
    code: 'E_VALIDATION_ERROR',
    message: 'Validation failure',
    details: [{ field: 'comment', message: 'The comment field must not exceed 1000 characters' }],
  })
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openDetailsFor('Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Archive' }))
  const dialog = await screen.findByRole('alertdialog')
  const comment = within(dialog).getByRole('textbox', { name: /comment/i })
  // maxLength=1000 on the field blocks typing past the limit, so an over-long value that reaches
  // the server has to be set programmatically here.
  fireEvent.change(comment, { target: { value: 'a'.repeat(1001) } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  // The field-level detail, not the generic "Validation failure", is what says what to fix.
  expect(
    await screen.findByText('The comment field must not exceed 1000 characters'),
  ).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(comment).toHaveValue('a'.repeat(1001))
})
