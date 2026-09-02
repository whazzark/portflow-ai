import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_ADMIN,
} from '@/features/trucks/__tests__/support/fixtures'
import { mockTrucks, renderTrucks } from '@/features/trucks/__tests__/support/test-helpers'

/**
 * `/transport-resources` is the only screen offering two selectable collections at once, so it is
 * the one place where "select everything visible" has two answers. The shortcut is therefore
 * scoped to the directory holding focus — the analogue of the map's active selecting kind, except
 * that here there is no mode to enter, so focus is what says which collection is meant.
 *
 * Focus is taken through each directory's own lifecycle tabs: they sit inside the directory and,
 * unlike a row, selecting one changes nothing about what is checked.
 */

const companyDirectory = () => screen.getByLabelText('Transport company directory')
const truckDirectory = () => screen.getByLabelText('Truck directory')

const checkedIn = (container: HTMLElement) =>
  within(container)
    .queryAllByRole('checkbox')
    .filter((checkbox) => checkbox.getAttribute('aria-checked') === 'true')

async function focusTruckDirectory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(truckDirectory()).getByRole('tab', { name: /Available/, hidden: true }))
}

async function focusCompanyDirectory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(companyDirectory()).getByRole('tab', { name: /Available/, hidden: true }))
}

test('Ctrl+A checks the trucks when focus is in the truck directory', async () => {
  const user = userEvent.setup()
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  await focusTruckDirectory(user)

  await user.keyboard('{Control>}a{/Control}')

  expect(checkedIn(truckDirectory()).length).toBeGreaterThan(0)
  // The company directory beside it is untouched: two collections on screen, one of them meant.
  expect(checkedIn(companyDirectory())).toHaveLength(0)
})

test('Ctrl+A checks the companies when focus is in the company directory', async () => {
  const user = userEvent.setup()
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await focusCompanyDirectory(user)

  await user.keyboard('{Control>}a{/Control}')

  expect(checkedIn(companyDirectory()).length).toBeGreaterThan(0)
  expect(checkedIn(truckDirectory())).toHaveLength(0)
})

test('does nothing when focus is in neither directory', async () => {
  const user = userEvent.setup()
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })

  // Focus sits on `body`, which neither directory contains: a press naming neither collection
  // must not pick one at random.
  await user.keyboard('{Control>}a{/Control}')

  expect(checkedIn(truckDirectory())).toHaveLength(0)
  expect(checkedIn(companyDirectory())).toHaveLength(0)
})

test('ignores Ctrl+A while the truck search field has focus', async () => {
  const user = userEvent.setup()
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })

  await user.click(screen.getByRole('textbox', { name: 'Search trucks' }))
  await user.keyboard('{Control>}a{/Control}')

  expect(checkedIn(truckDirectory())).toHaveLength(0)
})

test('clears the selection on Escape', async () => {
  const user = userEvent.setup()
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  await focusTruckDirectory(user)
  await user.keyboard('{Control>}a{/Control}')
  expect(checkedIn(truckDirectory()).length).toBeGreaterThan(0)

  await user.keyboard('{Escape}')

  expect(checkedIn(truckDirectory())).toHaveLength(0)
})

test('offers no shortcut to an active non-administrator', async () => {
  const user = userEvent.setup()
  mockTrucks({ user: ACTIVE_OBSERVER })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })

  await user.keyboard('{Control>}a{/Control}')

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})
