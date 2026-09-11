import { BaseTransformer } from '@adonisjs/core/transformers'
import { Decimal } from 'decimal.js'

import type Discharge from '#models/discharge'

type Reference<Status extends string> = { id: string; name: string; status: Status }

/** Every site reference crosses the boundary in this one shape, so each reads the same way. */
function toReference<Status extends string>(reference: Reference<Status>): Reference<Status> {
  return { id: reference.id, name: reference.name, status: reference.status }
}

/** A tonnage keeps exactly its three decimals on the wire; a number would not guarantee them. */
function toTonnes(value: Decimal) {
  return value.toFixed(3)
}

export default class DischargeDetailTransformer extends BaseTransformer<Discharge> {
  /**
   * One discharge as its detail page reads it, for every role alike. Each site reference carries
   * its own label and current status rather than only its identity: an observer cannot list
   * archived docks, trucks, or weighing areas, so a reference the page had to resolve itself would
   * go blank exactly where it was archived.
   */
  toObject() {
    const discharge = this.pick(this.resource, [
      'id',
      'status',
      'vesselName',
      'vesselImo',
      'vesselComment',
      'expectedStartAt',
    ])
    const expectedTonnage = this.resource.productLots.reduce(
      (total, productLot) => total.plus(productLot.expectedQuantityTonnes),
      new Decimal(0),
    )
    // A shift membership stores only the truck; the registration it is known by in this discharge
    // is the one its pool entry captured at reservation.
    const capturedRegistrations = new Map(
      this.resource.truckAssignments.map((assignment) => [
        assignment.truckId,
        assignment.registrationSnapshot,
      ]),
    )

    return {
      ...discharge,
      // Summed here rather than in the browser: the lots are decimals, and the web has no decimal
      // arithmetic to add them without drifting.
      expectedTonnage: toTonnes(expectedTonnage),
      dock: toReference(this.resource.dock),
      productLots: this.resource.productLots.map((productLot) => ({
        id: productLot.id,
        productName: productLot.productName,
        description: productLot.description,
        expectedQuantityTonnes: toTonnes(productLot.expectedQuantityTonnes),
        customer: toReference({
          id: productLot.customer.id,
          name: productLot.customer.companyName,
          status: productLot.customer.status,
        }),
        // Every period the lot has had a door, in effect or ended: the in-effect split is the
        // page's to draw, from `effectiveTo`.
        doorAssignments: productLot.doorAssignments.map((doorAssignment) => ({
          id: doorAssignment.id,
          effectiveFrom: doorAssignment.effectiveFrom,
          effectiveTo: doorAssignment.effectiveTo,
          warehouseDoor: toReference(doorAssignment.warehouseDoor),
          warehouse: toReference(doorAssignment.warehouseDoor.warehouse),
        })),
      })),
      // Every truck ever reserved, held or released. The registration and company are the ones
      // captured at reservation; only the statuses are current, to mark what has changed since.
      truckPool: this.resource.truckAssignments.map((assignment) => ({
        id: assignment.id,
        truckId: assignment.truckId,
        registration: assignment.registrationSnapshot,
        truckStatus: assignment.truck.status,
        transportCompany: {
          id: assignment.transportCompanyId,
          name: assignment.transportCompanyNameSnapshot,
          status: assignment.transportCompany?.status ?? null,
        },
        reservedAt: assignment.reservedAt,
        releasedAt: assignment.releasedAt,
      })),
      shifts: this.resource.shifts.map((shift) => ({
        id: shift.id,
        status: shift.status,
        plannedStartAt: shift.plannedStartAt,
        plannedEndAt: shift.plannedEndAt,
        // A name is all the page shows; contact details and access status are administration's.
        responsible: {
          id: shift.responsible.id,
          firstName: shift.responsible.firstName,
          lastName: shift.responsible.lastName,
        },
        trucks: shift.truckMemberships.map((membership) => ({
          id: membership.id,
          truckId: membership.truckId,
          // Nothing in the schema ties a shift truck to a pool entry. Without one, the truck's
          // current registration still names it, where a blank would name nothing.
          registration:
            capturedRegistrations.get(membership.truckId) ?? membership.truck.registration,
          truckStatus: membership.truck.status,
          effectiveFrom: membership.effectiveFrom,
          effectiveTo: membership.effectiveTo,
        })),
        warehouseDoors: shift.warehouseDoorMemberships.map((membership) => ({
          id: membership.id,
          effectiveFrom: membership.effectiveFrom,
          effectiveTo: membership.effectiveTo,
          warehouseDoor: toReference(membership.warehouseDoor),
          warehouse: toReference(membership.warehouseDoor.warehouse),
        })),
        weighingAreas: shift.weighingAreaMemberships.map((membership) => ({
          id: membership.id,
          effectiveFrom: membership.effectiveFrom,
          effectiveTo: membership.effectiveTo,
          weighingArea: toReference(membership.weighingArea),
        })),
      })),
    }
  }
}
