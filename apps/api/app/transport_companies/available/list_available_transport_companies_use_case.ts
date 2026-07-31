import { inject } from '@adonisjs/core'

import TransportCompanyRepository from '#transport_companies/shared/repositories/transport_company_repository'

@inject()
export default class ListAvailableTransportCompaniesUseCase {
  constructor(private transportCompanyRepository: TransportCompanyRepository) {}

  handle() {
    return this.transportCompanyRepository.listAvailable()
  }
}
