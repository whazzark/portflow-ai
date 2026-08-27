/**
 * The two sentences every write toast is built from, and the vocabulary of a form submission.
 *
 * A write is reported one of two ways — refused or confirmed — and both name the record: a toast is
 * read out of context, and an administrator who fired several submissions in a row has only the
 * sentence to tell which one it is about. `refusalTitle` and `confirmationMessage` are where those
 * two shapes live, including the curly quotes around the name; `lifecycle-copy.ts` builds the
 * archive, reactivate, suspend, and return-to-service toasts from the same pair, so a refused
 * rename and a refused archival read alike.
 *
 * What each caller brings is the vocabulary, never the phrasing: the verb a refusal reads with, and
 * the past participle a confirmation ends on.
 */

export type ResourceWriteAction = 'create' | 'update'

/** `Unable to archive door “A1”` — `subject` is a named record, or a plural where a bulk action has
 * no single record to name. */
export function refusalTitle(verb: string, subject: string) {
  return `Unable to ${verb} ${subject}`
}

/** `door “A1”`. One home for the quoting convention, so no toast ever renders straight quotes. */
export function namedRecord(singular: string, name: string) {
  return `${singular} “${name}”`
}

/** `Door “A1” archived`. The mirror of `refusalTitle`: the same write reported either way names the
 * same record. */
export function confirmationMessage(singular: string, name: string, pastParticiple: string) {
  return `${capitalize(namedRecord(singular, name))} ${pastParticiple}`
}

/**
 * `Unable to update customer “Acme Logistics”`.
 *
 * An update names the record as it stands, never the name being typed: a refused rename would
 * otherwise quote a record that does not exist. A creation has no stored name yet, so it quotes
 * the submitted one.
 *
 * The action interpolates as its own verb, unlike a lifecycle action: `create` and `update` already
 * read as one.
 */
export function resourceFailureTitle(action: ResourceWriteAction, singular: string, name: string) {
  return refusalTitle(action, namedRecord(singular, name))
}

const WRITE_PAST_PARTICIPLES: Record<ResourceWriteAction, string> = {
  create: 'created',
  update: 'updated',
}

/**
 * `Customer “Acme Logistics” created`.
 *
 * A success quotes the name the record now carries, which for an update is the corrected one —
 * that correction is precisely what the toast is confirming.
 */
export function resourceSuccessMessage(
  action: ResourceWriteAction,
  singular: string,
  name: string,
) {
  return confirmationMessage(singular, name, WRITE_PAST_PARTICIPLES[action])
}

/** The noun opens the sentence, so `confirmationMessage` capitalizes it. Private: capitalization
 * is a property of that sentence, not something a caller decides. */
function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
}
