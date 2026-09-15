import type { ApiError } from '@/libraries/tuyau/api-error'

export type TruckRefusals = {
  /** The reason each refused truck carries, by truck identity. */
  byTruck: Map<string, string>
  /** Reasons that name no submitted truck, shown above the list so none is silent. */
  summary: string[]
}

const TRUCK_FIELD = /^truckIds\.(\d+)$/

/**
 * The API reports a refused truck at its position in the request. The page submitted that list, so
 * it can put each reason back on the truck it concerns; a truck field matches no form field that
 * the form library could map it onto.
 */
export function truckRefusals(
  error: ApiError,
  submittedTruckIds: readonly string[],
): TruckRefusals | null {
  if (error.code !== 'E_VALIDATION_ERROR') {
    return null
  }

  const refusals: TruckRefusals = { byTruck: new Map(), summary: [] }

  for (const detail of error.details ?? []) {
    const index = TRUCK_FIELD.exec(detail.field)?.[1]
    const truckId = index === undefined ? undefined : submittedTruckIds[Number(index)]

    if (truckId === undefined) {
      refusals.summary.push(detail.message)
    } else {
      refusals.byTruck.set(truckId, detail.message)
    }
  }

  return refusals
}

/**
 * The reasons the refused resources of one submitted list carry, by identity, read the same way:
 * `warehouseDoorIds.2` refuses the third door submitted. Details on any other field are left to the
 * form that renders it.
 */
export function listRefusals(
  error: ApiError,
  list: string,
  submittedIds: readonly string[],
): Map<string, string> {
  const reasons = new Map<string, string>()
  if (error.code !== 'E_VALIDATION_ERROR') {
    return reasons
  }

  const prefix = `${list}.`
  for (const detail of error.details ?? []) {
    const id = detail.field.startsWith(prefix)
      ? submittedIds[Number(detail.field.slice(prefix.length))]
      : undefined
    if (id !== undefined) {
      reasons.set(id, detail.message)
    }
  }

  return reasons
}
