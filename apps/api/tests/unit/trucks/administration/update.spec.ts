import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import Truck from '#models/truck'
import { InvalidSiteReferenceNameException } from '#site_references/shared/site_reference_exceptions'
import LucidTruckRepository from '#trucks/shared/repositories/lucid_truck_repository'
import TruckRepository from '#trucks/shared/repositories/truck_repository'
import {
  ArchivedTruckReadOnlyException,
  DuplicateTruckRegistrationException,
  InvalidTransportCompanyException,
  SuspendedTruckReadOnlyException,
  TruckNotFoundException,
  TruckTransportCompanyLockedException,
} from '#trucks/shared/truck_exceptions'
import UpdateTruckUseCase from '#trucks/update/update_truck_use_case'
import { createPersistedTruckUsageScenario } from '../../../support/persisted_truck_usage.js'

// biome-ignore lint/security/noSecrets: test group title, not a secret
test.group('UpdateTruckUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('updates registration, vehicle model, and capacity while preserving identity and lifecycle context', async ({
    assert,
  }) => {
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.apply('reactivated')
      .merge({ transportCompanyId: company.id, registration: 'ORIGINAL-01' })
      .create()
    const useCase = await app.container.make(UpdateTruckUseCase)

    const updated = await useCase.handle({
      id: truck.id,
      registration: '  UPDATED-01 ',
      vehicleModel: 'Volvo FH16',
      capacityTonnes: 38.5,
      transportCompanyId: company.id,
    })

    assert.equal(updated.id, truck.id)
    assert.equal(updated.registration, 'UPDATED-01')
    assert.equal(updated.vehicleModel, 'Volvo FH16')
    assert.equal(updated.capacityTonnes.toNumber(), 38.5)
    assert.equal(updated.transportCompanyId, company.id)
    assert.equal(updated.status, 'AVAILABLE')
    assert.equal(
      Math.floor(updated.archivedAt?.toSeconds() ?? 0),
      Math.floor(truck.archivedAt?.toSeconds() ?? 0),
    )
    assert.equal(
      Math.floor(updated.reactivatedAt?.toSeconds() ?? 0),
      Math.floor(truck.reactivatedAt?.toSeconds() ?? 0),
    )
    assert.equal(updated.reactivatedByUserId, truck.reactivatedByUserId)
    assert.equal(updated.reactivationComment, truck.reactivationComment)
    assert.isTrue(updated.updatedAt.isValid)
    assert.isTrue(updated.updatedAt.toSeconds() >= truck.updatedAt.toSeconds())
  })

  test('clears the vehicle model when null is submitted', async ({ assert }) => {
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({
      transportCompanyId: company.id,
      vehicleModel: 'Renault Kerax',
    }).create()
    const useCase = await app.container.make(UpdateTruckUseCase)

    const updated = await useCase.handle({
      id: truck.id,
      registration: truck.registration,
      vehicleModel: null,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: company.id,
    })

    assert.isNull(updated.vehicleModel)
  })

  test('accepts resubmitting all four current values as a no-op success', async ({ assert }) => {
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({
      transportCompanyId: company.id,
      registration: 'NO-OP-01',
      vehicleModel: 'Scania R450',
    }).create()
    const useCase = await app.container.make(UpdateTruckUseCase)

    const updated = await useCase.handle({
      id: truck.id,
      registration: truck.registration,
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: company.id,
    })

    assert.equal(updated.registration, 'NO-OP-01')
    assert.equal(updated.vehicleModel, 'Scania R450')
    assert.isTrue(updated.updatedAt.toSeconds() >= truck.updatedAt.toSeconds())
  })

  test('reassigns an uncommitted truck to another available transport company', async ({
    assert,
  }) => {
    const originalCompany = await TransportCompanyFactory.create()
    const newCompany = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({ transportCompanyId: originalCompany.id }).create()
    const useCase = await app.container.make(UpdateTruckUseCase)

    const updated = await useCase.handle({
      id: truck.id,
      registration: truck.registration,
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: newCompany.id,
    })

    assert.equal(updated.transportCompanyId, newCompany.id)
  })

  test('refuses a provider change while the truck is committed to a planned discharge', async ({
    assert,
  }) => {
    const newCompany = await TransportCompanyFactory.create()
    const { truck } = await createPersistedTruckUsageScenario({ status: 'PLANNED' })
    const useCase = await app.container.make(UpdateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: truck.id,
          registration: truck.registration,
          vehicleModel: truck.vehicleModel,
          capacityTonnes: truck.capacityTonnes.toNumber(),
          transportCompanyId: newCompany.id,
        }),
      TruckTransportCompanyLockedException,
    )

    const reloaded = await truck.refresh()
    assert.equal(reloaded.transportCompanyId, truck.transportCompanyId)
  })

  test('refuses a provider change while the truck is committed to an active discharge', async ({
    assert,
  }) => {
    const newCompany = await TransportCompanyFactory.create()
    const { truck } = await createPersistedTruckUsageScenario({ status: 'ACTIVE' })
    const useCase = await app.container.make(UpdateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: truck.id,
          registration: truck.registration,
          vehicleModel: truck.vehicleModel,
          capacityTonnes: truck.capacityTonnes.toNumber(),
          transportCompanyId: newCompany.id,
        }),
      TruckTransportCompanyLockedException,
    )
  })

  test('allows a provider change when the only assignment is released', async ({ assert }) => {
    const newCompany = await TransportCompanyFactory.create()
    const { truck } = await createPersistedTruckUsageScenario({
      status: 'ACTIVE',
      released: true,
    })
    const useCase = await app.container.make(UpdateTruckUseCase)

    const updated = await useCase.handle({
      id: truck.id,
      registration: truck.registration,
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: newCompany.id,
    })

    assert.equal(updated.transportCompanyId, newCompany.id)
  })

  test('allows a provider change when the only assignment belongs to a closed discharge', async ({
    assert,
  }) => {
    const newCompany = await TransportCompanyFactory.create()
    const { truck } = await createPersistedTruckUsageScenario({ status: 'CLOSED' })
    const useCase = await app.container.make(UpdateTruckUseCase)

    const updated = await useCase.handle({
      id: truck.id,
      registration: truck.registration,
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: newCompany.id,
    })

    assert.equal(updated.transportCompanyId, newCompany.id)
  })

  test('allows correcting a committed truck as long as its current company is resubmitted', async ({
    assert,
  }) => {
    const { truck } = await createPersistedTruckUsageScenario({ status: 'ACTIVE' })
    const useCase = await app.container.make(UpdateTruckUseCase)

    const updated = await useCase.handle({
      id: truck.id,
      registration: 'STILL-COMMITTED-01',
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: truck.transportCompanyId,
    })

    assert.equal(updated.registration, 'STILL-COMMITTED-01')
    assert.equal(updated.transportCompanyId, truck.transportCompanyId)
  })

  test('rejects an archived or missing transport company when reassigning', async ({ assert }) => {
    const archivedCompany = await TransportCompanyFactory.apply('archived').create()
    const truck = await TruckFactory.create()
    const useCase = await app.container.make(UpdateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: truck.id,
          registration: truck.registration,
          vehicleModel: truck.vehicleModel,
          capacityTonnes: truck.capacityTonnes.toNumber(),
          transportCompanyId: archivedCompany.id,
        }),
      InvalidTransportCompanyException,
    )
    await assert.rejects(
      () =>
        useCase.handle({
          id: truck.id,
          registration: truck.registration,
          vehicleModel: truck.vehicleModel,
          capacityTonnes: truck.capacityTonnes.toNumber(),
          transportCompanyId: '00000000-0000-4000-8000-000000000000',
        }),
      InvalidTransportCompanyException,
    )
  })

  test('reports the discharge commitment even when the submitted company is also archived', async ({
    assert,
  }) => {
    const archivedCompany = await TransportCompanyFactory.apply('archived').create()
    const { truck } = await createPersistedTruckUsageScenario({ status: 'ACTIVE' })
    const useCase = await app.container.make(UpdateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: truck.id,
          registration: truck.registration,
          vehicleModel: truck.vehicleModel,
          capacityTonnes: truck.capacityTonnes.toNumber(),
          transportCompanyId: archivedCompany.id,
        }),
      TruckTransportCompanyLockedException,
    )
  })

  test('rejects a registration that duplicates another truck by case and whitespace', async ({
    assert,
  }) => {
    const company = await TransportCompanyFactory.create()
    await TruckFactory.merge({
      registration: 'DUP-UPD-01',
      transportCompanyId: company.id,
    }).create()
    const truck = await TruckFactory.merge({ transportCompanyId: company.id }).create()
    const useCase = await app.container.make(UpdateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: truck.id,
          registration: '  dup-upd-01 ',
          vehicleModel: truck.vehicleModel,
          capacityTonnes: truck.capacityTonnes.toNumber(),
          transportCompanyId: company.id,
        }),
      DuplicateTruckRegistrationException,
    )
  })

  test('accepts resubmitting the truck own current registration as a success', async ({
    assert,
  }) => {
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({
      registration: 'SELF-DUP-01',
      transportCompanyId: company.id,
    }).create()
    const useCase = await app.container.make(UpdateTruckUseCase)

    const updated = await useCase.handle({
      id: truck.id,
      registration: 'SELF-DUP-01',
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: company.id,
    })

    assert.equal(updated.registration, 'SELF-DUP-01')
  })

  test('trims registration and vehicle model while preserving display casing', async ({
    assert,
  }) => {
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({ transportCompanyId: company.id }).create()
    const useCase = await app.container.make(UpdateTruckUseCase)

    const updated = await useCase.handle({
      id: truck.id,
      registration: '  Ab-99-Cd  ',
      vehicleModel: '  Volvo FMX  ',
      capacityTonnes: truck.capacityTonnes.toNumber(),
      transportCompanyId: company.id,
    })

    assert.equal(updated.registration, 'Ab-99-Cd')
    assert.equal(updated.vehicleModel, 'Volvo FMX')
  })

  test('rejects a blank registration and a blank vehicle model', async ({ assert }) => {
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({ transportCompanyId: company.id }).create()
    const useCase = await app.container.make(UpdateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: truck.id,
          registration: '   ',
          vehicleModel: truck.vehicleModel,
          capacityTonnes: truck.capacityTonnes.toNumber(),
          transportCompanyId: company.id,
        }),
      InvalidSiteReferenceNameException,
    )
    await assert.rejects(
      () =>
        useCase.handle({
          id: truck.id,
          registration: truck.registration,
          vehicleModel: '   ',
          capacityTonnes: truck.capacityTonnes.toNumber(),
          transportCompanyId: company.id,
        }),
      InvalidSiteReferenceNameException,
    )
  })

  test('rejects updating an archived truck as read-only', async ({ assert }) => {
    const archived = await TruckFactory.apply('archived').create()
    const useCase = await app.container.make(UpdateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: archived.id,
          registration: 'ARCHIVED-UPD-01',
          vehicleModel: archived.vehicleModel,
          capacityTonnes: archived.capacityTonnes.toNumber(),
          transportCompanyId: archived.transportCompanyId,
        }),
      ArchivedTruckReadOnlyException,
    )
  })

  test('rejects updating a suspended truck with its own reason, not the archived one', async ({
    assert,
  }) => {
    const suspended = await TruckFactory.apply('suspended').create()
    const useCase = await app.container.make(UpdateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: suspended.id,
          registration: 'SUSPENDED-UPD-01',
          vehicleModel: suspended.vehicleModel,
          capacityTonnes: suspended.capacityTonnes.toNumber(),
          transportCompanyId: suspended.transportCompanyId,
        }),
      SuspendedTruckReadOnlyException,
    )

    await suspended.refresh()
    assert.equal(suspended.status, 'SUSPENDED')
  })

  test('rejects updating a truck that does not exist', async ({ assert }) => {
    const company = await TransportCompanyFactory.create()
    const useCase = await app.container.make(UpdateTruckUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: '00000000-0000-4000-8000-000000000000',
          registration: 'GHOST-01',
          vehicleModel: null,
          capacityTonnes: 10,
          transportCompanyId: company.id,
        }),
      TruckNotFoundException,
    )
  })
})

test.group('UpdateTruckUseCase transport company concurrency', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(TruckRepository))

  test('redoes the reassignment decision when another request changes the company between read and write', async ({
    assert,
  }) => {
    const companyA = await TransportCompanyFactory.create()
    const companyB = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({ transportCompanyId: companyA.id }).create()
    const lucidRepository = await app.container.make(LucidTruckRepository)
    let raceInjected = false

    app.container.swap(
      TruckRepository,
      () =>
        ({
          list: (...args: Parameters<TruckRepository['list']>) => lucidRepository.list(...args),
          listAvailable: (...args: Parameters<TruckRepository['listAvailable']>) =>
            lucidRepository.listAvailable(...args),
          create: (...args: Parameters<TruckRepository['create']>) =>
            lucidRepository.create(...args),
          updateAvailable: (...args: Parameters<TruckRepository['updateAvailable']>) =>
            lucidRepository.updateAvailable(...args),
          findById: async (id: string) => {
            const found = await lucidRepository.findById(id)

            if (found?.id === truck.id && !raceInjected) {
              raceInjected = true
              // Simulate another admin's legitimate reassignment landing in the window between
              // this read and the write the use case is about to attempt.
              await Truck.query().where('id', truck.id).update({ transportCompanyId: companyB.id })
            }

            return found
          },
        }) as unknown as TruckRepository,
    )

    const useCase = await app.container.make(UpdateTruckUseCase)
    const updated = await useCase.handle({
      id: truck.id,
      registration: 'RACE-REASSIGN-01',
      vehicleModel: truck.vehicleModel,
      capacityTonnes: truck.capacityTonnes.toNumber(),
      // The admin's form still shows company A: this looks like a no-op to them, but the truck
      // was concurrently moved to company B, so submitting A is actually a genuine reassignment
      // back to A that must be re-validated, not a stale write that silently reverts company B.
      transportCompanyId: companyA.id,
    })

    assert.isTrue(raceInjected)
    assert.equal(updated.transportCompanyId, companyA.id)
    assert.equal(updated.registration, 'RACE-REASSIGN-01')
  })
})
