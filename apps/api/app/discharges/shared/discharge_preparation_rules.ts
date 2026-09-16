import type { DateTime } from 'luxon'

import type { PreparationIssue } from '#discharges/shared/discharge_preparation_issues'

/**
 * A discharge's shifts are numbered in the order they are planned to start, whatever order they
 * were entered in. Equal starts keep their input order; they can only occur between overlapping
 * shifts, which the preparation rules refuse anyway.
 */
export function orderShifts<Shift extends { plannedStartAt: DateTime }>(shifts: Shift[]) {
  return shifts
    .map((shift, index) => ({ shift, index }))
    .sort(
      (left, right) =>
        left.shift.plannedStartAt.toMillis() - right.shift.plannedStartAt.toMillis() ||
        left.index - right.index,
    )
    .map(({ shift }, position) => ({ ...shift, sequence: position + 1 }))
}

type LotIdentity = { customerId: string; productName: string }
type PlannedPeriod = { plannedStartAt: DateTime; plannedEndAt: DateTime }

const DUPLICATE_LOT_MESSAGE = 'This customer already has a lot with this product name'

/** A lot is identified by its customer and its product name, whatever its case or spacing. */
export function lotIdentityKey(lot: LotIdentity) {
  return JSON.stringify([lot.customerId.toLowerCase(), lot.productName.trim().toLowerCase()])
}

export function duplicateLotIssue(field: string): PreparationIssue {
  return { field, rule: 'productLotIdentityUnique', message: DUPLICATE_LOT_MESSAGE }
}

/** Every lot sharing its identity with another lot of the same submission, at its position. */
export function findDuplicateLotIssues(productLots: LotIdentity[]) {
  const lotCounts = new Map<string, number>()
  for (const lot of productLots) {
    const key = lotIdentityKey(lot)
    lotCounts.set(key, (lotCounts.get(key) ?? 0) + 1)
  }

  return productLots.flatMap((lot, index) =>
    (lotCounts.get(lotIdentityKey(lot)) ?? 0) > 1
      ? [duplicateLotIssue(`productLots.${index}.productName`)]
      : [],
  )
}

/**
 * The rules a preparation breaks across its lots and shifts, reported at the position each value
 * was entered in so the form can point at it. Checked before any lock is taken: they depend only
 * on the submission.
 */
export function findPreparationIssues({
  productLots,
  shifts,
}: {
  productLots: LotIdentity[]
  shifts: PlannedPeriod[]
}) {
  const issues = findDuplicateLotIssues(productLots)

  shifts.forEach((shift, index) => {
    if (!isOrderedPeriod(shift)) {
      issues.push(shiftPeriodOrderIssue(`shifts.${index}.plannedEndAt`))
    }
  })

  const overlapping = new Set<number>()
  shifts.forEach((shift, index) => {
    shifts.forEach((other, otherIndex) => {
      if (otherIndex !== index && periodsOverlap(shift, other)) {
        overlapping.add(index)
      }
    })
  })
  for (const index of [...overlapping].sort((left, right) => left - right)) {
    issues.push(shiftOverlapIssue(`shifts.${index}.plannedStartAt`))
  }

  return issues
}

/** A planned period ends after it starts: a shift of no length is no shift. */
export function isOrderedPeriod(period: PlannedPeriod) {
  return period.plannedEndAt.toMillis() > period.plannedStartAt.toMillis()
}

/** A shift ending exactly when the next starts does not overlap it: the break may last nothing. */
export function periodsOverlap(left: PlannedPeriod, right: PlannedPeriod) {
  return (
    left.plannedStartAt.toMillis() < right.plannedEndAt.toMillis() &&
    right.plannedStartAt.toMillis() < left.plannedEndAt.toMillis()
  )
}

export function shiftPeriodOrderIssue(field: string): PreparationIssue {
  return {
    field,
    rule: 'shiftPeriodOrder',
    message: 'The planned end must be after the planned start',
  }
}

export function shiftOverlapIssue(field: string): PreparationIssue {
  return { field, rule: 'shiftOverlap', message: 'This shift overlaps another shift' }
}

/**
 * Whether `candidate` would share its identity with one of a discharge's existing lots, the lot
 * being corrected excepted.
 */
export function findLotIdentityClash(
  lots: Array<LotIdentity & { id: string }>,
  candidate: LotIdentity,
  ignoreLotId?: string,
) {
  const key = lotIdentityKey(candidate)

  return lots.some((lot) => lot.id !== ignoreLotId && lotIdentityKey(lot) === key)
}
