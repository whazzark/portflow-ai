import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import TransportCompany from '#models/transport_company'
import { InvalidSiteReferenceNameException } from '#site_references/shared/site_reference_exceptions'
import CreateTransportCompanyUseCase from '#transport_companies/create/create_transport_company_use_case'
import TransportCompanyRepository from '#transport_companies/shared/repositories/transport_company_repository'
import { DuplicateTransportCompanyNameException } from '#transport_companies/shared/transport_company_exceptions'

const VALID_CONTACT = {
  contactPhone: '+33 1 23 45 67 89',
  contactEmail: 'contact@example.test',
}

test.group('CreateTransportCompanyUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(TransportCompanyRepository))

  test('creates an available company with a fresh identity and no lifecycle context', async ({
    assert,
  }) => {
    const existing = await TransportCompanyFactory.merge({ name: 'Armor Fret Services' }).create()
    const useCase = await app.container.make(CreateTransportCompanyUseCase)

    const created = await useCase.handle({
      name: 'Atlantique Transport Routier',
      ...VALID_CONTACT,
    })

    assert.isString(created.id)
    assert.notEqual(created.id, existing.id)
    assert.equal(created.name, 'Atlantique Transport Routier')
    assert.equal(created.status, 'AVAILABLE')
    assert.isNull(created.archivedAt)
    assert.isNull(created.archivedByUserId)
    assert.isNull(created.archiveComment)
    assert.isNull(created.reactivatedAt)
    assert.isNull(created.reactivatedByUserId)
    assert.isNull(created.reactivationComment)
    assert.equal(created.contactPhone, VALID_CONTACT.contactPhone)
    assert.equal(created.contactEmail, VALID_CONTACT.contactEmail)
    assert.isTrue(created.createdAt.isValid)
    // Both stamps are assigned separately by the model, so they can land a few milliseconds
    // apart; what matters is that creation left no later update behind.
    assert.closeTo(created.updatedAt.toMillis(), created.createdAt.toMillis(), 1000)
  })

  test('persists the created company so it is retrievable by identity and name', async ({
    assert,
  }) => {
    const useCase = await app.container.make(CreateTransportCompanyUseCase)

    const created = await useCase.handle({ name: 'Estuaire Bennes', ...VALID_CONTACT })

    const persisted = await TransportCompany.find(created.id)
    assert.isNotNull(persisted)
    assert.equal(persisted?.name, 'Estuaire Bennes')
    assert.equal(persisted?.status, 'AVAILABLE')
  })

  test('trims surrounding whitespace while preserving the submitted casing', async ({ assert }) => {
    const useCase = await app.container.make(CreateTransportCompanyUseCase)

    const created = await useCase.handle({
      name: '  Grand OUEST Camions  ',
      ...VALID_CONTACT,
    })

    assert.equal(created.name, 'Grand OUEST Camions')
  })

  test('accepts a name at exactly the maximum length', async ({ assert }) => {
    const useCase = await app.container.make(CreateTransportCompanyUseCase)

    const created = await useCase.handle({ name: 'A'.repeat(255), ...VALID_CONTACT })

    assert.equal(created.name.length, 255)
  })

  test('rejects a blank name before reaching the repository', async ({ assert }) => {
    const useCase = await app.container.make(CreateTransportCompanyUseCase)

    await assert.rejects(
      () => useCase.handle({ name: '   ', ...VALID_CONTACT }),
      InvalidSiteReferenceNameException,
    )
    assert.equal(await countCompanies(), 0)
  })

  test('rejects a name longer than the maximum length', async ({ assert }) => {
    const useCase = await app.container.make(CreateTransportCompanyUseCase)

    await assert.rejects(
      () => useCase.handle({ name: 'A'.repeat(256), ...VALID_CONTACT }),
      InvalidSiteReferenceNameException,
    )
    assert.equal(await countCompanies(), 0)
  })

  test('rejects a name already used by an available company', async ({ assert }) => {
    await TransportCompanyFactory.merge({ name: 'Loire Vrac Transport' }).create()
    const useCase = await app.container.make(CreateTransportCompanyUseCase)

    await assert.rejects(
      () => useCase.handle({ name: 'Loire Vrac Transport', ...VALID_CONTACT }),
      DuplicateTransportCompanyNameException,
    )
    assert.equal(await countCompanies(), 1)
  })

  test('rejects a name already used by an archived company', async ({ assert }) => {
    await TransportCompanyFactory.apply('archived').merge({ name: 'Noroît Logistique' }).create()
    const useCase = await app.container.make(CreateTransportCompanyUseCase)

    await assert.rejects(
      () => useCase.handle({ name: 'Noroît Logistique', ...VALID_CONTACT }),
      DuplicateTransportCompanyNameException,
    )
    assert.equal(await countCompanies(), 1)
  })

  test('rejects a name differing only by letter case or surrounding whitespace', async ({
    assert,
  }) => {
    await TransportCompanyFactory.merge({ name: 'Atlantique Transport Routier' }).create()
    const useCase = await app.container.make(CreateTransportCompanyUseCase)

    await assert.rejects(
      () => useCase.handle({ name: '  atlantique TRANSPORT routier  ', ...VALID_CONTACT }),
      DuplicateTransportCompanyNameException,
    )
    assert.equal(await countCompanies(), 1)
  })

  test('creates exactly one company when the same name is submitted twice', async ({ assert }) => {
    const useCase = await app.container.make(CreateTransportCompanyUseCase)

    await useCase.handle({ name: 'Estuaire Bennes', ...VALID_CONTACT })
    await assert.rejects(
      () => useCase.handle({ name: 'estuaire bennes', ...VALID_CONTACT }),
      DuplicateTransportCompanyNameException,
    )

    assert.equal(await countCompanies(), 1)
  })
})

async function countCompanies() {
  const [row] = await TransportCompany.query().count('* as total')

  return Number((row as unknown as { $extras: { total: string | number } }).$extras.total)
}
