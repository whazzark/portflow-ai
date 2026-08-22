import type TransportCompany from '#models/transport_company'

export type UpdateTransportCompanyCommand = {
  id: string
  name: string
}

export type TransportCompanyWriteResult =
  | { kind: 'UPDATED'; company: TransportCompany }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ARCHIVED' }
  | { kind: 'DUPLICATE_NAME' }

export default abstract class TransportCompanyRepository {
  abstract list(): Promise<TransportCompany[]>
  abstract listAvailable(): Promise<TransportCompany[]>
  abstract updateAvailable(
    command: UpdateTransportCompanyCommand,
  ): Promise<TransportCompanyWriteResult>
}
