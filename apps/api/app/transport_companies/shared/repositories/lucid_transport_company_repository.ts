import { DateTime } from 'luxon'

import TransportCompany from '#models/transport_company'
import isUniqueViolation from '#shared/database/is_unique_violation'

import TransportCompanyRepository, {
  type TransportCompanyWriteResult,
  type UpdateTransportCompanyCommand,
} from './transport_company_repository.ts'

export default class LucidTransportCompanyRepository extends TransportCompanyRepository {
  list(): Promise<TransportCompany[]> {
    return TransportCompany.query()
      .preload('archivedBy')
      .preload('reactivatedBy')
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
  }

  listAvailable(): Promise<TransportCompany[]> {
    return TransportCompany.query()
      .where('status', 'AVAILABLE')
      .preload('archivedBy')
      .preload('reactivatedBy')
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
  }

  async updateAvailable(
    command: UpdateTransportCompanyCommand,
  ): Promise<TransportCompanyWriteResult> {
    try {
      const [affectedRows] = await TransportCompany.query()
        .where('id', command.id)
        .where('status', 'AVAILABLE')
        .update({
          name: command.name,
          updatedAt: DateTime.now().toSQL({ includeOffset: false }),
        })

      if (affectedRows === 0) {
        const company = await TransportCompany.find(command.id)

        if (!company) {
          return { kind: 'NOT_FOUND' }
        }
        if (company.status !== 'AVAILABLE') {
          return { kind: 'ARCHIVED' }
        }

        // The row is AVAILABLE now but the UPDATE above matched no rows: it was reactivated
        // concurrently between the UPDATE and this refetch. Treat it like the caller's original
        // read was stale rather than reporting a misleading success.
        return { kind: 'NOT_FOUND' }
      }

      const company = await TransportCompany.query()
        .where('id', command.id)
        .preload('archivedBy')
        .preload('reactivatedBy')
        .first()
      if (!company) {
        return { kind: 'NOT_FOUND' }
      }

      return { kind: 'UPDATED', company }
    } catch (error) {
      // The only unique constraint that an UPDATE on this table can violate is the name index:
      // the WHERE clause targets an existing id, so the primary key can't collide.
      if (isUniqueViolation(error)) {
        return { kind: 'DUPLICATE_NAME' }
      }

      throw error
    }
  }
}
