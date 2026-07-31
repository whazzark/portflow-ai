import type TransportCompany from '#models/transport_company'

export default abstract class TransportCompanyRepository {
  abstract list(): Promise<TransportCompany[]>
  abstract listAvailable(): Promise<TransportCompany[]>
}
