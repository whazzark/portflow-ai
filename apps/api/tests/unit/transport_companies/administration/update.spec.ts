import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { InvalidSiteReferenceNameException } from '#site_references/shared/site_reference_exceptions'
import TransportCompanyRepository from '#transport_companies/shared/repositories/transport_company_repository'
import {
  ArchivedTransportCompanyReadOnlyException,
  DuplicateTransportCompanyNameException,
  TransportCompanyNotFoundException,
} from '#transport_companies/shared/transport_company_exceptions'
import UpdateTransportCompanyUseCase from '#transport_companies/update/update_transport_company_use_case'

const VALID_CONTACT = {
  contactPhone: '+33 1 23 45 67 89',
  contactEmail: 'contact@example.test',
}

test.group('UpdateTransportCompanyUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(TransportCompanyRepository))

  test('renames an available company while preserving its identity and lifecycle context', async ({
    assert,
  }) => {
    const company = await TransportCompanyFactory.apply('reactivated').create()
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    const updated = await useCase.handle({
      id: company.id,
      name: 'Atlantique Transport Routier',
      contactPhone: company.contactPhone as string,
      contactEmail: company.contactEmail as string,
    })

    assert.equal(updated.id, company.id)
    assert.equal(updated.name, 'Atlantique Transport Routier')
    assert.equal(updated.status, 'AVAILABLE')
    assert.equal(
      Math.floor(updated.archivedAt?.toSeconds() ?? 0),
      Math.floor(company.archivedAt?.toSeconds() ?? 0),
    )
    assert.equal(
      Math.floor(updated.reactivatedAt?.toSeconds() ?? 0),
      Math.floor(company.reactivatedAt?.toSeconds() ?? 0),
    )
    assert.equal(updated.reactivatedByUserId, company.reactivatedByUserId)
    assert.equal(updated.reactivationComment, company.reactivationComment)
    assert.equal(updated.contactPhone, company.contactPhone)
    assert.equal(updated.contactEmail, company.contactEmail)
    assert.isTrue(updated.updatedAt.isValid)
    assert.isTrue(updated.updatedAt.toSeconds() >= company.updatedAt.toSeconds())
  })

  test('accepts resubmitting the company own current name as a success', async ({ assert }) => {
    const company = await TransportCompanyFactory.merge({ name: 'Armor Fret Services' }).create()
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    const updated = await useCase.handle({
      id: company.id,
      name: 'Armor Fret Services',
      ...VALID_CONTACT,
    })

    assert.equal(updated.id, company.id)
    assert.equal(updated.name, 'Armor Fret Services')
  })

  test('trims surrounding whitespace before storing the name', async ({ assert }) => {
    const company = await TransportCompanyFactory.create()
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    const updated = await useCase.handle({
      id: company.id,
      name: '  Grand Ouest Camions  ',
      ...VALID_CONTACT,
    })

    assert.equal(updated.name, 'Grand Ouest Camions')
  })

  test('rejects a blank name before reaching the repository', async ({ assert }) => {
    const company = await TransportCompanyFactory.create()
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    await assert.rejects(
      () => useCase.handle({ id: company.id, name: '   ', ...VALID_CONTACT }),
      InvalidSiteReferenceNameException,
    )
  })

  test('rejects a name already used by another company, regardless of case or whitespace', async ({
    assert,
  }) => {
    await TransportCompanyFactory.merge({ name: 'Loire Vrac Transport' }).create()
    const company = await TransportCompanyFactory.create()
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    await assert.rejects(
      () => useCase.handle({ id: company.id, name: '  loire vrac transport  ', ...VALID_CONTACT }),
      DuplicateTransportCompanyNameException,
    )
  })

  test('rejects updating an archived company as read-only', async ({ assert }) => {
    const archived = await TransportCompanyFactory.apply('archived').create()
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    await assert.rejects(
      () => useCase.handle({ id: archived.id, name: 'New name', ...VALID_CONTACT }),
      ArchivedTransportCompanyReadOnlyException,
    )
  })

  test('rejects updating a company that does not exist', async ({ assert }) => {
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: '00000000-0000-4000-8000-000000000000',
          name: 'New name',
          ...VALID_CONTACT,
        }),
      TransportCompanyNotFoundException,
    )
  })
})
