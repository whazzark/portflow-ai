import { fireEvent, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ACTIVE_OPERATIONS_LEAD } from '../support/fixtures'
import {
  allowFormJourneyTime,
  change,
  continueTo,
  fillLotsStep,
  fillProduct,
  fillValidPreparation,
  fillVesselStep,
  goToStep,
  mockCreateDischarge,
  mockDischarges,
  mockPreparationOptions,
  openCreationFromList,
  productRow,
} from '../support/test-helpers'

allowFormJourneyTime()

function arrange() {
  const sent: unknown[] = []
  mockDischarges({ user: ACTIVE_OPERATIONS_LEAD })
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD })
  mockCreateDischarge({ onRequest: (body) => sent.push(body) })

  return { sent }
}

function pressPrimary(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
}

test('offers the next step only once the current one is valid, and sends nothing before', async () => {
  const { sent } = arrange()
  await openCreationFromList()
  const nextToLots = screen.getByRole('button', { name: 'Next: Product lots' })

  expect(nextToLots).toBeDisabled()
  change(screen.getByRole('textbox', { name: 'Vessel name' }), 'MV Created Dawn')
  change(screen.getByRole('textbox', { name: 'Vessel name' }), '')
  expect(await screen.findByText('Vessel name is required.')).toBeInTheDocument()
  expect(nextToLots).toBeDisabled()

  await fillVesselStep()
  await continueTo('Product lots')

  // A fresh lot row shows no error, but the step cannot be left until it is filled.
  expect(screen.queryByText('Customer is required.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next: Planned shifts' })).toBeDisabled()

  await fillLotsStep()
  await continueTo('Planned shifts')
  pressPrimary('Create discharge')

  const shift = screen.getByRole('group', { name: 'Shift 1' })
  expect(await within(shift).findByText('Planned start is required.')).toBeInTheDocument()
  expect(within(shift).getByText('Planned end is required.')).toBeInTheDocument()
  expect(within(shift).getByText('Responsible is required.')).toBeInTheDocument()
  expect(sent).toHaveLength(0)
})

test('explains an invalid IMO on its step, keeping the entered values', async () => {
  arrange()
  await openCreationFromList()
  await fillVesselStep()
  change(screen.getByRole('textbox', { name: 'IMO number' }), '123')

  expect(await screen.findByText('Enter the 7-digit IMO number')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next: Product lots' })).toBeDisabled()
  expect(screen.getByRole('heading', { level: 2, name: 'Vessel and dock' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Vessel name' })).toHaveValue('MV Created Dawn')
})

test('explains an invalid quantity, keeping the entered values', async () => {
  const { sent } = arrange()
  await openCreationFromList()
  await fillValidPreparation()
  await goToStep('Product lots')
  const lot = screen.getByRole('group', { name: 'Customer 1' })

  const nextToShifts = screen.getByRole('button', { name: 'Next: Planned shifts' })

  for (const quantity of ['0', '1.2345']) {
    change(within(lot).getByRole('textbox', { name: 'Expected quantity (t)' }), quantity)

    expect(
      await within(lot).findByText('Enter a quantity above 0 with at most 3 decimals'),
    ).toBeInTheDocument()
    expect(within(lot).getByRole('textbox', { name: 'Expected quantity (t)' })).toHaveValue(
      quantity,
    )
    expect(nextToShifts).toBeDisabled()
  }

  expect(sent).toHaveLength(0)
})

test('keeps the lots step closed while a customer has a product twice', async () => {
  const { sent } = arrange()
  await openCreationFromList()
  await fillVesselStep()
  await continueTo('Product lots')
  await fillLotsStep()
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Customer 1' })).getByRole('button', {
      name: 'Add product',
    }),
  )
  fillProduct(productRow(1, 2), ' BLÉ TENDRE ', '10')

  const duplicate = 'This customer already has a lot with this product name'

  expect(await within(productRow(1, 1)).findByText(duplicate)).toBeInTheDocument()
  expect(within(productRow(1, 2)).getByText(duplicate)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next: Planned shifts' })).toBeDisabled()
  expect(sent).toHaveLength(0)
})

test('flags overlapping shifts and a shift ending before it starts', async () => {
  const { sent } = arrange()
  await openCreationFromList()
  await fillValidPreparation()
  const firstShift = screen.getByRole('group', { name: 'Shift 1' })
  const secondShift = screen.getByRole('group', { name: 'Shift 2' })

  change(within(secondShift).getByLabelText(/^Planned end/), '2026-10-01T15:00')
  pressPrimary('Create discharge')

  const overlap = 'This shift overlaps another shift'
  expect(await within(firstShift).findByText(overlap)).toBeInTheDocument()
  expect(within(secondShift).getByText(overlap)).toBeInTheDocument()

  change(within(secondShift).getByLabelText(/^Planned end/), '2026-10-01T05:00')
  pressPrimary('Create discharge')

  expect(
    await within(secondShift).findByText('The planned end must be after the planned start'),
  ).toBeInTheDocument()
  expect(sent).toHaveLength(0)
})
