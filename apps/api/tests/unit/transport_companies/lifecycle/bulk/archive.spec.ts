import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import ArchiveTransportCompaniesUseCase from '#transport_companies/archive/archive_transport_companies_use_case'

test.group('ArchiveTransportCompaniesUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('archives every eligible company with one identical archival time, actor, and comment', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const companies = await TransportCompanyFactory.createMany(3)
    const archivedAt = DateTime.fromISO('2026-08-24T09:41:00.000+02:00')
    const useCase = await app.container.make(ArchiveTransportCompaniesUseCase)

    const result = await useCase.handle({
      ids: companies.map((company) => company.id),
      archivedByUserId: actor.id,
      archivedAt,
      comment: '  Contract review Q3  ',
    })

    assert.deepEqual(
      result.updatedCompanies.map((company) => company.id),
      companies.map((company) => company.id),
    )
    assert.isEmpty(result.blockedCompanies)
    for (const company of result.updatedCompanies) {
      assert.equal(company.archivedAt?.toISO(), archivedAt.toISO())
      assert.equal(company.archivedByUserId, actor.id)
      assert.equal(company.archiveComment, 'Contract review Q3')
    }
  })

  test('archives exactly the eligible companies in a mixed selection and reports the rest', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const eligible = await TransportCompanyFactory.create()
    const alreadyArchived = await TransportCompanyFactory.apply('archived').create()
    const blockedByTruck = await TransportCompanyFactory.create()
    await TruckFactory.merge({ transportCompanyId: blockedByTruck.id }).create()
    const unknownId = '00000000-0000-4000-8000-000000000000'
    const useCase = await app.container.make(ArchiveTransportCompaniesUseCase)

    const result = await useCase.handle({
      ids: [eligible.id, alreadyArchived.id, blockedByTruck.id, unknownId],
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
    })

    assert.deepEqual(
      result.updatedCompanies.map((company) => company.id),
      [eligible.id],
    )
    assert.deepEqual(
      result.blockedCompanies.map((blocker) => [blocker.id, blocker.reason]),
      [
        [alreadyArchived.id, 'ALREADY_ARCHIVED'],
        [blockedByTruck.id, 'HAS_AVAILABLE_TRUCKS'],
        [unknownId, 'NOT_FOUND'],
      ],
    )

    await alreadyArchived.refresh()
    assert.isNull(alreadyArchived.archiveComment)
    await blockedByTruck.refresh()
    assert.equal(blockedByTruck.status, 'AVAILABLE')
  })

  test('archives nothing when every company in the selection is blocked', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const alreadyArchived = await TransportCompanyFactory.apply('archived').create()
    const useCase = await app.container.make(ArchiveTransportCompaniesUseCase)

    const result = await useCase.handle({
      ids: [alreadyArchived.id],
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
    })

    assert.isEmpty(result.updatedCompanies)
    assert.deepEqual(
      result.blockedCompanies.map((blocker) => blocker.reason),
      ['ALREADY_ARCHIVED'],
    )
  })
})
