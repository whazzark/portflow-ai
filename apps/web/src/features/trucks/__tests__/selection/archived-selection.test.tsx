import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import {
  ACTIVE_OPERATIONS_ADMIN,
  BULK_ARCHIVED_TRUCKS,
  BULK_AVAILABLE_TRUCKS,
  BULK_TRUCKS,
} from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

test('offers selection and a matching reactivate action in the archived tab', async () => {
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(screen.getByRole('tab', { name: /Archived/ }))
  const list = await screen.findByRole('list', { name: 'Archived trucks' })
  fireEvent.click(
    within(list).getByRole('checkbox', {
      name: `Select truck ${BULK_ARCHIVED_TRUCKS[0].registration}`,
    }),
  )

  expect(screen.getByText('1 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('drops the selection from the floating toolbar when leaving the archived tab', async () => {
  const user = userEvent.setup()
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  await user.click(screen.getByRole('tab', { name: /Archived/ }))
  const list = await screen.findByRole('list', { name: 'Archived trucks' })
  fireEvent.click(
    within(list).getByRole('checkbox', {
      name: `Select truck ${BULK_ARCHIVED_TRUCKS[0].registration}`,
    }),
  )
  expect(screen.getByText('1 selected')).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /Available/ }))

  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument(),
  )
  // The dropped selection must never resurface as an available-tab archive action either.
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('drops archived-tab selected trucks that fall outside a new transport-company filter', async () => {
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })

  const { router } = renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(screen.getByRole('tab', { name: /Archived/ }))
  const list = await screen.findByRole('list', { name: 'Archived trucks' })
  fireEvent.click(
    within(list).getByRole('checkbox', {
      name: `Select truck ${BULK_ARCHIVED_TRUCKS[0].registration}`,
    }),
  )
  fireEvent.click(
    within(list).getByRole('checkbox', {
      name: `Select truck ${BULK_ARCHIVED_TRUCKS[1].registration}`,
    }),
  )
  expect(screen.getByText('2 selected')).toBeInTheDocument()

  await router.navigate({
    to: router.state.location.pathname,
    search: (previous: Record<string, unknown>) => ({
      ...previous,
      // Only the first archived truck belongs to this company.
      transportCompanyId: BULK_ARCHIVED_TRUCKS[0].transportCompanyId,
    }),
  })

  await waitFor(() => expect(screen.getByText('1 selected')).toBeInTheDocument())
})

test('keeps an archived-tab selected truck selected while a search term hides it', async () => {
  const user = userEvent.setup()
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(screen.getByRole('tab', { name: /Archived/ }))
  const list = await screen.findByRole('list', { name: 'Archived trucks' })
  fireEvent.click(
    within(list).getByRole('checkbox', {
      name: `Select truck ${BULK_ARCHIVED_TRUCKS[0].registration}`,
    }),
  )
  expect(screen.getByText('1 selected')).toBeInTheDocument()

  await user.type(
    screen.getByRole('textbox', { name: 'Search trucks' }),
    BULK_ARCHIVED_TRUCKS[1].registration,
  )
  expect(
    within(screen.getByRole('list', { name: 'Archived trucks' })).queryByRole('button', {
      name: new RegExp(BULK_ARCHIVED_TRUCKS[0].registration),
    }),
  ).not.toBeInTheDocument()
  expect(screen.getByText('1 selected')).toBeInTheDocument()
})

test('the available-tab selection and archive flow are unaffected by archived-tab selection', async () => {
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    complete: BULK_TRUCKS,
    available: BULK_AVAILABLE_TRUCKS,
  })

  renderTrucks()
  const availableList = await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(
    within(availableList).getByRole('checkbox', {
      name: `Select truck ${BULK_AVAILABLE_TRUCKS[0].registration}`,
    }),
  )
  expect(screen.getByText('1 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
})
