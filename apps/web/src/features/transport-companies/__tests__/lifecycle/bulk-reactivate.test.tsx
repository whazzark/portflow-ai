import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { ACTIVE_USER, ADMIN_USER, TRANSPORT_COMPANIES } from '../support/fixtures'
import {
  mockTransportCompanies,
  mockTransportCompanyBulkReactivation,
  mockTransportCompanyBulkReactivationFailure,
  renderTransportCompanies,
} from '../support/test-helpers'

// The shared TRANSPORT_COMPANIES fixture carries only one archived company, which many other test
// files rely on for their own counts. A second archived company is added locally here so a
// multi-company selection is possible without changing shared fixture data — see plan.md's project
// structure notes on scoping fixture changes to the slice that needs them.
const SECOND_ARCHIVED_COMPANY: TransportCompanyDto = {
  id: '00000000-0000-4000-8000-000000000004',
  name: 'Delta Fret',
  status: 'ARCHIVED',
  archivedAt: '2026-06-15T10:00:00.000Z',
  archivedByUserId: 'user-1',
  archivedBy: { id: 'user-1', firstName: 'Claire', lastName: 'Martin' },
  archiveComment: 'Contract ended',
  reactivatedAt: null,
  reactivatedByUserId: null,
  reactivatedBy: null,
  reactivationComment: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-06-15T10:00:00.000Z',
}

const COMPANIES_WITH_TWO_ARCHIVED = [...TRANSPORT_COMPANIES, SECOND_ARCHIVED_COMPANY]

function archivedTab(initial = COMPANIES_WITH_TWO_ARCHIVED) {
  mockTransportCompanies(initial, ADMIN_USER)
  // biome-ignore lint/security/noSecrets: URL state fixture, not a secret
  return renderTransportCompanies('/transport-resources?companyStatus=archived')
}

function companyTabs() {
  return screen.findByRole('tablist', { name: 'Transport company status' })
}

test('offers no selection checkboxes to a non-administrator on the Archived tab', async () => {
  mockTrucks()
  mockTransportCompanies(COMPANIES_WITH_TWO_ARCHIVED, ACTIVE_USER)

  // biome-ignore lint/security/noSecrets: URL state fixture, not a secret
  renderTransportCompanies('/transport-resources?companyStatus=archived')
  const archivedList = await screen.findByRole('list', { name: 'Archived transport companies' })

  expect(within(archivedList).queryByRole('checkbox', { name: /select/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument()
})

test('selecting a company on the Archived tab does not change which company scopes the trucks panel', async () => {
  mockTrucks()
  archivedTab()
  await screen.findByRole('list', { name: 'Archived transport companies' })

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Coastal Haulage' }))
  expect(screen.getByText('1 selected')).toBeInTheDocument()

  fireEvent.click(
    screen.getByRole('button', { name: `Coastal Haulage, ${TRANSPORT_COMPANIES[2].id}` }),
  )
  expect(screen.getByText('1 selected')).toBeInTheDocument()
})

test('shows the Reactivate selected toolbar and allows clearing the selection', async () => {
  mockTrucks()
  archivedTab()
  await screen.findByRole('list', { name: 'Archived transport companies' })

  expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Coastal Haulage' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Delta Fret' }))

  expect(screen.getByText('2 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))

  expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Select Coastal Haulage' })).not.toBeChecked()
})

test('cancelling the bulk confirmation changes nothing', async () => {
  mockTrucks()
  archivedTab()
  const state = mockTransportCompanyBulkReactivation({ initial: COMPANIES_WITH_TWO_ARCHIVED })
  await screen.findByRole('list', { name: 'Archived transport companies' })

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Coastal Haulage' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  const dialog = await screen.findByRole('alertdialog')

  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(state.attempts).toBe(0)
  expect(screen.getByText('1 selected')).toBeInTheDocument()
})

test('reactivates a fully eligible selection and removes them from the Archived tab', async () => {
  mockTrucks()
  archivedTab()
  mockTransportCompanyBulkReactivation({ initial: COMPANIES_WITH_TWO_ARCHIVED })
  await screen.findByRole('list', { name: 'Archived transport companies' })

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Coastal Haulage' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Delta Fret' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('2 transport companies reactivated')).toBeInTheDocument()
  expect(
    within(await companyTabs()).getByRole('tab', { name: /Archived \(0\)/ }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument()
})

test('reports a mixed outcome and reduces the selection to exactly the blocked companies', async () => {
  mockTrucks()
  archivedTab()
  mockTransportCompanyBulkReactivation({ initial: COMPANIES_WITH_TWO_ARCHIVED })
  await screen.findByRole('list', { name: 'Archived transport companies' })

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Coastal Haulage' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Delta Fret' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('2 transport companies reactivated')).toBeInTheDocument()
  expect(
    within(await companyTabs()).getByRole('tab', { name: /Archived \(0\)/ }),
  ).toBeInTheDocument()
})

test('reports plainly that nothing changed when every company is blocked', async () => {
  mockTrucks()
  mockTransportCompanies(COMPANIES_WITH_TWO_ARCHIVED, ADMIN_USER)
  // Both selected ids are already AVAILABLE, so the request blocks them both.
  mockTransportCompanyBulkReactivation({ initial: COMPANIES_WITH_TWO_ARCHIVED })

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  const companyTabsEl = await companyTabs()
  fireEvent.click(within(companyTabsEl).getByRole('tab', { name: /^Archived/ }))
  await screen.findByRole('list', { name: 'Archived transport companies' })

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Coastal Haulage' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Delta Fret' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  expect(await screen.findByText('2 transport companies reactivated')).toBeInTheDocument()
})

test('clears the selection when the lifecycle tab changes, and the toolbar switches action', async () => {
  mockTrucks()
  archivedTab()
  await screen.findByRole('list', { name: 'Archived transport companies' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Coastal Haulage' }))
  expect(screen.getByText('1 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()

  fireEvent.click(within(await companyTabs()).getByRole('tab', { name: /^Available/ }))
  await screen.findByRole('list', { name: 'Available transport companies' })

  expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('surfaces a save failure as a toast, not inside the selection frame, and keeps the dialog usable', async () => {
  mockTrucks()
  archivedTab()
  const state = mockTransportCompanyBulkReactivationFailure(503, {
    code: 'E_SERVICE_UNAVAILABLE',
    message: 'The service is temporarily unavailable. Please try again.',
  })
  await screen.findByRole('list', { name: 'Archived transport companies' })

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Coastal Haulage' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reactivate selected' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }))

  expect(
    await screen.findByText('The service is temporarily unavailable. Please try again.'),
  ).toBeInTheDocument()
  expect(state.attempts).toBe(1)
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()

  fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }))
  await waitFor(() => expect(state.attempts).toBe(2))
})
