/**
 * The wording of the access actions offered on a user's record.
 *
 * Deliberately not `components/lifecycle/lifecycle-copy.ts`: that module is the single source of
 * lifecycle wording for every *site reference*, and every sentence in it derives from `CONTEXT.md`'s
 * archived site reference — "no longer available for new operations". A user is not a site
 * reference, and `CONTEXT.md` is explicit that "user archiving" is the wrong term for a
 * deactivation. What is shared is what should be: the two sentence shapes every write in the
 * product is reported with, which both modules take from `helpers/resource-copy`.
 *
 * Keyed by action because the record gains reactivation next; a second action adds a key here, not
 * a second dialog.
 */

import { confirmationMessage, namedRecord, refusalTitle } from '@/helpers/resource-copy'

export type UserAccessAction = 'deactivate'

const USER_SINGULAR = 'user'

/** Buttons carry the action alone: the record they sit in already names the user. */
export const USER_ACCESS_ACTION_LABELS: Record<UserAccessAction, string> = {
  deactivate: 'Deactivate',
}

export const USER_ACCESS_PENDING_LABELS: Record<UserAccessAction, string> = {
  deactivate: 'Deactivating…',
}

const USER_ACCESS_PAST_PARTICIPLES: Record<UserAccessAction, string> = {
  deactivate: 'deactivated',
}

const USER_ACCESS_FAILURE_VERBS: Record<UserAccessAction, string> = {
  deactivate: 'deactivate',
}

/** Titles name the resource — unlike buttons, they are read out of context. */
export function userAccessDialogTitle(action: UserAccessAction) {
  return `${USER_ACCESS_ACTION_LABELS[action]} ${USER_SINGULAR}?`
}

/**
 * What the transition means for this user, in the confirmation. The user is named: the confirmation
 * is the last point at which the administrator can check they are acting on the one they meant to.
 */
export function describeUserAccessEffect(_action: UserAccessAction, name: string) {
  return (
    `“${name}” can no longer sign in, on any browser. Everything they have already done ` +
    'stays visible and attributed to them.'
  )
}

export function userAccessSuccessMessage(action: UserAccessAction, name: string) {
  return confirmationMessage(USER_SINGULAR, name, USER_ACCESS_PAST_PARTICIPLES[action])
}

export function userAccessFailureTitle(action: UserAccessAction, name: string) {
  return refusalTitle(USER_ACCESS_FAILURE_VERBS[action], namedRecord(USER_SINGULAR, name))
}

/**
 * What each refusal means, in the second person and pointing at what to do instead where there is
 * something to do. Written here rather than taken from the API's message so the administrator meets
 * a sentence addressed to them, and so a reason stays distinguishable even if the API rewords it.
 */
const USER_ACCESS_REFUSAL_REASONS: Record<string, string> = {
  E_USER_SELF_DEACTIVATION: 'Another organization admin must retire your access for you.',
  E_USER_PENDING_INVITATION:
    'This user has never activated their access. Cancel their invitation instead.',
  E_USER_CANCELLED_INVITATION:
    'This user’s invitation was already withdrawn before they activated it.',
  E_USER_ALREADY_DEACTIVATED: 'This user has already been deactivated by someone else.',
  E_USER_NOT_FOUND: 'This user no longer exists.',
}

/** Falls back to what the API said: an unmapped reason is still better reported than swallowed. */
export function describeUserAccessRefusal(code: string, message: string) {
  return USER_ACCESS_REFUSAL_REASONS[code] ?? message
}
