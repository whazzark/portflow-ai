import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ACTIVE_OPERATIONS_LEAD, AVAILABLE_DOCKS, DOCK_OCCUPANCY } from '../support/fixtures'
import {
  allowFormJourneyTime,
  change,
  chooseOption,
  continueTo,
  fillLotsStep,
  fillShiftsStep,
  fillVesselStep,
  goToStep,
  mockCreateDischarge,
  mockDischarges,
  mockDockOccupancy,
  mockPreparationOptions,
  openCreationFromList,
} from '../support/test-helpers'

allowFormJourneyTime()

function arrange(occupancy: Parameters<typeof mockDockOccupancy>[0] = {}) {
  const requested: Array<string | null> = []
  const sent: unknown[] = []
  mockDischarges({ user: ACTIVE_OPERATIONS_LEAD })
  mockPreparationOptions({ user: ACTIVE_OPERATIONS_LEAD })
  mockDockOccupancy({ ...occupancy, onRequest: (dockId) => requested.push(dockId) })
  mockCreateDischarge({ onRequest: (body) => sent.push(body) })

  return { requested, sent }
}

async function reachShiftsStep() {
  await openCreationFromList()
  await fillVesselStep()
  await continueTo('Product lots')
  await fillLotsStep()
  await continueTo('Planned shifts')

  return screen.getByRole('region', { name: 'Shift preview' })
}

function shiftBlocks(preview: HTMLElement) {
  return within(preview)
    .queryAllByRole('listitem', { name: /^Shift \d+, / })
    .map((block) => block.getAttribute('aria-label'))
}

test('opens the Planned shifts step on the preview, before the shifts form', async () => {
  arrange({ occupancy: DOCK_OCCUPANCY })
  const preview = await reachShiftsStep()
  const heading = screen.getByRole('heading', { level: 2, name: 'Planned shifts' })

  expect(preview.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(preview).getByRole('heading', { name: 'Shift preview' })).toBeInTheDocument()
})

test('shows when the dock frees up, the other discharges on it, and the expected start', async () => {
  arrange({ occupancy: DOCK_OCCUPANCY })
  const preview = await reachShiftsStep()

  expect(
    await within(preview).findByText(
      `${AVAILABLE_DOCKS[0].name} · free from Tue 29 Sept, 14:00 · expected start Thu 1 Oct, 06:00`,
    ),
  ).toBeInTheDocument()
  const dock = within(preview).getByRole('list', { name: 'Dock occupancy' })
  expect(within(dock).getByText('MV Nordic Breeze')).toBeInTheDocument()
  expect(within(dock).getByText('until Tue 29, 14:00')).toBeInTheDocument()
  expect(within(dock).getByText('MV Baltic Star')).toBeInTheDocument()
  expect(within(dock).getAllByText('Dock free').length).toBeGreaterThan(0)
  expect(
    within(preview).getByRole('img', { name: 'Expected start Thu 1 Oct, 06:00' }),
  ).toBeInTheDocument()
})

test('names the shifts without a period rather than placing them', async () => {
  arrange()
  const preview = await reachShiftsStep()

  expect(within(preview).getByText('Shift 1 · no period yet')).toBeInTheDocument()
  expect(shiftBlocks(preview)).toEqual([])
  expect(within(preview).getByText('MV Created Dawn')).toBeInTheDocument()
})

test('follows the shifts as they are planned, added, and removed, without asking again', async () => {
  const { requested } = arrange()
  const preview = await reachShiftsStep()
  await waitFor(() => expect(requested).toHaveLength(1))

  await fillShiftsStep()

  await waitFor(() =>
    expect(shiftBlocks(preview)).toEqual([
      'Shift 1, Thu 1 Oct 14:00 – 22:00',
      'Shift 2, Thu 1 Oct 06:00 – 14:00',
    ]),
  )
  expect(within(preview).getByText('2 shifts · 16 h')).toBeInTheDocument()
  expect(within(preview).queryByText(/no period yet/)).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Remove shift 2' }))

  await waitFor(() => expect(shiftBlocks(preview)).toEqual(['Shift 1, Thu 1 Oct 14:00 – 22:00']))
  expect(within(preview).getByText('1 shift · 8 h')).toBeInTheDocument()
  expect(requested).toHaveLength(1)
})

test('reads the occupancy of the dock chosen again on the first step', async () => {
  const { requested } = arrange()
  await reachShiftsStep()
  await waitFor(() => expect(requested).toEqual([AVAILABLE_DOCKS[0].id]))

  await goToStep('Vessel and dock')
  await chooseOption(document.body, 'Dock', AVAILABLE_DOCKS[1].name)
  await goToStep('Planned shifts')

  await waitFor(() => expect(requested).toEqual([AVAILABLE_DOCKS[0].id, AVAILABLE_DOCKS[1].id]))
  expect(
    await screen.findByText(`${AVAILABLE_DOCKS[1].name} · expected start Thu 1 Oct, 06:00`),
  ).toBeInTheDocument()
})

test('reads the occupancy again each time the step opens, on the same dock too', async () => {
  const { requested } = arrange()
  await reachShiftsStep()
  await waitFor(() => expect(requested).toHaveLength(1))

  await goToStep('Product lots')
  await goToStep('Planned shifts')

  await waitFor(() => expect(requested).toEqual([AVAILABLE_DOCKS[0].id, AVAILABLE_DOCKS[0].id]))
})

test('reads a dock nobody holds as free, with no moment it frees up', async () => {
  arrange({ occupancy: [] })
  const preview = await reachShiftsStep()

  const dock = await within(preview).findByRole('list', { name: 'Dock occupancy' })
  expect(within(dock).getByText('Dock free')).toBeInTheDocument()
  expect(within(preview).queryByText(/free from/)).not.toBeInTheDocument()
})

test('keeps the expected start and the shifts when the occupancy cannot be read, and retries', async () => {
  arrange({ occupancy: DOCK_OCCUPANCY, failTimes: 1 })
  const preview = await reachShiftsStep()
  await fillShiftsStep()

  expect(await within(preview).findByText('Dock occupancy is unavailable.')).toBeInTheDocument()
  expect(
    within(preview).getByRole('img', { name: 'Expected start Thu 1 Oct, 06:00' }),
  ).toBeInTheDocument()
  expect(shiftBlocks(preview)).toHaveLength(2)

  fireEvent.click(within(preview).getByRole('button', { name: 'Retry' }))

  expect(await within(preview).findByText('MV Nordic Breeze')).toBeInTheDocument()
  expect(within(preview).queryByText('Dock occupancy is unavailable.')).not.toBeInTheDocument()
})

test('never holds the creation back, even with the dock held at the expected start', async () => {
  const straddling = [
    {
      ...DOCK_OCCUPANCY[0],
      endAt: new Date(2026, 9, 1, 12).toISOString(),
    },
  ]
  const { sent } = arrange({ occupancy: straddling })
  await reachShiftsStep()
  await fillShiftsStep()

  const create = screen.getByRole('button', { name: 'Create discharge' })
  expect(create).toBeEnabled()
  fireEvent.click(create)

  await waitFor(() => expect(sent).toHaveLength(1))
})

test('draws every shift of a long discharge, the preview staying first and unpinned', async () => {
  arrange({ occupancy: DOCK_OCCUPANCY })
  const preview = await reachShiftsStep()

  for (let index = 0; index < 8; index += 1) {
    if (index > 0) {
      fireEvent.click(screen.getByRole('button', { name: 'Add shift' }))
    }
    const row = await screen.findByRole('group', { name: `Shift ${index + 1}` })
    const day = String(1 + Math.floor(index / 2)).padStart(2, '0')
    const [start, end] = index % 2 === 0 ? ['06', '14'] : ['22', '23']
    change(within(row).getByLabelText(/^Planned start/), `2026-10-${day}T${start}:00`)
    change(within(row).getByLabelText(/^Planned end/), `2026-10-${day}T${end}:00`)
  }

  await waitFor(() => expect(shiftBlocks(preview)).toHaveLength(8))
  expect(within(preview).getAllByTestId('shift-break')).toHaveLength(7)
  expect(preview.className).not.toMatch(/\b(sticky|fixed)\b/)
  expect(
    preview.compareDocumentPosition(
      screen.getByRole('heading', { level: 2, name: 'Planned shifts' }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
})
