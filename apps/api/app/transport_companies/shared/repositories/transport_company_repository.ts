import type TransportCompany from '#models/transport_company'

export type CreateTransportCompanyCommand = {
  name: string
}

export type UpdateTransportCompanyCommand = {
  id: string
  name: string
}

export type TransportCompanyWriteResult =
  | { kind: 'CREATED'; company: TransportCompany }
  | { kind: 'UPDATED'; company: TransportCompany }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ARCHIVED' }
  | { kind: 'DUPLICATE_NAME' }

export default abstract class TransportCompanyRepository {
  abstract create(command: CreateTransportCompanyCommand): Promise<TransportCompanyWriteResult>
  abstract list(): Promise<TransportCompany[]>
  abstract listAvailable(): Promise<TransportCompany[]>
  abstract findById(id: string): Promise<TransportCompany | null>
  abstract updateAvailable(
    command: UpdateTransportCompanyCommand,
  ): Promise<TransportCompanyWriteResult>
}
