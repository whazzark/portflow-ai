import { Exception } from '@adonisjs/core/exceptions'

/**
 * Every refusal below is a 409 rather than a 403 or a 422: the administrator *is* entitled to
 * remove users and the request is well-formed; what conflicts is this particular target's state.
 * Each message says what applies instead, because a refusal that only says "no" leaves the
 * administrator guessing which of the four access statuses they are looking at.
 */

/**
 * Also the answer to an administrator naming themselves: the requester is active by construction,
 * so their own record is refused here without a guard of its own.
 */
export class UserActiveCannotBeRemovedException extends Exception {
  static status = 409
  static code = 'E_USER_ACTIVE_CANNOT_BE_REMOVED'
  static message =
    'Only users who never activated their access can be removed; deactivate an active user instead'
}

/**
 * No action is named: a deactivated user once held access, and people who used the application
 * are kept so that what they did stays understandable.
 */
export class UserDeactivatedCannotBeRemovedException extends Exception {
  static status = 409
  static code = 'E_USER_DEACTIVATED_CANNOT_BE_REMOVED'
  static message = 'Users who once held access are kept and cannot be removed'
}

/**
 * The database's own verdict, surfaced as a business refusal rather than a 500: a record that must
 * stay understandable — today, a shift naming the user as its responsible — restricts the removal.
 */
export class UserReferencedCannotBeRemovedException extends Exception {
  static status = 409
  static code = 'E_USER_REFERENCED_CANNOT_BE_REMOVED'
  static message = 'This user is named in operational records and cannot be removed'
}
