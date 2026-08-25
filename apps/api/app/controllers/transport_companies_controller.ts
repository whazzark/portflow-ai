import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

import ArchiveTransportCompaniesUseCase from '#transport_companies/archive/archive_transport_companies_use_case'
import ArchiveTransportCompanyUseCase from '#transport_companies/archive/archive_transport_company_use_case'
import ListAvailableTransportCompaniesUseCase from '#transport_companies/available/list_available_transport_companies_use_case'
import CreateTransportCompanyUseCase from '#transport_companies/create/create_transport_company_use_case'
import ListTransportCompaniesUseCase from '#transport_companies/list/list_transport_companies_use_case'
import ReactivateTransportCompaniesUseCase from '#transport_companies/reactivate/reactivate_transport_companies_use_case'
import ReactivateTransportCompanyUseCase from '#transport_companies/reactivate/reactivate_transport_company_use_case'
import TransportCompanyPolicy from '#transport_companies/shared/transport_company_policy'
import TransportCompanyTransformer from '#transport_companies/shared/transport_company_transformer'
import {
  archiveTransportCompaniesValidator,
  archiveTransportCompanyValidator,
  createTransportCompanyValidator,
  reactivateTransportCompaniesValidator,
  reactivateTransportCompanyValidator,
  updateTransportCompanyValidator,
} from '#transport_companies/shared/transport_company_validator'
import UpdateTransportCompanyUseCase from '#transport_companies/update/update_transport_company_use_case'

@inject()
export default class TransportCompaniesController {
  constructor(
    private createTransportCompanyUseCase: CreateTransportCompanyUseCase,
    private listTransportCompaniesUseCase: ListTransportCompaniesUseCase,
    private listAvailableTransportCompaniesUseCase: ListAvailableTransportCompaniesUseCase,
    private updateTransportCompanyUseCase: UpdateTransportCompanyUseCase,
    private archiveTransportCompanyUseCase: ArchiveTransportCompanyUseCase,
    private archiveTransportCompaniesUseCase: ArchiveTransportCompaniesUseCase,
    private reactivateTransportCompanyUseCase: ReactivateTransportCompanyUseCase,
    private reactivateTransportCompaniesUseCase: ReactivateTransportCompaniesUseCase,
  ) {}

  async store({ bouncer, request, response, serialize }: HttpContext) {
    await bouncer.with(TransportCompanyPolicy).authorize('create')

    const payload = await request.validateUsing(createTransportCompanyValidator)

    const company = await this.createTransportCompanyUseCase.handle(payload)

    response.status(201)

    return serialize(TransportCompanyTransformer.transform(company))
  }

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

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(TransportCompanyPolicy).authorize('update')

    const payload = await request.validateUsing(updateTransportCompanyValidator)

    const company = await this.updateTransportCompanyUseCase.handle({
      id: params.id,
      ...payload,
    })

    return serialize(TransportCompanyTransformer.transform(company))
  }

  async archive({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(TransportCompanyPolicy).authorize('archive')

    const payload = await request.validateUsing(archiveTransportCompanyValidator)

    const company = await this.archiveTransportCompanyUseCase.handle({
      id: params.id,
      archivedByUserId: user.id,
      archivedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(TransportCompanyTransformer.transform(company))
  }

  async archiveMany({ auth, bouncer, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(TransportCompanyPolicy).authorize('archive')

    const payload = await request.validateUsing(archiveTransportCompaniesValidator)

    const result = await this.archiveTransportCompaniesUseCase.handle({
      ids: payload.ids,
      archivedByUserId: user.id,
      archivedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize({
      updatedCompanies: TransportCompanyTransformer.transform(result.updatedCompanies),
      blockedCompanies: result.blockedCompanies,
    })
  }

  async reactivate({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(TransportCompanyPolicy).authorize('reactivate')

    const payload = await request.validateUsing(reactivateTransportCompanyValidator)

    const company = await this.reactivateTransportCompanyUseCase.handle({
      id: params.id,
      reactivatedByUserId: user.id,
      reactivatedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(TransportCompanyTransformer.transform(company))
  }

  async reactivateMany({ auth, bouncer, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(TransportCompanyPolicy).authorize('reactivate')

    const payload = await request.validateUsing(reactivateTransportCompaniesValidator)

    const result = await this.reactivateTransportCompaniesUseCase.handle({
      ids: payload.ids,
      reactivatedByUserId: user.id,
      reactivatedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize({
      updatedCompanies: TransportCompanyTransformer.transform(result.updatedCompanies),
      blockedCompanies: result.blockedCompanies,
    })
  }
}
