import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ArchiveCustomerUseCase from '#customers/archive/archive_customer_use_case'
import ArchiveCustomersUseCase from '#customers/archive/archive_customers_use_case'
import ListAvailableCustomersUseCase from '#customers/available/list_available_customers_use_case'
import CreateCustomerUseCase from '#customers/create/create_customer_use_case'
import ListCustomersUseCase from '#customers/list/list_customers_use_case'
import ReactivateCustomerUseCase from '#customers/reactivate/reactivate_customer_use_case'
import ReactivateCustomersUseCase from '#customers/reactivate/reactivate_customers_use_case'
import CustomerPolicy from '#customers/shared/customer_policy'
import CustomerTransformer from '#customers/shared/customer_transformer'
import {
  archiveCustomerValidator,
  archiveCustomersValidator,
  createCustomerValidator,
  reactivateCustomerValidator,
  reactivateCustomersValidator,
  updateCustomerValidator,
} from '#customers/shared/customer_validator'
import GetCustomerUseCase from '#customers/show/get_customer_use_case'
import UpdateCustomerUseCase from '#customers/update/update_customer_use_case'

@inject()
export default class CustomersController {
  constructor(
    private createCustomerUseCase: CreateCustomerUseCase,
    private listCustomersUseCase: ListCustomersUseCase,
    private listAvailableCustomersUseCase: ListAvailableCustomersUseCase,
    private getCustomerUseCase: GetCustomerUseCase,
    private updateCustomerUseCase: UpdateCustomerUseCase,
    private archiveCustomerUseCase: ArchiveCustomerUseCase,
    private reactivateCustomerUseCase: ReactivateCustomerUseCase,
    private archiveCustomersUseCase: ArchiveCustomersUseCase,
    private reactivateCustomersUseCase: ReactivateCustomersUseCase,
  ) {}

  async store({ bouncer, request, response, serialize }: HttpContext) {
    await bouncer.with(CustomerPolicy).authorize('create')

    const payload = await request.validateUsing(createCustomerValidator)

    const customer = await this.createCustomerUseCase.handle(payload)

    response.status(201)

    return serialize(CustomerTransformer.transform(customer))
  }

  async index({ bouncer, serialize }: HttpContext) {
    await bouncer.with(CustomerPolicy).authorize('list')

    const customers = await this.listCustomersUseCase.handle()

    return serialize(CustomerTransformer.transform(customers))
  }

  async available({ bouncer, serialize }: HttpContext) {
    await bouncer.with(CustomerPolicy).authorize('listAvailable')

    const customers = await this.listAvailableCustomersUseCase.handle()

    return serialize(CustomerTransformer.transform(customers))
  }

  async show({ bouncer, params, serialize }: HttpContext) {
    await bouncer.with(CustomerPolicy).authorize('view')

    const customer = await this.getCustomerUseCase.handle(params.id)

    return serialize(CustomerTransformer.transform(customer))
  }

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(CustomerPolicy).authorize('update')

    const payload = await request.validateUsing(updateCustomerValidator)

    const customer = await this.updateCustomerUseCase.handle({ id: params.id, ...payload })

    return serialize(CustomerTransformer.transform(customer))
  }

  async archive({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(CustomerPolicy).authorize('archive')

    const payload = await request.validateUsing(archiveCustomerValidator)

    const customer = await this.archiveCustomerUseCase.handle({
      id: params.id,
      archivedByUserId: user.id,
      archivedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(CustomerTransformer.transform(customer))
  }

  async archiveMany({ auth, bouncer, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(CustomerPolicy).authorize('archive')

    const payload = await request.validateUsing(archiveCustomersValidator)
    const customers = await this.archiveCustomersUseCase.handle({
      ids: payload.ids,
      archivedByUserId: user.id,
      archivedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(CustomerTransformer.transform(customers))
  }

  async reactivate({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(CustomerPolicy).authorize('reactivate')

    const payload = await request.validateUsing(reactivateCustomerValidator)

    const customer = await this.reactivateCustomerUseCase.handle({
      id: params.id,
      reactivatedByUserId: user.id,
      reactivatedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(CustomerTransformer.transform(customer))
  }

  async reactivateMany({ auth, bouncer, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(CustomerPolicy).authorize('reactivate')

    const payload = await request.validateUsing(reactivateCustomersValidator)
    const customers = await this.reactivateCustomersUseCase.handle({
      ids: payload.ids,
      reactivatedByUserId: user.id,
      reactivatedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(CustomerTransformer.transform(customers))
  }
}
