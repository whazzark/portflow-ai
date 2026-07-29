import type { SessionUser } from '@/features/auth/context/session-context'

type UserWithRole = Pick<SessionUser, 'role'>

export function isAdministrator(user: UserWithRole) {
  return user.role === 'OPERATIONS_ADMIN' || user.role === 'ORGANIZATION_ADMIN'
}
