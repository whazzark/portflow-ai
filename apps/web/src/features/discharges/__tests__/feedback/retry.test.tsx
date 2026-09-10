import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { mockDischarges, renderDischarges } from '../support/test-helpers'

test('offers a retry after a failed retrieval and recovers the collection', async () => {
  const user = userEvent.setup()
  let requests = 0
  mockDischarges({
    failTimes: 1,
    onRequest: () => {
      requests += 1
    },
  })

  renderDischarges()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load discharges')

  await user.click(screen.getByRole('button', { name: 'Try again' }))

  const table = await screen.findByRole('table', { name: 'Discharges' })
  expect(within(table).getByText('MV Ocean Cedar')).toBeInTheDocument()
  expect(requests).toBeGreaterThanOrEqual(2)
})

test('shows a loading state rather than an empty collection while the read is in flight', async () => {
  mockDischarges()

  renderDischarges()

  expect(await screen.findByRole('table', { name: 'Discharges' })).toBeInTheDocument()
  expect(screen.queryByText('No active discharges')).not.toBeInTheDocument()
})
