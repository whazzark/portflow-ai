/**
 * The wording of a refused write: the toast a form raises when the API turns a submission down for
 * a reason no field can carry.
 *
 * The record is named, exactly as `lifecycleFailureTitle` names it — a toast is read out of
 * context, and an administrator who fired several submissions in a row has only the title to tell
 * which one was refused.
 */

export type ResourceWriteAction = 'create' | 'update'

/**
 * `Unable to update customer “Acme Logistics”`.
 *
 * An update names the record as it stands, never the name being typed: a refused rename would
 * otherwise quote a record that does not exist. A creation has no stored name yet, so it quotes
 * the submitted one.
 */
export function resourceFailureTitle(action: ResourceWriteAction, singular: string, name: string) {
  return `Unable to ${action} ${singular} “${name}”`
}

const WRITE_PAST_PARTICIPLES: Record<ResourceWriteAction, string> = {
  create: 'created',
  update: 'updated',
}

/**
 * `Customer “Acme Logistics” created`.
 *
 * The mirror of `resourceFailureTitle`: the same submission reported either way names the same
 * record. A success quotes the name the record now carries, which for an update is the corrected
 * one — that correction is precisely what the toast is confirming.
 */
export function resourceSuccessMessage(
  action: ResourceWriteAction,
  singular: string,
  name: string,
) {
  return `${capitalize(singular)} “${name}” ${WRITE_PAST_PARTICIPLES[action]}`
}

/** The noun opens the sentence, so it is capitalized wherever a resource message is built. */
export function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
}
