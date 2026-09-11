import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatDateTime } from '@/helpers/dates'
import { buildDischargeDetail, listedDischarge } from '../support/fixtures'
import { mockDischargeDetail, renderDischargeDetail } from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')

function field(region: HTMLElement, label: string) {
  const term = within(region).getByText(label, { selector: 'dt' })

  return term.nextElementSibling as HTMLElement
}

test('names the vessel and states the status of the discharge', async () => {
  mockDischargeDetail()

  renderDischargeDetail(OCEAN_CEDAR.id)

  const heading = await screen.findByRole('heading', { level: 1, name: 'MV Ocean Cedar' })
  expect(heading.parentElement).toHaveTextContent('Active')
})

test('shows the vessel, the dock, the expected start, and the expected tonnage', async () => {
  mockDischargeDetail({
    details: [
      buildDischargeDetail(OCEAN_CEDAR, {
        expectedTonnage: '32150.750',
        vesselComment: 'Draught restricted at low tide',
      }),
    ],
  })

  renderDischargeDetail(OCEAN_CEDAR.id)

  const overview = await screen.findByRole('region', { name: 'Overview' })
  expect(field(overview, 'IMO')).toHaveTextContent('9410002')
  expect(field(overview, 'Vessel comment')).toHaveTextContent('Draught restricted at low tide')
  expect(field(overview, 'Dock')).toHaveTextContent('Quai Est')
  expect(field(overview, 'Expected start')).toHaveTextContent(
    formatDateTime(OCEAN_CEDAR.expectedStartAt),
  )
  expect(field(overview, 'Expected tonnage')).toHaveTextContent('32,150.750 t')
})

test('marks an absent IMO and comment as not specified rather than leaving them blank', async () => {
  const balticStar = listedDischarge('MV Baltic Star', 'PLANNED')
  mockDischargeDetail()

  renderDischargeDetail(balticStar.id)

  const overview = await screen.findByRole('region', { name: 'Overview' })
  expect(field(overview, 'IMO')).toHaveTextContent('Not specified')
  expect(field(overview, 'Vessel comment')).toHaveTextContent('Not specified')
})

test('keeps an archived dock readable and says it is archived', async () => {
  mockDischargeDetail({
    details: [
      buildDischargeDetail(OCEAN_CEDAR, {
        dock: { id: 'dock-est', name: 'Quai Est', status: 'ARCHIVED' },
      }),
    ],
  })

  renderDischargeDetail(OCEAN_CEDAR.id)

  const overview = await screen.findByRole('region', { name: 'Overview' })
  expect(field(overview, 'Dock')).toHaveTextContent('Quai Est')
  expect(field(overview, 'Dock')).toHaveTextContent('Archived')
})
