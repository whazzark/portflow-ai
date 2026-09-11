import type { SessionUser } from '@/features/auth/context/session-context'
import type { UserDto } from '@/features/users/types'

/**
 * Whether this viewer is offered the identity correction on this user — asked by the record footer
 * and by the directory row menu alike, so the two can never disagree, the way `userAccessActions`
 * keeps them agreeing on the access actions.
 *
 * An organization admin corrects another user. Their own identity is the self-service path, which
 * this feature does not deliver. The API enforces both conditions regardless.
 */
export const mayEditUserIdentity = (viewer: SessionUser, user: UserDto): boolean =>
  viewer.role === 'ORGANIZATION_ADMIN' && user.id !== viewer.id
