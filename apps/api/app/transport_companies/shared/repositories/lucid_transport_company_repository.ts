import TransportCompany from '#models/transport_company'

import TransportCompanyRepository from './transport_company_repository.ts'

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
}
