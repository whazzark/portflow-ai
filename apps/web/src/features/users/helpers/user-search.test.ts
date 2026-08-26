import { describe, expect, test } from 'vitest'

import type { UserDto } from '@/features/users/types'
import { compareUsers, userMatchesRole, userMatchesSearch } from './user-search'

const user = (overrides: Partial<UserDto> = {}) =>
  ({
    id: 'user-1',
    firstName: 'Amélie',
    lastName: 'Bernard',
    email: 'amelie.bernard@portflow.test',
    role: 'ORGANIZATION_ADMIN',
    accessStatus: 'ACTIVE',
    ...overrides,
  }) as UserDto

describe('userMatchesSearch', () => {
  test('keeps every user when the search is empty', () => {
    expect(userMatchesSearch(user(), '')).toBe(true)
    expect(userMatchesSearch(user(), '   ')).toBe(true)
  })

  test.each([
    ['a first name fragment', 'mél'],
    ['a last name fragment', 'ernar'],
    ['an email fragment', 'bernard@port'],
  ])('matches %s', (_label, search) => {
    expect(userMatchesSearch(user(), search)).toBe(true)
  })

  test('ignores letter case', () => {
    expect(userMatchesSearch(user(), 'AMELIE')).toBe(true)
    expect(userMatchesSearch(user(), 'bernard')).toBe(true)
  })

  test('matches the displayed full name across the space', () => {
    expect(userMatchesSearch(user(), 'amelie bernard')).toBe(true)
  })

  test('excludes a user matching nothing', () => {
    expect(userMatchesSearch(user(), 'durand')).toBe(false)
  })
})

describe('userMatchesRole', () => {
  test('keeps every user when no role is selected', () => {
    expect(userMatchesRole(user(), 'all')).toBe(true)
  })

  test('keeps only the users holding the selected role', () => {
    expect(userMatchesRole(user(), 'ORGANIZATION_ADMIN')).toBe(true)
    expect(userMatchesRole(user(), 'OBSERVER')).toBe(false)
  })
})

describe('compareUsers', () => {
  const amelie = user({ id: 'a', firstName: 'Amélie', lastName: 'Bernard' })
  const bruno = user({ id: 'b', firstName: 'Bruno', lastName: 'Costa', role: 'OBSERVER' })

  test('orders on the displayed identity', () => {
    expect([bruno, amelie].sort((left, right) => compareUsers(left, right, 'name'))).toEqual([
      amelie,
      bruno,
    ])
  })

  test('orders on the displayed role label', () => {
    expect([amelie, bruno].sort((left, right) => compareUsers(left, right, 'role'))).toEqual([
      bruno,
      amelie,
    ])
  })
})
