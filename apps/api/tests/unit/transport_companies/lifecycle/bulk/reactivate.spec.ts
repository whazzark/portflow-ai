import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import ReactivateTransportCompaniesUseCase from '#transport_companies/reactivate/reactivate_transport_companies_use_case'

test.group('ReactivateTransportCompaniesUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('reactivates every archived company with one identical reactivation time, actor, and comment', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const companies = await TransportCompanyFactory.apply('archived').createMany(3)
    const reactivatedAt = DateTime.fromISO('2026-08-24T09:41:00.000+02:00')
    const useCase = await app.container.make(ReactivateTransportCompaniesUseCase)

    const result = await useCase.handle({
      ids: companies.map((company) => company.id),
      reactivatedByUserId: actor.id,
      reactivatedAt,
      comment: '  Post-review restoration  ',
    })

    assert.deepEqual(
      result.updatedCompanies.map((company) => company.id),
      companies.map((company) => company.id),
    )
    assert.isEmpty(result.blockedCompanies)
    for (const company of result.updatedCompanies) {
      assert.equal(company.reactivatedAt?.toISO(), reactivatedAt.toISO())
      assert.equal(company.reactivatedByUserId, actor.id)
      assert.equal(company.reactivationComment, 'Post-review restoration')
    }
  })

  test('reactivates exactly the archived companies in a mixed selection and reports the rest', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const eligible = await TransportCompanyFactory.apply('archived').create()
    const alreadyAvailable = await TransportCompanyFactory.create()
    const unknownId = '00000000-0000-4000-8000-000000000000'
    const useCase = await app.container.make(ReactivateTransportCompaniesUseCase)

    const result = await useCase.handle({
      ids: [eligible.id, alreadyAvailable.id, unknownId],
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
    })

    assert.deepEqual(
      result.updatedCompanies.map((company) => company.id),
      [eligible.id],
    )
    assert.deepEqual(
      result.blockedCompanies.map((blocker) => [blocker.id, blocker.reason]),
      [
        [alreadyAvailable.id, 'ALREADY_AVAILABLE'],
        [unknownId, 'NOT_FOUND'],
      ],
    )

    await alreadyAvailable.refresh()
    assert.notEqual(alreadyAvailable.reactivationComment, 'Post-review restoration')
  })

  test('reactivates nothing when every company in the selection is blocked', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const alreadyAvailable = await TransportCompanyFactory.create()
    const useCase = await app.container.make(ReactivateTransportCompaniesUseCase)

    const result = await useCase.handle({
      ids: [alreadyAvailable.id],
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
    })

    assert.isEmpty(result.updatedCompanies)
    assert.deepEqual(
      result.blockedCompanies.map((blocker) => blocker.reason),
      ['ALREADY_AVAILABLE'],
    )
  })

  test('reactivates an archived company that provides an available truck: it is never blocked', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const company = await TransportCompanyFactory.apply('archived').create()
    await TruckFactory.merge({ transportCompanyId: company.id }).create()
    const useCase = await app.container.make(ReactivateTransportCompaniesUseCase)

    const result = await useCase.handle({
      ids: [company.id],
      reactivatedByUserId: actor.id,
      reactivatedAt: DateTime.now(),
    })

    assert.deepEqual(
      result.updatedCompanies.map((updated) => updated.id),
      [company.id],
    )
    assert.isEmpty(result.blockedCompanies)
  })
})
