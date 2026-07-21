import { describe, expect, test } from 'vitest'

import { formatFullName, getInitials } from '@/features/users/helpers/name'

describe('user name helpers', () => {
  test('formats a full name without its surrounding whitespace', () => {
    expect(formatFullName({ firstName: ' Claire ', lastName: ' Martin ' })).toBe('Claire Martin')
  })

  test('returns uppercase initials while preserving accented characters', () => {
    expect(getInitials({ firstName: 'Élodie', lastName: "d'Argent" })).toBe('ÉD')
  })

  test('supports a partial name', () => {
    expect(formatFullName({ firstName: 'Claire', lastName: '' })).toBe('Claire')
    expect(getInitials({ firstName: 'Claire', lastName: '' })).toBe('C')
  })
})
