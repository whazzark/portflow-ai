import { fireEvent, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { ADMIN_USER, TRANSPORT_COMPANIES } from '../support/fixtures'
import {
  mockTransportCompanies,
  mockTransportCompanyReactivation,
  mockTransportCompanyReactivationFailure,
  renderTransportCompanies,
} from '../support/test-helpers'

async function openDetailsFor(companyName: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${companyName}` }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'View' }))
}

// The details panel is a modal Sheet: while it stays open (by design, so the reactivation context
// stays visible after a successful reactivation), the background tab list is correctly marked
// inert for real assistive technology. `hidden: true` opts back into querying it here because
// these assertions check business state, not the sighted/AT-visible surface at that exact moment.
function companyTabs() {
  return screen.findByRole('tablist', { name: 'Transport company status', hidden: true })
}

function archivedTab() {
  // biome-ignore lint/security/noSecrets: URL state fixture, not a secret
  return renderTransportCompanies('/transport-resources?companyStatus=archived')
}

test('offers reactivation only to an administrator viewing an archived company, and no Edit affordance', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  archivedTab()
  await screen.findByRole('list', { name: 'Archived transport companies' })
  await openDetailsFor('Coastal Haulage')

  expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

test('explains the outcome and offers an optional comment before reactivating', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyReactivation(TRANSPORT_COMPANIES)

  archivedTab()
  await screen.findByRole('list', { name: 'Archived transport companies' })
  await openDetailsFor('Coastal Haulage')
  fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  expect(screen.getByText(/becomes available again for new operations/i)).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument()
})

test('cancelling the confirmation sends no request and leaves the company unchanged', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  const state = mockTransportCompanyReactivation(TRANSPORT_COMPANIES)

  archivedTab()
  await screen.findByRole('list', { name: 'Archived transport companies' })
  await openDetailsFor('Coastal Haulage')
  fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }))
  await screen.findByRole('alertdialog')

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(state.attempts).toBe(0)
  expect(await screen.findByRole('heading', { name: 'Coastal Haulage' })).toBeInTheDocument()
})

test('reactivating moves the company to the Available tab with its lifecycle context', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyReactivation(TRANSPORT_COMPANIES)

  archivedTab()
  await screen.findByRole('list', { name: 'Archived transport companies' })
  expect(
    within(await companyTabs()).getByRole('tab', { name: /Archived \(1\)/, hidden: true }),
  ).toBeInTheDocument()

  await openDetailsFor('Coastal Haulage')
  fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }))
  await screen.findByRole('alertdialog')
  fireEvent.change(screen.getByRole('textbox', { name: /comment/i }), {
    target: { value: 'Framework contract renewed for the season' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Transport company reactivated')).toBeInTheDocument()
  const tabs = await companyTabs()
  expect(
    await within(tabs).findByRole('tab', {
      name: /Available \(4\)/,
      selected: true,
      hidden: true,
    }),
  ).toBeInTheDocument()
  expect(
    within(tabs).getByRole('tab', { name: /Archived \(0\)/, hidden: true }),
  ).toBeInTheDocument()

  const details = await screen.findByRole('heading', { name: 'Coastal Haulage' })
  const panel = details.closest('section') as HTMLElement
  // A reactivated company reports both transitions, newest first: the reactivation, and the
  // archival it reversed — which stays readable as history.
  const reactivation = within(panel).getByRole('region', { name: 'Reactivation context' })
  expect(within(reactivation).getByText('Claire Martin')).toBeInTheDocument()
  expect(
    within(reactivation).getByText('Framework contract renewed for the season'),
  ).toBeInTheDocument()
  expect(within(panel).getByRole('region', { name: 'Archive context' })).toBeInTheDocument()
})

test('an already-available refusal is shown in the dialog and the company stays archived', async () => {
  mockTrucks()
  mockTransportCompanyReactivationFailure(409, {
    code: 'E_TRANSPORT_COMPANY_ALREADY_AVAILABLE',
    message: 'Transport company is already available',
  })
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  archivedTab()
  await screen.findByRole('list', { name: 'Archived transport companies' })
  await openDetailsFor('Coastal Haulage')
  fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }))
  await screen.findByRole('alertdialog')
  fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('Transport company is already available')).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(
    within(await companyTabs()).getByRole('tab', { name: /Archived \(1\)/, hidden: true }),
  ).toBeInTheDocument()
})
