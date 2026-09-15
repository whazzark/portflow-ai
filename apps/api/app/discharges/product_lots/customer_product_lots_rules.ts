import type { Decimal } from 'decimal.js'

import {
  type PreparationIssue,
  unavailableCustomerIssue,
} from '#discharges/shared/discharge_preparation_issues'
import { duplicateLotIssue, lotIdentityKey } from '#discharges/shared/discharge_preparation_rules'
import type { ProductLotValues } from '#discharges/shared/repositories/discharge_preparation_repository'

/**
 * The rules behind correcting one customer's lots at once. Every function here is pure: it decides
 * on rows the use case already read under the discharge's lock, and returns the refusal or the rows
 * to write.
 */

export type CustomerProductLotsCorrectionRequest = {
  /** The customer whose lots are corrected, as the group reads today. */
  customerId: string
  /** The customer every corrected and added lot belongs to afterwards. */
  targetCustomerId: string
  /** Normalized entries: with an id to correct that lot, without one to add a lot. */
  productLots: Array<{
    id?: string
    productName: string
    expectedQuantityTonnes: Decimal
    description: string | null
  }>
  removedProductLotIds: string[]
}

export type CustomerProductLotCorrection = ProductLotValues & {
  productLotId: string
  /** Whether the lot's customer or product name changes, which the write must park first. */
  identityChanges: boolean
}

export type CustomerProductLotsPlan =
  | { kind: 'LOT_NOT_FOUND' }
  | { kind: 'ISSUES'; issues: PreparationIssue[] }
  | { kind: 'LAST_LOT' }
  | {
      kind: 'PLAN'
      removals: string[]
      corrections: CustomerProductLotCorrection[]
      insertions: ProductLotValues[]
    }

type ExistingLot = { id: string; customerId: string; productName: string }

function listedOnceIssue(field: string): PreparationIssue {
  return {
    field,
    rule: 'productLotListedOnce',
    message: 'This product lot is listed more than once',
  }
}

function removableLotIssue(field: string): PreparationIssue {
  return {
    field,
    rule: 'removableProductLot',
    message: 'This product lot has warehouse door assignments',
  }
}

/**
 * Decides a correction of one customer's lots. Precedence, first refusal wins:
 *
 * 1. The corrected customer has lots on the discharge, and every listed or removed lot is one of
 *    them; anything else is a lot that is not there (`LOT_NOT_FOUND`). A customer without lots has
 *    no group to correct, so lots can only be added through it to a customer the discharge already
 *    uses, which cannot have been archived.
 * 2. A lot is listed once across both lists.
 * 3. Every rule on the values is reported at once: lots moving to another customer move to an
 *    available one (the current customer is in use, so it cannot have been archived), a removed
 *    lot never had a warehouse door, and no lot of the discharge shares its identity with another
 *    once the change is applied. Identities are judged on that final state, so two lots may swap
 *    their names, a removed lot's name may be reused, and a lot the change does not name still
 *    counts.
 * 4. The discharge keeps at least one lot.
 */
export function planCustomerProductLotsCorrection(
  request: CustomerProductLotsCorrectionRequest,
  lots: readonly ExistingLot[],
  lotIdsWithDoorAssignments: ReadonlySet<string>,
  targetCustomer: { status: string } | null,
): CustomerProductLotsPlan {
  const customerId = request.customerId.toLowerCase()
  const ownLots = new Map(
    lots.filter((lot) => lot.customerId.toLowerCase() === customerId).map((lot) => [lot.id, lot]),
  )
  const listedIds = request.productLots.flatMap((entry, index) =>
    entry.id === undefined
      ? []
      : [{ id: entry.id.toLowerCase(), field: `productLots.${index}.id` }],
  )
  const removedIds = request.removedProductLotIds.map((id, index) => ({
    id: id.toLowerCase(),
    field: `removedProductLotIds.${index}`,
  }))
  const referenced = [...listedIds, ...removedIds]

  if (ownLots.size === 0 || referenced.some(({ id }) => !ownLots.has(id))) {
    return { kind: 'LOT_NOT_FOUND' }
  }

  const seen = new Set<string>()
  const listedTwice = referenced.flatMap(({ id, field }) => {
    if (seen.has(id)) {
      return [listedOnceIssue(field)]
    }
    seen.add(id)

    return []
  })
  if (listedTwice.length > 0) {
    return { kind: 'ISSUES', issues: listedTwice }
  }

  const targetCustomerId = request.targetCustomerId
  const corrections = request.productLots.flatMap((entry) => {
    const current = entry.id === undefined ? undefined : ownLots.get(entry.id.toLowerCase())
    if (!current) {
      return []
    }

    return [
      {
        productLotId: current.id,
        customerId: targetCustomerId,
        productName: entry.productName,
        expectedQuantityTonnes: entry.expectedQuantityTonnes,
        description: entry.description,
        identityChanges:
          lotIdentityKey(current) !==
          lotIdentityKey({ customerId: targetCustomerId, productName: entry.productName }),
      },
    ]
  })
  const insertions = request.productLots
    .filter((entry) => entry.id === undefined)
    .map((entry) => ({
      customerId: targetCustomerId,
      productName: entry.productName,
      expectedQuantityTonnes: entry.expectedQuantityTonnes,
      description: entry.description,
    }))

  const removals = removedIds.map(({ id }) => id)
  const moves = request.targetCustomerId.toLowerCase() !== customerId
  const issues = [
    ...(moves && targetCustomer?.status !== 'AVAILABLE'
      ? [unavailableCustomerIssue('customerId')]
      : []),
    ...removedIds.flatMap(({ id, field }) =>
      lotIdsWithDoorAssignments.has(id) ? [removableLotIssue(field)] : [],
    ),
    ...findIdentityIssues(request, lots, seen, corrections, insertions),
  ]
  if (issues.length > 0) {
    return { kind: 'ISSUES', issues }
  }
  if (lots.length - removals.length + insertions.length === 0) {
    return { kind: 'LAST_LOT' }
  }

  return { kind: 'PLAN', removals, corrections, insertions }
}

/** Every listed entry sharing its identity with another lot of the discharge after the change. */
function findIdentityIssues(
  request: CustomerProductLotsCorrectionRequest,
  lots: readonly ExistingLot[],
  referencedIds: ReadonlySet<string>,
  corrections: CustomerProductLotCorrection[],
  insertions: ProductLotValues[],
) {
  const untouched = lots.filter((lot) => !referencedIds.has(lot.id))
  const keyCounts = new Map<string, number>()
  for (const lot of [...untouched, ...corrections, ...insertions]) {
    const key = lotIdentityKey(lot)
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1)
  }

  return request.productLots.flatMap((entry, index) =>
    (keyCounts.get(
      lotIdentityKey({ customerId: request.targetCustomerId, productName: entry.productName }),
    ) ?? 0) > 1
      ? [duplicateLotIssue(`productLots.${index}.productName`)]
      : [],
  )
}
