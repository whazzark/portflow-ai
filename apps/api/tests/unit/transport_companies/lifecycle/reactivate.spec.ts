import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import ReactivateTransportCompanyUseCase from '#transport_companies/reactivate/reactivate_transport_company_use_case'
import {
  TransportCompanyAlreadyAvailableException,
  TransportCompanyNotFoundException,
} from '#transport_companies/shared/transport_company_exceptions'

test.group('ReactivateTransportCompanyUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('reactivates an archived company and preserves its archival context', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const archiver = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.apply('archived')
      .merge({
        archivedByUserId: archiver.id,
        archiveComment: 'Provider no longer serves the site',
      })
      .create()
    const reactivatedAt = DateTime.fromISO('2026-08-24T09:41:00.000+02:00')
    const useCase = await app.container.make(ReactivateTransportCompanyUseCase)

    const reactivated = await useCase.handle({
      id: company.id,
      reactivatedByUserId: actor.id,
      reactivatedAt,
      comment: 'Framework contract renewed for the season',
    })

    assert.equal(reactivated.id, company.id)
    assert.equal(reactivated.name, company.name)
    assert.equal(
      Math.floor(reactivated.createdAt.toSeconds()),
      Math.floor(company.createdAt.toSeconds()),
    )
    assert.equal(reactivated.status, 'AVAILABLE')
    assert.equal(reactivated.reactivatedAt?.toISO(), reactivatedAt.toISO())
    assert.equal(reactivated.reactivatedByUserId, actor.id)
    assert.equal(reactivated.reactivationComment, 'Framework contract renewed for the season')
    assert.equal(reactivated.updatedAt.toISO(), reactivated.reactivatedAt?.toISO())

    // The archive triple is untouched.
    assert.equal(reactivated.archivedByUserId, archiver.id)
    assert.equal(reactivated.archiveComment, 'Provider no longer serves the site')
    assert.equal(
      Math.floor(reactivated.archivedAt?.toSeconds() ?? 0),
      Math.floor(company.archivedAt?.toSeconds() ?? 0),
    )
  })

  test('stores a null, empty, or whitespace-only comment as null', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const useCase = await app.container.make(ReactivateTransportCompanyUseCase)

    for (const comment of [undefined, null, '', '   ']) {
      const company = await TransportCompanyFactory.apply('archived').create()
      const reactivated = await useCase.handle({
        id: company.id,
        reactivatedByUserId: actor.id,
        reactivatedAt: DateTime.now(),
        comment,
      })

      assert.isNull(reactivated.reactivationComment)
    }
  })

  test('trims surrounding whitespace before storing the comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.apply('archived').create()
    const useCase = await app.container.make(ReactivateTransportCompanyUseCase)

    const reactivated = await useCase.handle({
      id: company.id,
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
      comment: '  Framework contract renewed for the season  ',
    })

    assert.equal(reactivated.reactivationComment, 'Framework contract renewed for the season')
  })

  test('replaces rather than merges a previous reactivation comment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.apply('reactivated')
      .merge({ reactivationComment: 'Contract renewed for the previous season' })
      .create()
    await company.merge({ status: 'ARCHIVED' }).save()
    const useCase = await app.container.make(ReactivateTransportCompanyUseCase)

    const reactivated = await useCase.handle({
      id: company.id,
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
    })

    assert.isNull(reactivated.reactivationComment)
  })

  test('reactivates a company that provides no truck', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.apply('archived').create()
    const useCase = await app.container.make(ReactivateTransportCompanyUseCase)

    const reactivated = await useCase.handle({
      id: company.id,
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
    })

    assert.equal(reactivated.status, 'AVAILABLE')
  })

  test('reactivates a company whose trucks are all archived, without changing them', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.apply('archived').create()
    const truck = await TruckFactory.apply('archived')
      .merge({ transportCompanyId: company.id })
      .create()
    const useCase = await app.container.make(ReactivateTransportCompanyUseCase)

    const reactivated = await useCase.handle({
      id: company.id,
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
    })

    assert.equal(reactivated.status, 'AVAILABLE')
    await truck.refresh()
    assert.equal(truck.status, 'ARCHIVED')
  })

  test('reactivates a company that provides an available truck: there is no truck-related refusal', async ({
    assert,
  }) => {
    // This state cannot be produced by archiving — the archival rule refuses it — so it is built
    // directly here. The point is that the reactivation path must not care how the row got there.
    const actor = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.apply('archived').create()
    const truck = await TruckFactory.merge({ transportCompanyId: company.id }).create()
    const useCase = await app.container.make(ReactivateTransportCompanyUseCase)

    const reactivated = await useCase.handle({
      id: company.id,
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
    })

    assert.equal(reactivated.status, 'AVAILABLE')
    await truck.refresh()
    assert.equal(truck.status, 'AVAILABLE')
  })

  test('refuses a company that does not exist', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const useCase = await app.container.make(ReactivateTransportCompanyUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: '00000000-0000-4000-8000-000000000000',
          reactivatedByUserId: actor.id,
          reactivatedAt: DateTime.now(),
        }),
      TransportCompanyNotFoundException,
    )
  })

  test('refuses an already available company and preserves its existing reactivation context', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const available = await TransportCompanyFactory.apply('reactivated').create()
    const useCase = await app.container.make(ReactivateTransportCompanyUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: available.id,
          reactivatedByUserId: actor.id,
          reactivatedAt: DateTime.now(),
          comment: 'A different comment',
        }),
      TransportCompanyAlreadyAvailableException,
    )

    await available.refresh()
    assert.notEqual(available.reactivationComment, 'A different comment')
  })
})
