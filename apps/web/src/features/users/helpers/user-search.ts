import { formatFullName } from '@/features/users/helpers/name'
import { USER_ROLE_LABELS } from '@/features/users/helpers/user-labels'
import type { UserDto, UserRole } from '@/features/users/types'
import { normalizeSearch } from '@/helpers/search'

export type UserRoleFilter = UserRole | 'all'
export type UserSortColumn = 'name' | 'role'

/**
 * Case- and diacritic-insensitive fragment match over the displayed identity and the email. The
 * full name is matched too, so "amelie bernard" finds a user whose parts are stored separately.
 */
export function userMatchesSearch(user: UserDto, search: string) {
  const normalizedSearch = normalizeSearch(search)

  if (!normalizedSearch) {
    return true
  }

  return [user.firstName, user.lastName, user.email, formatFullName(user)].some((value) =>
    normalizeSearch(value).includes(normalizedSearch),
  )
}

export function userMatchesRole(user: UserDto, role: UserRoleFilter) {
  return role === 'all' || user.role === role
}

/** Orders on what the table displays, so the sort matches what the administrator reads. */
export function compareUsers(left: UserDto, right: UserDto, column: UserSortColumn) {
  const value = (user: UserDto) =>
    column === 'role' ? USER_ROLE_LABELS[user.role] : formatFullName(user)

  return value(left).localeCompare(value(right), 'en', { sensitivity: 'base' })
}
