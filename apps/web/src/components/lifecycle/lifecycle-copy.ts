/**
 * The single source of lifecycle wording for every site reference.
 *
 * Every sentence here derives from `CONTEXT.md`'s definition of an archived site reference — "no
 * longer available for new operations but still visible in administration, historical discharges,
 * and reports" — so a reader meets the same promise whether they archive a customer, a dock, or a
 * warehouse. Resources declare their noun; they never declare their own phrasing.
 */

import { capitalize } from '@/helpers/resource-copy'

export type LifecycleAction = 'archive' | 'reactivate' | 'suspend' | 'return-to-service'

/** Screens that drive a whole selection in one direction — the map select modes — name that
 * direction this way, because it also scopes which records are selectable at all. */
export type BulkLifecycleIntent = 'ARCHIVE' | 'REACTIVATE'

export const ACTION_BY_BULK_INTENT: Record<BulkLifecycleIntent, LifecycleAction> = {
  ARCHIVE: 'archive',
  REACTIVATE: 'reactivate',
}

/** Buttons carry the action alone: the pane they sit in already names the resource. */
export const LIFECYCLE_ACTION_LABELS: Record<LifecycleAction, string> = {
  archive: 'Archive',
  reactivate: 'Reactivate',
  suspend: 'Suspend',
  'return-to-service': 'Return to service',
}

export const LIFECYCLE_PENDING_LABELS: Record<LifecycleAction, string> = {
  archive: 'Archiving…',
  reactivate: 'Reactivating…',
  suspend: 'Suspending…',
  'return-to-service': 'Returning to service…',
}

export const LIFECYCLE_PAST_PARTICIPLES: Record<LifecycleAction, string> = {
  archive: 'archived',
  reactivate: 'reactivated',
  suspend: 'suspended',
  'return-to-service': 'returned to service',
}

/** How an action reads inside a failure sentence. Separate from the label because an action's own
 * identifier is not always a verb phrase: interpolating it would give "Unable to return-to-service
 * truck". */
const LIFECYCLE_FAILURE_VERBS: Record<LifecycleAction, string> = {
  archive: 'archive',
  reactivate: 'reactivate',
  suspend: 'suspend',
  'return-to-service': 'return to service',
}

/** The detail pane reports the context of the transition the record currently sits in, so a
 * three-state resource such as a truck reads the same way as a two-state one. */
export const LIFECYCLE_CONTEXT_HEADINGS: Record<LifecycleAction, string> = {
  archive: 'Archive context',
  reactivate: 'Reactivation context',
  suspend: 'Suspension context',
  'return-to-service': 'Return to service context',
}

export const LIFECYCLE_TIME_LABELS: Record<LifecycleAction, string> = {
  archive: 'Archived at',
  reactivate: 'Reactivated at',
  suspend: 'Suspended at',
  'return-to-service': 'Returned to service at',
}

export const LIFECYCLE_ACTOR_LABELS: Record<LifecycleAction, string> = {
  archive: 'Archived by',
  reactivate: 'Reactivated by',
  suspend: 'Suspended by',
  'return-to-service': 'Returned to service by',
}

/** Shared by the single and bulk confirmations, and by the detail pane's comment field. */
export const LIFECYCLE_COMMENT_LABEL = 'Comment (optional)'
export const LIFECYCLE_COMMENT_DESCRIPTION =
  'Keep a short explanation for the lifecycle change (maximum 1,000 characters).'
export const BULK_LIFECYCLE_COMMENT_DESCRIPTION = 'Maximum 1,000 characters.'

/** What the transition means for one record, in the confirmation dialog. The record is named:
 * the confirmation is the last point at which the administrator can check they are acting on the
 * one they meant to. */
export function describeLifecycleEffect(action: LifecycleAction, name: string) {
  const subject = `“${name}”`

  if (action === 'reactivate') {
    return `${subject} becomes available again for new operations.`
  }

  if (action === 'suspend') {
    // Suspension is not archival: `CONTEXT.md` keeps the temporary immobilisation of a truck
    // distinct from the deliberate retirement an archive records, so it keeps its own sentence.
    return (
      `${subject} is temporarily out of service. It stops being offered for new operations, ` +
      'while the discharges, shifts, and rotations it is already part of are left untouched.'
    )
  }

  if (action === 'return-to-service') {
    // The mirror of suspension, and it has its own thing to say: the assignments kept while out
    // of service are exactly what the record comes back through.
    return (
      `${subject} becomes available again for new operations, through the assignments it kept ` +
      'while it was out of service.'
    )
  }

  return `${subject} remains readable but is no longer available for new operations.`
}

/** The same promise, made about a selection. A selection cannot be named record by record, so it
 * is counted instead — and every clause agrees with that count. */
export function describeBulkLifecycleEffect(
  action: LifecycleAction,
  count: number,
  singular: string,
  plural: string,
) {
  const one = count === 1
  const subject = one ? `This 1 ${singular}` : `These ${count} ${plural}`

  if (action === 'reactivate') {
    return `${subject} ${one ? 'becomes' : 'become'} available again for new operations.`
  }

  if (action === 'suspend') {
    return `${subject} ${one ? 'is' : 'are'} temporarily out of service and ${
      one ? 'stops' : 'stop'
    } being offered for new operations.`
  }

  if (action === 'return-to-service') {
    return `${subject} ${one ? 'becomes' : 'become'} available again for new operations.`
  }

  return `${subject} ${one ? 'remains' : 'remain'} readable but ${
    one ? 'is' : 'are'
  } no longer available for new operations.`
}

/** Titles name the resource — unlike buttons, they are read out of context. */
export function lifecycleDialogTitle(action: LifecycleAction, singular: string) {
  // "Return to service" is the only label that is not a plain transitive verb: its object goes in
  // the middle, not after it.
  if (action === 'return-to-service') {
    return `Return ${singular} to service?`
  }

  return `${LIFECYCLE_ACTION_LABELS[action]} ${singular}?`
}

export function bulkLifecycleDialogTitle(action: LifecycleAction, plural: string) {
  return `${LIFECYCLE_ACTION_LABELS[action]} selected ${plural}?`
}

/** `Dock “North Dock” archived` — the record is named here for the same reason a refusal names
 * it: a toast is read out of context, and several actions may have been fired in a row. */
export function lifecycleSuccessMessage(action: LifecycleAction, singular: string, name: string) {
  return `${capitalize(singular)} “${name}” ${LIFECYCLE_PAST_PARTICIPLES[action]}`
}

/** Names the resource, so an administrator who fired several actions can tell which was refused. */
export function lifecycleFailureTitle(action: LifecycleAction, singular: string, name: string) {
  return `Unable to ${LIFECYCLE_FAILURE_VERBS[action]} ${singular} “${name}”`
}

export function bulkLifecycleFailureTitle(action: LifecycleAction, plural: string) {
  return `Unable to ${LIFECYCLE_FAILURE_VERBS[action]} ${plural}`
}
