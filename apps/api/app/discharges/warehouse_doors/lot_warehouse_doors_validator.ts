import vine from '@vinejs/vine'

/**
 * One list of a planning change set: identities to add or to end. Its size is bounded so a single
 * save cannot lock an unbounded number of rows. Case and repeats across the two lists of a pair are
 * the use case's to settle, since the rule is about the change, not the request's shape.
 */
export const idChangeList = () => vine.array(vine.string().uuid()).maxLength(200).distinct()

export const lotWarehouseDoorsValidator = vine.create({
  assign: idChangeList(),
  withdraw: idChangeList(),
})
