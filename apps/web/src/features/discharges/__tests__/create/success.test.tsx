import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'
import { formatTonnes } from '@/features/discharges/discharge-detail-view'
import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import { ACTIVE_OPERATIONS_LEAD, AVAILABLE_DOCKS, ELIGIBLE_RESPONSIBLES } from '../support/fixtures'
import {
  allowFormJourneyTime,
  continueTo,
  detailFromCreation,
  fillLotsStep,
  fillValidPreparation,
  fillVesselStep,
  mockCreateDischarge,
  mockDischarges,
  mockPreparationOptions,
  openCreationFromList,
} from '../support/test-helpers'

allowFormJourneyTime()

const OFFSET_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000[+-]\d{2}:\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

test('creates a planned discharge and opens its detail', async () => {
  const sent: Parameters<typeof detailFromCreation>[0][] = []
  mockDischarges({ user: ACTIVE_OPERATIONS_LEAD })
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD })
  mockCreateDischarge({ delayMs: 50, onRequest: (body) => sent.push(body) })

  const { queryClient, router } = await openCreationFromList()
  await fillValidPreparation()

  expect(screen.getByText(formatTonnes('2000.500'))).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Create discharge' }))

  expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled()
  expect(
    await screen.findByRole('heading', { level: 1, name: 'MV Created Dawn' }),
  ).toBeInTheDocument()

  expect(sent).toHaveLength(1)
  const [body] = sent
  expect(body.id).toMatch(UUID)
  expect(body.vesselImo).toBeNull()
  expect(body.vesselComment).toBeNull()
  expect(body.dockId).toBe(AVAILABLE_DOCKS[0].id)
  expect(body.expectedStartAt).toMatch(OFFSET_INSTANT)
  expect(body.productLots.map((lot) => lot.expectedQuantityTonnes)).toEqual(['1200.5', '800'])
  expect(body.productLots.map((lot) => lot.description)).toEqual([null, null])
  for (const shift of body.shifts) {
    expect(shift.plannedStartAt).toMatch(OFFSET_INSTANT)
    expect(shift.plannedEndAt).toMatch(OFFSET_INSTANT)
    expect(shift.responsibleUserId).toBe(ELIGIBLE_RESPONSIBLES[0].id)
  }

  expect(router.state.location.pathname).toBe(`/discharges/${body.id}`)
  expect(router.state.location.search).toMatchObject({ status: 'planned', search: 'dawn' })
  expect(await screen.findByText('Discharge “MV Created Dawn” created')).toBeInTheDocument()
  await waitFor(() =>
    expect(queryClient.getQueryState(dischargeQueries.all().queryKey)?.isInvalidated).toBe(true),
  )
})

test('treats a replayed creation answered with the existing discharge as a success', async () => {
  mockDischarges({ user: ACTIVE_OPERATIONS_LEAD })
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD })
  mockCreateDischarge({
    respond: (body) => ({ status: 200, body: { data: detailFromCreation(body) } }),
  })

  const { router } = await openCreationFromList()
  await fillValidPreparation()
  fireEvent.click(screen.getByRole('button', { name: 'Create discharge' }))

  expect(
    await screen.findByRole('heading', { level: 1, name: 'MV Created Dawn' }),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toMatch(/^\/discharges\/[0-9a-f-]{36}$/)
})

test('keeps at least one lot and one shift', async () => {
  mockDischarges({ user: ACTIVE_OPERATIONS_LEAD })
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD })

  await openCreationFromList()
  await fillVesselStep()
  await continueTo('Product lots')

  expect(screen.getByRole('button', { name: 'Remove product lot 1' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Add product lot' }))
  expect(await screen.findByRole('group', { name: 'Product lot 2' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Remove product lot 2' }))
  await waitFor(() =>
    expect(screen.queryByRole('group', { name: 'Product lot 2' })).not.toBeInTheDocument(),
  )
  expect(screen.getByRole('button', { name: 'Remove product lot 1' })).toBeDisabled()

  await fillLotsStep()
  await continueTo('Planned shifts')

  expect(screen.getByRole('button', { name: 'Remove shift 1' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Add shift' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Remove shift 2' }))
  await waitFor(() =>
    expect(screen.queryByRole('group', { name: 'Shift 2' })).not.toBeInTheDocument(),
  )
})
