import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { InvalidSiteReferenceNameException } from '#site_references/shared/site_reference_exceptions'
import CreateTruckUseCase from '#trucks/create/create_truck_use_case'
import {
  DuplicateTruckRegistrationException,
  InvalidTransportCompanyException,
} from '#trucks/shared/truck_exceptions'

test.group('CreateTruckUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('creates an available truck with a trimmed registration and no lifecycle context', async ({
    assert,
  }) => {
    const company = await TransportCompanyFactory.create()
    const useCase = await app.container.make(CreateTruckUseCase)

    const truck = await useCase.handle({
      registration: '  AB-123-CD ',
      vehicleModel: 'Volvo FMX',
      capacityTonnes: 32.5,
      transportCompanyId: company.id,
    })

    assert.equal(truck.registration, 'AB-123-CD')
    assert.equal(truck.vehicleModel, 'Volvo FMX')
    assert.equal(truck.transportCompanyId, company.id)
    assert.equal(truck.status, 'AVAILABLE')
    assert.isNull(truck.archivedAt)
    assert.isNull(truck.reactivatedAt)
  })

  test('creates a truck without a vehicle model when it is omitted', async ({ assert }) => {
    const company = await TransportCompanyFactory.create()
    const useCase = await app.container.make(CreateTruckUseCase)

    const truck = await useCase.handle({
      registration: 'NO-MODEL-01',
      vehicleModel: null,
      capacityTonnes: 10,
      transportCompanyId: company.id,
    })

    assert.isNull(truck.vehicleModel)
  })

  test('rejects a missing or archived transport company', async ({ assert }) => {
    const archivedCompany = await TransportCompanyFactory.apply('archived').create()
    const useCase = await app.container.make(CreateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          registration: 'ARCHIVED-CO-01',
          vehicleModel: null,
          capacityTonnes: 10,
          transportCompanyId: archivedCompany.id,
        }),
      InvalidTransportCompanyException,
    )
    await assert.rejects(
      () =>
        useCase.handle({
          registration: 'MISSING-CO-01',
          vehicleModel: null,
          capacityTonnes: 10,
          transportCompanyId: '00000000-0000-4000-8000-000000000000',
        }),
      InvalidTransportCompanyException,
    )
  })

  test('rejects a registration that duplicates an existing truck by case and whitespace', async ({
    assert,
  }) => {
    const company = await TransportCompanyFactory.create()
    await TruckFactory.merge({ registration: 'DUP-001', transportCompanyId: company.id }).create()
    const useCase = await app.container.make(CreateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          registration: '  dup-001 ',
          vehicleModel: null,
          capacityTonnes: 10,
          transportCompanyId: company.id,
        }),
      DuplicateTruckRegistrationException,
    )
  })

  test('rejects a blank vehicle model when one is provided', async ({ assert }) => {
    const company = await TransportCompanyFactory.create()
    const useCase = await app.container.make(CreateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          registration: 'BLANK-MODEL-01',
          vehicleModel: '   ',
          capacityTonnes: 10,
          transportCompanyId: company.id,
        }),
      InvalidSiteReferenceNameException,
    )
  })

  test('rejects a blank registration', async ({ assert }) => {
    const company = await TransportCompanyFactory.create()
    const useCase = await app.container.make(CreateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          registration: '   ',
          vehicleModel: null,
          capacityTonnes: 10,
          transportCompanyId: company.id,
        }),
      InvalidSiteReferenceNameException,
    )
  })
})
