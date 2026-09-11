/**
 * The wording of the access actions offered on a user's record.
 *
 * Deliberately not `components/lifecycle/lifecycle-copy.ts`: that module is the single source of
 * lifecycle wording for every *site reference*, and every sentence in it derives from `CONTEXT.md`'s
 * archived site reference — "no longer available for new operations". A user is not a site
 * reference, and `CONTEXT.md` is explicit that "user archiving" is the wrong term for a
 * deactivation — or, for that matter, a pending user removal. What is shared is what should be: the
 * two sentence shapes every write in the product is reported with, which both modules take from
 * `helpers/resource-copy`.
 *
 * Keyed by action, so a new access action adds keys here rather than a second dialog. Invitation
 * cancellation brought a dialog title and a dismiss label of its own, because "Cancel invitation
 * user?" reads as nonsense and a confirmation whose two buttons both start with "Cancel" asks the
 * administrator to guess which one withdraws the access. Removal needed neither, and differs from
 * deactivation only by its entries here.
 */

import { confirmationMessage, namedRecord, refusalTitle } from '@/helpers/resource-copy'

export type UserAccessAction = 'deactivate' | 'cancel-invitation' | 'remove'

const USER_SINGULAR = 'user'

/**
 * Buttons carry the action alone: the record they sit in already names the user. "Invitation" is part
 * of the action rather than a resource noun — it names what is cancelled, and `Cancel` alone would
 * collide with every dismiss button in the product.
 */
export const USER_ACCESS_ACTION_LABELS: Record<UserAccessAction, string> = {
  deactivate: 'Deactivate',
  'cancel-invitation': 'Cancel invitation',
  remove: 'Remove',
}

export const USER_ACCESS_PENDING_LABELS: Record<UserAccessAction, string> = {
  deactivate: 'Deactivating…',
  'cancel-invitation': 'Cancelling…',
  remove: 'Removing…',
}

/**
 * What dismisses the confirmation. A deactivation keeps the product-wide `Cancel`; an invitation
 * cancellation cannot, since its confirm button already says "Cancel invitation", so its dismiss
 * says what dismissing does instead.
 */
export const USER_ACCESS_DISMISS_LABELS: Record<UserAccessAction, string> = {
  deactivate: 'Cancel',
  'cancel-invitation': 'Keep invitation',
  remove: 'Cancel',
}

/**
 * Whether the confirmation offers a comment. An invitation cancellation does — it is the one access
 * change whose reason is worth keeping, since the person never got to use the access at all — and a
 * deactivation records a date and an actor only.
 */
export const USER_ACCESS_TAKES_COMMENT: Record<UserAccessAction, boolean> = {
  deactivate: false,
  'cancel-invitation': true,
  remove: false,
}

/**
 * What each action's toasts name. A deactivation acts on the user; a cancellation acts on the
 * invitation they hold, so its sentences read "invitation for “Chloé Durand”".
 */
const USER_ACCESS_SUBJECTS: Record<UserAccessAction, string> = {
  deactivate: USER_SINGULAR,
  'cancel-invitation': 'invitation for',
  remove: USER_SINGULAR,
}

const USER_ACCESS_PAST_PARTICIPLES: Record<UserAccessAction, string> = {
  deactivate: 'deactivated',
  'cancel-invitation': 'cancelled',
  remove: 'removed',
}

const USER_ACCESS_FAILURE_VERBS: Record<UserAccessAction, string> = {
  deactivate: 'deactivate',
  'cancel-invitation': 'cancel',
  remove: 'remove',
}

/** Titles name what is acted on — unlike buttons, they are read out of context. */
const USER_ACCESS_DIALOG_TITLES: Record<UserAccessAction, string> = {
  deactivate: `${USER_ACCESS_ACTION_LABELS.deactivate} ${USER_SINGULAR}?`,
  'cancel-invitation': `${USER_ACCESS_ACTION_LABELS['cancel-invitation']}?`,
  remove: `${USER_ACCESS_ACTION_LABELS.remove} ${USER_SINGULAR}?`,
}

export function userAccessDialogTitle(action: UserAccessAction) {
  return USER_ACCESS_DIALOG_TITLES[action]
}

/**
 * What the transition means for this user, in the confirmation. The user is named: the confirmation
 * is the last point at which the administrator can check they are acting on the one they meant to.
 */
export function describeUserAccessEffect(action: UserAccessAction, name: string) {
  if (action === 'cancel-invitation') {
    return (
      `“${name}” will no longer be able to activate their access. The activation link they were ` +
      'given stops working immediately.'
    )
  }

  if (action === 'remove') {
    return (
      `“${name}” is removed permanently, and this cannot be undone. Their activation link stops ` +
      'working, and their email can be invited again.'
    )
  }

  return (
    `“${name}” can no longer sign in, on any browser. Everything they have already done ` +
    'stays visible and attributed to them.'
  )
}

export function userAccessSuccessMessage(action: UserAccessAction, name: string) {
  return confirmationMessage(
    USER_ACCESS_SUBJECTS[action],
    name,
    USER_ACCESS_PAST_PARTICIPLES[action],
  )
}

export function userAccessFailureTitle(action: UserAccessAction, name: string) {
  return refusalTitle(
    USER_ACCESS_FAILURE_VERBS[action],
    namedRecord(USER_ACCESS_SUBJECTS[action], name),
  )
}

/**
 * What each refusal means, in the second person and pointing at what to do instead where there is
 * something to do. Written here rather than taken from the API's message so the administrator meets
 * a sentence addressed to them, and so a reason stays distinguishable even if the API rewords it.
 *
 * Keyed by action first: one code can mean different things for two actions. An already
 * deactivated user is "someone else got there first" for a deactivation, and "there is no
 * invitation left" for a cancellation.
 */
const USER_ACCESS_REFUSAL_REASONS: Record<UserAccessAction, Record<string, string>> = {
  deactivate: {
    E_USER_SELF_DEACTIVATION: 'Another organization admin must retire your access for you.',
    E_USER_PENDING_INVITATION:
      'This user has never activated their access. Cancel their invitation instead.',
    E_USER_CANCELLED_INVITATION:
      'This user’s invitation was already withdrawn before they activated it.',
    E_USER_ALREADY_DEACTIVATED: 'This user has already been deactivated by someone else.',
    E_USER_NOT_FOUND: 'This user no longer exists.',
  },
  'cancel-invitation': {
    E_USER_ALREADY_ACTIVATED:
      'This user has already activated their access. Deactivate them instead.',
    E_USER_ALREADY_DEACTIVATED:
      'This user activated their access and has since been deactivated. There is no invitation left to cancel.',
    E_USER_CANCELLED_INVITATION: 'This invitation has already been cancelled by someone else.',
    E_USER_NOT_FOUND: 'This user no longer exists.',
  },
  remove: {
    E_USER_ACTIVE_CANNOT_BE_REMOVED:
      'This user has activated their access, so they are kept. Deactivate them instead.',
    E_USER_DEACTIVATED_CANNOT_BE_REMOVED: 'This user once held access, so they are kept.',
    E_USER_REFERENCED_CANNOT_BE_REMOVED:
      'This user is named in operational records, so they are kept.',
    // Also a second removal: nothing of the first is kept, so from here it reads the same.
    E_USER_NOT_FOUND: 'This user no longer exists.',
  },
}

/** Falls back to what the API said: an unmapped reason is still better reported than swallowed. */
export function describeUserAccessRefusal(action: UserAccessAction, code: string, message: string) {
  return USER_ACCESS_REFUSAL_REASONS[action][code] ?? message
}
