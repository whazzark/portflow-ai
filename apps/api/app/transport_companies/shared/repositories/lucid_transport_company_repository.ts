import { DateTime } from 'luxon'

import TransportCompany from '#models/transport_company'
import isUniqueViolation from '#shared/database/is_unique_violation'

import TransportCompanyRepository, {
  type CreateTransportCompanyCommand,
  type TransportCompanyWriteResult,
  type UpdateTransportCompanyCommand,
} from './transport_company_repository.ts'

export default class LucidTransportCompanyRepository extends TransportCompanyRepository {
  async create(command: CreateTransportCompanyCommand): Promise<TransportCompanyWriteResult> {
    try {
      const company = await TransportCompany.create({
        ...command,
        status: 'AVAILABLE',
        // Set explicitly rather than left unset: the columns default to NULL, but an unset
        // attribute stays `undefined` on the in-memory model and would be dropped from the
        // serialized response instead of being reported as null.
        archivedAt: null,
        archivedByUserId: null,
        archiveComment: null,
        reactivatedAt: null,
        reactivatedByUserId: null,
        reactivationComment: null,
      })

      // A new company has no archive or reactivation actor by construction, so the lifecycle
      // relations have nothing to preload and the transformer already emits null for them.
      return { kind: 'CREATED', company }
    } catch (error) {
      // The generated primary key cannot realistically collide, so the only unique constraint an
      // INSERT on this table can violate is transport_companies_name_unique.
      if (isUniqueViolation(error)) {
        return { kind: 'DUPLICATE_NAME' }
      }

      throw error
    }
  }

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

  findById(id: string): Promise<TransportCompany | null> {
    return TransportCompany.query().where('id', id).first()
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
