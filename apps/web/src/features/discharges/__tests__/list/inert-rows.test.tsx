import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { mockDischarges, renderDischarges } from '../support/test-helpers'

// Every other directory opens a details panel from its rows. This one deliberately does not:
// opening one discharge is GH-58, and a row that looks clickable here would lead nowhere.
test('does nothing when a row is clicked', async () => {
  const user = userEvent.setup()
  mockDischarges()

  const { router } = renderDischarges()
  const table = await screen.findByRole('table', { name: 'Discharges' })
  const row = within(table).getByRole('row', { name: /MV Ocean Cedar/ })
  const addressBefore = router.state.location.searchStr
  await user.click(row)

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  // Asserted against the router, not `window.location`: the memory history leaves the latter
  // empty, so a `window.location` assertion here would pass without testing anything.
  expect(router.state.location.searchStr).toBe(addressBefore)
  expect(router.state.location.searchStr).not.toContain('dischargeId')
})

test('exposes no per-row control that suggests a discharge can be opened or changed', async () => {
  mockDischarges()

  renderDischarges()
  const table = await screen.findByRole('table', { name: 'Discharges' })
  const row = within(table).getByRole('row', { name: /MV Ocean Cedar/ })

  expect(within(row).queryByRole('button')).not.toBeInTheDocument()
  expect(within(row).queryByRole('link')).not.toBeInTheDocument()
  expect(within(row).queryByRole('checkbox')).not.toBeInTheDocument()
  expect(row).not.toHaveClass('cursor-pointer')
  // The shared `TableRow` highlights on hover by default, which reads as clickable.
  expect(row.className).not.toMatch(/hover:bg-muted/)
})
