import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ListAvailableTransportCompaniesUseCase from '#transport_companies/available/list_available_transport_companies_use_case'
import ListTransportCompaniesUseCase from '#transport_companies/list/list_transport_companies_use_case'
import TransportCompanyPolicy from '#transport_companies/shared/transport_company_policy'
import TransportCompanyTransformer from '#transport_companies/shared/transport_company_transformer'

@inject()
export default class TransportCompaniesController {
  constructor(
    private listTransportCompaniesUseCase: ListTransportCompaniesUseCase,
    private listAvailableTransportCompaniesUseCase: ListAvailableTransportCompaniesUseCase,
  ) {}

  async index({ bouncer, serialize }: HttpContext) {
    await bouncer.with(TransportCompanyPolicy).authorize('list')

    const companies = await this.listTransportCompaniesUseCase.handle()

    return serialize(TransportCompanyTransformer.transform(companies))
  }

  async available({ bouncer, serialize }: HttpContext) {
    await bouncer.with(TransportCompanyPolicy).authorize('listAvailable')

    const companies = await this.listAvailableTransportCompaniesUseCase.handle()

    return serialize(TransportCompanyTransformer.transform(companies))
  }
}
