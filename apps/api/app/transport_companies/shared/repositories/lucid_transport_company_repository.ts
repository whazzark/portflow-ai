import { DateTime } from 'luxon'

import TransportCompany from '#models/transport_company'
import isUniqueViolation from '#shared/database/is_unique_violation'

import TransportCompanyRepository, {
  type TransportCompanyWriteResult,
  type UpdateTransportCompanyCommand,
} from './transport_company_repository.ts'

const duplicateKind = (error: unknown): TransportCompanyWriteResult | null => {
  const candidate = error as { constraint?: string; message?: string }
  const message = String(candidate.message ?? '')
  const constraint = String(candidate.constraint ?? '')

  if (
    constraint.includes('transport_companies_name_unique') ||
    message.includes('transport_companies_name_unique')
  ) {
    return { kind: 'DUPLICATE_NAME' }
  }

  return null
}

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

        return { kind: 'NOT_FOUND' }
      }

      const company = await TransportCompany.find(command.id)
      if (!company) {
        return { kind: 'NOT_FOUND' }
      }

      return { kind: 'UPDATED', company }
    } catch (error) {
      if (isUniqueViolation(error)) {
        const duplicate = duplicateKind(error)
        if (duplicate) {
          return duplicate
        }
      }

      throw error
    }
  }
}
