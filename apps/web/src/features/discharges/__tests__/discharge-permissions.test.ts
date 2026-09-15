import { expect, test } from 'vitest'

import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_ADMIN,
  ACTIVE_OPERATIONS_LEAD,
  ACTIVE_ORGANIZATION_ADMIN,
} from '@/features/discharges/__tests__/support/fixtures'
import { canPrepareDischarges } from '@/features/discharges/discharge-permissions'

test.each([ACTIVE_OPERATIONS_LEAD, ACTIVE_OPERATIONS_ADMIN, ACTIVE_ORGANIZATION_ADMIN])(
  'lets an active $role prepare discharges',
  (user) => {
    expect(canPrepareDischarges(user)).toBe(true)
  },
)

test('keeps an observer from preparing discharges', () => {
  expect(canPrepareDischarges(ACTIVE_OBSERVER)).toBe(false)
})

test('keeps a user whose access is not active from preparing discharges', () => {
  expect(canPrepareDischarges({ ...ACTIVE_OPERATIONS_LEAD, accessStatus: 'DEACTIVATED' })).toBe(
    false,
  )
  expect(canPrepareDischarges(null)).toBe(false)
})
