import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { DateTime } from 'luxon'

import type { StartHolder } from '#discharges/start/discharge_start_rules'
import type { CustomerStatus } from '#models/customer'
import type { DischargeStatus } from '#models/discharge'
import type { DockStatus } from '#models/dock'
import type { TruckStatus } from '#models/truck'
import type { UserAccessStatus, UserRole } from '#models/user'
import type { WarehouseStatus } from '#models/warehouse'
import type { WarehouseDoorStatus } from '#models/warehouse_door'
import type { WeighingAreaStatus } from '#models/weighing_area'

export type StartDischarge = { id: string; status: DischargeStatus; dockId: string }

/**
 * What a planned discharge would start with. Lots are in the detail's order (customer, product,
 * identity), and the first shift is the planned shift planned earliest, its sequence breaking ties.
 * Identities are lower-case; the pool and selections are the rows still in effect.
 */
export type StartPlan = {
  lots: Array<{ id: string; customerId: string }>
  currentAssignments: Array<{ productLotId: string; warehouseDoorId: string }>
  heldTruckIds: string[]
  firstShift: null | {
    id: string
    responsibleUserId: string
    truckIds: string[]
    warehouseDoorIds: string[]
    weighingAreaIds: string[]
  }
}

export type StartReferenceIds = {
  dockId: string
  customerIds: string[]
  userIds: string[]
  truckIds: string[]
  warehouseDoorIds: string[]
  weighingAreaIds: string[]
}

/** The current state of every reference a start uses, keyed by lower-case identity. */
export type StartReferences = {
  dock: { id: string; status: DockStatus }
  customers: ReadonlyMap<string, CustomerStatus>
  users: ReadonlyMap<string, { accessStatus: UserAccessStatus; role: UserRole }>
  trucks: ReadonlyMap<string, TruckStatus>
  warehouseDoors: ReadonlyMap<
    string,
    { status: WarehouseDoorStatus; warehouseStatus: WarehouseStatus }
  >
  weighingAreas: ReadonlyMap<string, WeighingAreaStatus>
}

export type StartHolders = {
  dock: StartHolder | null
  trucks: ReadonlyMap<string, StartHolder>
  doors: ReadonlyMap<string, StartHolder>
}

/**
 * `READ` takes no lock, for the review a user reads before confirming. `CLAIM` takes the start's
 * locks, for the confirmation itself.
 */
export type StartReadMode = 'READ' | 'CLAIM'

export type ActivationResult = { kind: 'ACTIVATED' } | { kind: 'ACTIVE_ROW_CONFLICT' }

/**
 * The reads, claims, and write behind starting a discharge. The discharge's own lock is taken
 * through `DischargePreparationRepository.lockDischarge`, whose contract states the lock order this
 * repository continues.
 *
 * A start claims the resources an active discharge holds exclusively — its dock, every truck of its
 * pool, and every door currently assigned to its lots — `FOR NO KEY UPDATE`. That mode conflicts with
 * itself, so two starts that share one of them queue on it, and the second then reads the first as
 * an active holder; each start only locks its own discharge otherwise, so nothing else would make
 * them meet. The shared references are only kept from being archived or deactivated meanwhile, with
 * `FOR SHARE`.
 */
export default abstract class DischargeStartRepository {
  /** The discharge without a lock, or `null` for an unknown or malformed identity. */
  abstract findDischarge(id: string, client: QueryClientContract): Promise<StartDischarge | null>

  /** The plan a discharge would start with, read under the caller's discharge lock when starting. */
  abstract readStartPlan(dischargeId: string, client: QueryClientContract): Promise<StartPlan>

  /**
   * The references' current states. In `CLAIM` mode the locks are taken in the repository-wide
   * order, each by sorted identity: the dock `FOR NO KEY UPDATE`, customers and users `FOR SHARE`,
   * trucks `FOR NO KEY UPDATE`, warehouses `FOR SHARE` then their doors `FOR NO KEY UPDATE`, and
   * weighing areas `FOR SHARE`.
   */
  abstract readReferences(
    ids: StartReferenceIds,
    mode: StartReadMode,
    client: QueryClientContract,
  ): Promise<StartReferences>

  /**
   * The active discharges other than this one that use the dock, hold one of the trucks, or have a
   * current assignment of one of the doors. Planned and closed discharges never hold anything here.
   * Run after the claims, so a start committed meanwhile is read as a holder.
   */
  abstract findActiveHolders(
    query: {
      dischargeId: string
      dockId: string
      truckIds: string[]
      warehouseDoorIds: string[]
    },
    client: QueryClientContract,
  ): Promise<StartHolders>

  /**
   * Makes the discharge and its first shift active at `instant`, started by the user. The caller
   * holds the discharge's lock and has checked both are planned. A partial unique index refusing the
   * write — another active discharge on the dock, or another active shift — comes back as an
   * outcome, and leaves the caller's transaction usable.
   */
  abstract activate(
    command: { dischargeId: string; shiftId: string; userId: string; instant: DateTime },
    client: TransactionClientContract,
  ): Promise<ActivationResult>
}
