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
