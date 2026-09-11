import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { listedDischarge } from '@/features/discharges/__tests__/support/fixtures'
import {
  mockDischargeDetail,
  mockDischarges,
  renderDischargeDetail,
  renderDischarges,
} from '@/features/discharges/__tests__/support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')

test("links a nested page's parent crumb back with the search it carries", async () => {
  mockDischargeDetail()

  // biome-ignore lint/security/noSecrets: a shared consultation address, not a credential
  renderDischargeDetail(OCEAN_CEDAR.id, '?status=closed&search=Cargill')
  await screen.findByRole('heading', { level: 1, name: 'MV Ocean Cedar' })
  const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' })

  const parent = within(breadcrumb).getByText('Discharges').closest('a')
  expect(parent).toHaveAttribute('href', expect.stringContaining('status=closed'))
  expect(parent).toHaveAttribute('href', expect.stringContaining('search=Cargill'))
})

test('names the open discharge by its vessel in the breadcrumb', async () => {
  mockDischargeDetail()

  renderDischargeDetail(OCEAN_CEDAR.id)
  await screen.findByRole('heading', { level: 1, name: 'MV Ocean Cedar' })
  const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' })

  expect(breadcrumb).toHaveTextContent('Discharges')
  expect(within(breadcrumb).getByText('MV Ocean Cedar')).toHaveAttribute('aria-current', 'page')
  expect(within(breadcrumb).queryByText('Details')).not.toBeInTheDocument()
})

test('falls back to a generic crumb when no discharge could be read', async () => {
  mockDischargeDetail({ notFound: true })

  renderDischargeDetail(OCEAN_CEDAR.id)
  await screen.findByText('Discharge not found')
  const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' })

  expect(within(breadcrumb).getByText('Discharge')).toHaveAttribute('aria-current', 'page')
})

test('keeps a single-crumb page as the current page rather than a link', async () => {
  mockDischarges()

  renderDischarges('/discharges?status=closed')
  await screen.findByRole('table', { name: 'Discharges' })
  const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' })

  const crumb = within(breadcrumb).getByText('Discharges')
  // The current crumb is a disabled `role="link"` span, never an anchor that could navigate.
  expect(crumb).toHaveAttribute('aria-current', 'page')
  expect(crumb.closest('a')).toBeNull()
})
