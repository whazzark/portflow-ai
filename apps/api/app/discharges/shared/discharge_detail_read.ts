import type Discharge from '#models/discharge'

/** Another planned or active discharge that currently holds a truck. */
export type OtherHolding = {
  dischargeId: string
  vesselName: string
  status: 'PLANNED' | 'ACTIVE'
}

/**
 * One discharge's detail as it is read: its preparation graph, and, for every truck it holds, the
 * other discharges holding that truck too. The holdings sit beside the model rather than in its
 * extras, so the transformer's dependency on them stays typed.
 */
export type DischargeDetailRead = {
  discharge: Discharge
  /** Keyed by lower-case truck identity; a truck no other discharge holds is absent. */
  otherHoldings: ReadonlyMap<string, OtherHolding[]>
}

/** A truck a planned discharge may reserve, as the site knows it now. */
export type TruckCandidate = {
  id: string
  registration: string
  transportCompany: { id: string; name: string }
  otherHoldings: OtherHolding[]
}

export type TruckCandidatesRead =
  | { kind: 'NOT_FOUND' }
  | { kind: 'NOT_PLANNED' }
  | { kind: 'LISTED'; candidates: TruckCandidate[] }
