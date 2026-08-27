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
