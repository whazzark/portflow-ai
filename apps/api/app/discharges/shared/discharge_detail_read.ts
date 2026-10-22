import type { DateTime } from 'luxon'

import type Discharge from '#models/discharge'

/** Another planned or active discharge that currently holds a truck. */
export type OtherHolding = {
  dischargeId: string
  vesselName: string
  status: 'PLANNED' | 'ACTIVE'
}

/**
 * Another planned or active discharge assigned to the same dock, with the span its shifts are
 * planned over. Only a planned discharge reads them: they are what its dock timeline draws.
 */
export type DockOccupation = {
  dischargeId: string
  vesselName: string
  status: 'PLANNED' | 'ACTIVE'
  expectedStartAt: DateTime
  startedAt: DateTime | null
  /** The earliest planned start of its shifts, whatever their status; `null` without shifts. */
  plannedStartAt: DateTime | null
  /** The latest planned end of its shifts, whatever their status; `null` without shifts. */
  plannedEndAt: DateTime | null
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
  /** Active ones first, then by when they are planned to begin; empty unless this one is planned. */
  dockOccupations: DockOccupation[]
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
