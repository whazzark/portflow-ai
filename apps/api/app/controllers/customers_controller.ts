import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ListAvailableCustomersUseCase from '#customers/available/list_available_customers_use_case'
import CreateCustomerUseCase from '#customers/create/create_customer_use_case'
import ListCustomersUseCase from '#customers/list/list_customers_use_case'
import { CustomerUpdateFieldsException } from '#customers/shared/customer_exceptions'
import CustomerPolicy from '#customers/shared/customer_policy'
import CustomerTransformer from '#customers/shared/customer_transformer'
import {
  createCustomerValidator,
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

    if (payload.code === undefined && payload.companyName === undefined) {
      throw new CustomerUpdateFieldsException()
    }

    const customer = await this.updateCustomerUseCase.handle({ id: params.id, ...payload })

    return serialize(CustomerTransformer.transform(customer))
  }
}
