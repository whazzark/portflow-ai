import { fireEvent, screen, within } from '@testing-library/react'
import { assert, expect, test } from 'vitest'
import { mockCustomers, renderCustomers } from '../support/test-helpers'

test('clears the bulk selection from the floating action bar', async () => {
  mockCustomers()

  renderCustomers()
  const table = await screen.findByRole('table', { name: 'Available customers' })
  fireEvent.click(within(table).getByRole('checkbox', { name: 'Select customer ACME-01' }))

  expect(screen.getByRole('toolbar')).toBeInTheDocument()
  expect(within(table).getByRole('row', { name: /ACME-01/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  expect(within(table).getByRole('checkbox', { name: 'Select customer ACME-01' })).not.toBeChecked()
  expect(within(table).getByRole('row', { name: /ACME-01/ })).toHaveAttribute(
    'aria-selected',
    'false',
  )
})

test('does not open the customer panel when selecting a customer', async () => {
  mockCustomers()

  renderCustomers()
  const table = await screen.findByRole('table', { name: 'Available customers' })

  fireEvent.click(within(table).getByRole('checkbox', { name: 'Select customer ACME-01' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('does not open the customer panel when clicking the checkbox indicator', async () => {
  mockCustomers()

  renderCustomers()
  const table = await screen.findByRole('table', { name: 'Available customers' })
  const checkbox = within(table).getByRole('checkbox', { name: 'Select customer ACME-01' })
  fireEvent.click(checkbox)
  const indicator = within(table)
    .getByRole('checkbox', { name: 'Select customer ACME-01' })
    .querySelector('[data-slot="checkbox-indicator"]')

  assert(indicator)
  fireEvent.click(indicator)

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('keeps selection controls and the selected-row indicator inside the selection column', async () => {
  mockCustomers()

  renderCustomers()
  const table = await screen.findByRole('table', { name: 'Available customers' })
  const checkboxes = within(table).getAllByRole('checkbox')

  for (const checkbox of checkboxes) {
    expect(checkbox.parentElement).toHaveClass('flex', 'h-full', 'items-center', 'justify-center')
  }

  expect(within(table).getAllByRole('columnheader')[0]).toHaveClass('w-10', 'p-0')
  const firstRow = within(table).getAllByRole('row')[1]
  const selectionCell = within(firstRow).getAllByRole('cell')[0]

  expect(selectionCell).toHaveClass('w-10', 'p-0')
  fireEvent.click(within(firstRow).getByRole('checkbox', { name: 'Select customer ACME-01' }))
  expect(selectionCell.querySelector('[data-slot="customer-selection-indicator"]')).toBeVisible()
})

test('does not add empty scroll space when selecting all customers', async () => {
  mockCustomers()

  renderCustomers()
  const table = await screen.findByRole('table', { name: 'Available customers' })
  fireEvent.click(within(table).getByRole('checkbox', { name: 'Select all available customers' }))

  expect(table.parentElement?.parentElement).not.toHaveClass(
    '[&_[data-slot=table-container]]:pb-20',
  )
})
