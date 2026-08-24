import { Decimal } from 'decimal.js'

import Truck from '#models/truck'
import isUniqueViolation from '#shared/database/is_unique_violation'

import TruckRepository, {
  type CreateTruckCommand,
  type TruckWriteResult,
} from './truck_repository.ts'

export default class LucidTruckRepository extends TruckRepository {
  async create(command: CreateTruckCommand): Promise<TruckWriteResult> {
    try {
      const truck = await Truck.create({
        ...command,
        capacityTonnes: new Decimal(command.capacityTonnes),
        status: 'AVAILABLE',
        archivedAt: null,
        archivedByUserId: null,
        archiveComment: null,
        reactivatedAt: null,
        reactivatedByUserId: null,
        reactivationComment: null,
      })

      return { kind: 'CREATED', truck }
    } catch (error) {
      if (isUniqueViolation(error)) {
        const candidate = error as { constraint?: string; message?: string }
        const marker = `${candidate.constraint ?? ''} ${candidate.message ?? ''}`

        if (marker.includes('trucks_registration_unique')) {
          return { kind: 'DUPLICATE_REGISTRATION' }
        }
      }

      throw error
    }
  }

  list(): Promise<Truck[]> {
    return (
      Truck.query()
        .preload('archivedBy')
        .preload('reactivatedBy')
        // biome-ignore lint/security/noSecrets: SQL ordering expression, not a secret
        .orderByRaw('LOWER(registration) ASC')
        .orderBy('registration', 'asc')
        .orderBy('id', 'asc')
    )
  }

  listAvailable(): Promise<Truck[]> {
    return (
      Truck.query()
        .where('status', 'AVAILABLE')
        .preload('archivedBy')
        .preload('reactivatedBy')
        // biome-ignore lint/security/noSecrets: SQL ordering expression, not a secret
        .orderByRaw('LOWER(registration) ASC')
        .orderBy('registration', 'asc')
        .orderBy('id', 'asc')
    )
  }
}
