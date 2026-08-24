import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { DischargeFactory } from '#database/factories/discharge_factory'
import { DischargeTruckAssignmentFactory } from '#database/factories/discharge_truck_assignment_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import ArchiveTransportCompanyUseCase from '#transport_companies/archive/archive_transport_company_use_case'
import {
  TransportCompanyAlreadyArchivedException,
  TransportCompanyHasAvailableTrucksException,
  TransportCompanyNotFoundException,
} from '#transport_companies/shared/transport_company_exceptions'

// biome-ignore lint/security/noSecrets: test group name, not a secret
test.group('ArchiveTransportCompanyUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('archives an available company that provides no truck', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.create()
    const archivedAt = DateTime.fromISO('2026-08-24T09:41:00.000+02:00')
    const useCase = await app.container.make(ArchiveTransportCompanyUseCase)

    const archived = await useCase.handle({
      id: company.id,
      archivedByUserId: actor.id,
      archivedAt,
      comment: 'Provider no longer serves the site',
    })

    assert.equal(archived.id, company.id)
    assert.equal(archived.name, company.name)
    assert.equal(
      Math.floor(archived.createdAt.toSeconds()),
      Math.floor(company.createdAt.toSeconds()),
    )
    assert.equal(archived.status, 'ARCHIVED')
    assert.equal(archived.archivedAt?.toISO(), archivedAt.toISO())
    assert.equal(archived.archivedByUserId, actor.id)
    assert.equal(archived.archiveComment, 'Provider no longer serves the site')
    assert.equal(archived.updatedAt.toISO(), archived.archivedAt?.toISO())
  })

  test('archives a company whose trucks are all archived', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.create()
    await TruckFactory.apply('archived').merge({ transportCompanyId: company.id }).create()
    const useCase = await app.container.make(ArchiveTransportCompanyUseCase)

    const archived = await useCase.handle({
      id: company.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
    })

    assert.equal(archived.status, 'ARCHIVED')
  })

  test('preserves the reactivation context of a previously reactivated company', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.apply('reactivated').create()
    const useCase = await app.container.make(ArchiveTransportCompanyUseCase)

    const archived = await useCase.handle({
      id: company.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
    })

    assert.equal(
      Math.floor(archived.reactivatedAt?.toSeconds() ?? 0),
      Math.floor(company.reactivatedAt?.toSeconds() ?? 0),
    )
    assert.equal(archived.reactivatedByUserId, company.reactivatedByUserId)
    assert.equal(archived.reactivationComment, company.reactivationComment)
  })

  test('stores a null, empty, or whitespace-only comment as null', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const useCase = await app.container.make(ArchiveTransportCompanyUseCase)

    for (const comment of [undefined, null, '', '   ']) {
      const company = await TransportCompanyFactory.create()
      const archived = await useCase.handle({
        id: company.id,
        archivedByUserId: actor.id,
        archivedAt: DateTime.now(),
        comment,
      })

      assert.isNull(archived.archiveComment)
    }
  })

  test('trims surrounding whitespace before storing the comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.create()
    const useCase = await app.container.make(ArchiveTransportCompanyUseCase)

    const archived = await useCase.handle({
      id: company.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: '  Provider no longer serves the site  ',
    })

    assert.equal(archived.archiveComment, 'Provider no longer serves the site')
  })

  test('refuses a company that still provides an available truck', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({ transportCompanyId: company.id }).create()
    const useCase = await app.container.make(ArchiveTransportCompanyUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: company.id,
          archivedByUserId: actor.id,
          archivedAt: DateTime.now(),
        }),
      TransportCompanyHasAvailableTrucksException,
    )

    await company.refresh()
    assert.equal(company.status, 'AVAILABLE')
    await truck.refresh()
    assert.equal(truck.status, 'AVAILABLE')
  })

  test('refuses a company whose available truck is reserved by a planned or active discharge', async ({
    assert,
  }) => {
    for (const status of ['PLANNED', 'ACTIVE'] as const) {
      const actor = await UserFactory.apply('active').create()
      const company = await TransportCompanyFactory.create()
      const truck = await TruckFactory.merge({ transportCompanyId: company.id }).create()
      const dock = await DockFactory.create()
      const discharge = await DischargeFactory.merge({ dockId: dock.id, status }).create()
      await DischargeTruckAssignmentFactory.merge({
        dischargeId: discharge.id,
        truckId: truck.id,
      }).create()
      const useCase = await app.container.make(ArchiveTransportCompanyUseCase)

      await assert.rejects(
        () =>
          useCase.handle({
            id: company.id,
            archivedByUserId: actor.id,
            archivedAt: DateTime.now(),
          }),
        TransportCompanyHasAvailableTrucksException,
      )
    }
  })

  test('refuses a company that does not exist', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const useCase = await app.container.make(ArchiveTransportCompanyUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: '00000000-0000-4000-8000-000000000000',
          archivedByUserId: actor.id,
          archivedAt: DateTime.now(),
        }),
      TransportCompanyNotFoundException,
    )
  })

  test('refuses an already archived company and preserves its archival context', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const archived = await TransportCompanyFactory.apply('archived').create()
    const useCase = await app.container.make(ArchiveTransportCompanyUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: archived.id,
          archivedByUserId: actor.id,
          archivedAt: DateTime.now(),
          comment: 'A different comment',
        }),
      TransportCompanyAlreadyArchivedException,
    )

    await archived.refresh()
    assert.isNull(archived.archiveComment)
  })

  test('reports an already archived company as such even when it also provides an available truck', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const archived = await TransportCompanyFactory.apply('archived').create()
    await TruckFactory.merge({ transportCompanyId: archived.id }).create()
    const useCase = await app.container.make(ArchiveTransportCompanyUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: archived.id,
          archivedByUserId: actor.id,
          archivedAt: DateTime.now(),
        }),
      TransportCompanyAlreadyArchivedException,
    )
  })
})
