import { expect, test } from 'vitest'

import { isAdministrator } from '@/features/auth/policies/permissions'

test.each([
  ['ORGANIZATION_ADMIN', true],
  ['OPERATIONS_ADMIN', true],
  ['OPERATIONS_LEAD', false],
  ['OBSERVER', false],
] as const)('classifies %s as administrator: %s', (role, expected) => {
  expect(isAdministrator({ role })).toBe(expected)
})
