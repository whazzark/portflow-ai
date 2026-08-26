import type { DateTime } from 'luxon'

import type User from '#models/user'
import type { UserRole } from '#models/user'

export type CreateUserCommand = {
  firstName: string
  lastName: string
  email: string
  role: UserRole
  invitedAt?: DateTime
  invitedByUserId?: string
}

export default abstract class UserRepository {
  abstract create(command: CreateUserCommand): Promise<User>
  abstract findByEmail(email: string): Promise<User | null>

  /**
   * Every user of the organization, with the administrator responsible for each recorded lifecycle
   * event resolved. Consulted only by viewers allowed to see the access history.
   */
  abstract list(): Promise<User[]>

  /**
   * The active users only, without lifecycle actors: a responsible administrator is itself a user
   * the restricted viewer may not consult.
   */
  abstract listActive(): Promise<User[]>
}
