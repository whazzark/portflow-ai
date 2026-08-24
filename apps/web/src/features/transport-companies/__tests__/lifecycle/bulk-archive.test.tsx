import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { ACTIVE_USER, ADMIN_USER, TRANSPORT_COMPANIES } from '../support/fixtures'
import {
  mockTransportCompanies,
  mockTransportCompanyBulkArchival,
  mockTransportCompanyBulkArchivalFailure,
  renderTransportCompanies,
} from '../support/test-helpers'

function companyTabs() {
  return screen.findByRole('tablist', { name: 'Transport company status' })
}

test('offers no selection checkboxes to a non-administrator', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ACTIVE_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })

  expect(screen.queryByRole('checkbox', { name: /select/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('offers no selection checkboxes on the Archived tab', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  fireEvent.click(within(await companyTabs()).getByRole('tab', { name: /^Archived/ }))
  await screen.findByRole('list', { name: 'Archived transport companies' })

  expect(screen.queryByRole('checkbox', { name: /select/i })).not.toBeInTheDocument()
})

test('selecting a company does not change which company scopes the trucks panel', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Atlantic Transport' }))
  expect(screen.getByText('1 selected')).toBeInTheDocument()

  fireEvent.click(
    screen.getByRole('button', { name: `Atlantic Transport, ${TRANSPORT_COMPANIES[0].id}` }),
  )
  expect(screen.getByText('1 selected')).toBeInTheDocument()
})

test('shows the selection toolbar and allows clearing the selection', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Atlantic Transport' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Bêta Logistique' }))

  expect(screen.getByText('2 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Select Atlantic Transport' })).not.toBeChecked()
})

test('selects and deselects every visible company with the select-all checkbox', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })

  const selectAll = screen.getByRole('checkbox', { name: 'Select all visible transport companies' })
  expect(selectAll).not.toBeChecked()

  fireEvent.click(selectAll)

  expect(screen.getByText('2 selected')).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Select Atlantic Transport' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Select Bêta Logistique' })).toBeChecked()
  expect(
    screen.getByRole('checkbox', { name: 'Select all visible transport companies' }),
  ).toBeChecked()

  fireEvent.click(selectAll)

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Select Atlantic Transport' })).not.toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Select Bêta Logistique' })).not.toBeChecked()
})

test('select-all only affects companies currently matching the search', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })

  fireEvent.change(screen.getByRole('textbox', { name: 'Search transport companies' }), {
    target: { value: 'Atlantic' },
  })
  await screen.findByRole('checkbox', { name: 'Select Atlantic Transport' })
  expect(screen.queryByRole('checkbox', { name: 'Select Bêta Logistique' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all visible transport companies' }))

  expect(screen.getByText('1 selected')).toBeInTheDocument()

  fireEvent.change(screen.getByRole('textbox', { name: 'Search transport companies' }), {
    target: { value: '' },
  })
  await screen.findByRole('checkbox', { name: 'Select Bêta Logistique' })

  // The company hidden by the search filter never entered the selection.
  expect(screen.getByText('1 selected')).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Select Atlantic Transport' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Select Bêta Logistique' })).not.toBeChecked()
})

test('cancelling the bulk confirmation changes nothing', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  const state = mockTransportCompanyBulkArchival({ initial: TRANSPORT_COMPANIES })

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Atlantic Transport' }))
  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  const dialog = await screen.findByRole('alertdialog')

  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(state.attempts).toBe(0)
  expect(screen.getByText('1 selected')).toBeInTheDocument()
})

test('archives a fully eligible selection and removes them from the Available tab', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyBulkArchival({ initial: TRANSPORT_COMPANIES })

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Atlantic Transport' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Bêta Logistique' }))
  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('2 transport companies archived')).toBeInTheDocument()
  expect(
    within(await companyTabs()).getByRole('tab', { name: /Available \(0\)/ }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('reports a mixed outcome and reduces the selection to exactly the blocked companies', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyBulkArchival({
    initial: TRANSPORT_COMPANIES,
    blockedIds: [TRANSPORT_COMPANIES[1].id],
  })

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Atlantic Transport' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Bêta Logistique' }))
  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('1 transport company archived; 1 unchanged')).toBeInTheDocument()
  // The refusal detail is a toast only, never an inline frame beside the selection.
  const toaster = document.querySelector('[data-sonner-toaster]') as HTMLElement
  expect(
    within(toaster).getByText(/Bêta Logistique: still provides available trucks/),
  ).toBeInTheDocument()
  expect(screen.getByText('1 selected')).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Select Bêta Logistique' })).toBeChecked()
  // Atlantic Transport was successfully archived and left the Available tab entirely.
  expect(
    screen.queryByRole('checkbox', { name: 'Select Atlantic Transport' }),
  ).not.toBeInTheDocument()
})

test('reports plainly that nothing changed when every company is blocked', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyBulkArchival({
    initial: TRANSPORT_COMPANIES,
    blockedIds: [TRANSPORT_COMPANIES[0].id, TRANSPORT_COMPANIES[1].id],
  })

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Atlantic Transport' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Bêta Logistique' }))
  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('0 transport companies archived; 2 unchanged')).toBeInTheDocument()
  expect(
    within(await companyTabs()).getByRole('tab', { name: /Available \(2\)/ }),
  ).toBeInTheDocument()
})

test('clears the selection when the lifecycle tab changes', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Atlantic Transport' }))
  expect(screen.getByText('1 selected')).toBeInTheDocument()

  fireEvent.click(within(await companyTabs()).getByRole('tab', { name: /^Archived/ }))
  await screen.findByRole('list', { name: 'Archived transport companies' })
  fireEvent.click(within(await companyTabs()).getByRole('tab', { name: /^Available/ }))
  await screen.findByRole('list', { name: 'Available transport companies' })

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('surfaces a save failure as a toast, not inside the selection frame, and keeps the dialog usable', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  const state = mockTransportCompanyBulkArchivalFailure(503, {
    code: 'E_SERVICE_UNAVAILABLE',
    message: 'The service is temporarily unavailable. Please try again.',
  })

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Atlantic Transport' }))
  fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText('The service is temporarily unavailable. Please try again.'),
  ).toBeInTheDocument()
  expect(state.attempts).toBe(1)
  // The dialog stays open and shows no inline error box; the failure is a toast only.
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Archive' })).toBeInTheDocument()

  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }))
  await waitFor(() => expect(state.attempts).toBe(2))
})
