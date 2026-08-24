import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import TransportCompany from '#models/transport_company'
import CreateTransportCompanyUseCase from '#transport_companies/create/create_transport_company_use_case'
import {
  assertValidContactEmail,
  assertValidContactPhone,
} from '#transport_companies/shared/normalize_transport_company_contact'
import TransportCompanyRepository from '#transport_companies/shared/repositories/transport_company_repository'
import {
  ArchivedTransportCompanyReadOnlyException,
  InvalidTransportCompanyContactEmailException,
  InvalidTransportCompanyContactPhoneException,
  TransportCompanyNotFoundException,
} from '#transport_companies/shared/transport_company_exceptions'
import UpdateTransportCompanyUseCase from '#transport_companies/update/update_transport_company_use_case'

test.group('assertValidContactPhone / assertValidContactEmail', () => {
  test('accepts international, national, and parenthesized notations, trimmed', ({ assert }) => {
    assert.equal(assertValidContactPhone('  +33 2 40 12 34 56  '), '+33 2 40 12 34 56')
    assert.equal(assertValidContactPhone('02.40.12.34.56'), '02.40.12.34.56')
    assert.equal(assertValidContactPhone('(02) 40-12-34-56'), '(02) 40-12-34-56')
  })

  test('rejects a phone value with too few digits, a bare separator, or a misplaced plus', ({
    assert,
  }) => {
    assert.throws(() => assertValidContactPhone('+'), InvalidTransportCompanyContactPhoneException)
    assert.throws(() => assertValidContactPhone('()'), InvalidTransportCompanyContactPhoneException)
    assert.throws(
      () => assertValidContactPhone('12345'),
      InvalidTransportCompanyContactPhoneException,
    )
    assert.throws(
      () => assertValidContactPhone('02 40 +33'),
      InvalidTransportCompanyContactPhoneException,
    )
    assert.throws(
      () => assertValidContactPhone('+33 (0)2 40 12 34 56 ext 12'),
      InvalidTransportCompanyContactPhoneException,
    )
  })

  test('rejects a phone value longer than 32 characters and accepts one at the limit', ({
    assert,
  }) => {
    // 32 characters, 20 digits (the digit ceiling): '+' + 19 digits + 11 spaces + 1 digit.
    const maxLength = `+${'1'.repeat(19)}${' '.repeat(11)}2`
    assert.equal(maxLength.length, 32)
    assert.equal(assertValidContactPhone(maxLength), maxLength)

    // 33 characters, still only 20 digits, so this fails on length alone.
    const overLength = `+${'1'.repeat(19)}${' '.repeat(12)}2`
    assert.equal(overLength.length, 33)
    assert.throws(
      () => assertValidContactPhone(overLength),
      InvalidTransportCompanyContactPhoneException,
    )
  })

  test('trims a valid email address and rejects a blank one', ({ assert }) => {
    // Email format validity (FR-009) is Vine's `.email()` rule at the HTTP boundary — proven by
    // the integration suite — matching how the sibling `name` field's format rules live only at
    // that boundary. This function only trims and enforces blank/length, same as `name`'s.
    assert.equal(assertValidContactEmail('  dispatch@example.test  '), 'dispatch@example.test')
    assert.throws(
      () => assertValidContactEmail('   '),
      InvalidTransportCompanyContactEmailException,
    )
  })

  test('rejects an email address longer than 255 characters and accepts one at the limit', ({
    assert,
  }) => {
    const localPart = 'a'.repeat(242)
    const maxLength = `${localPart}@example.test`
    assert.equal(maxLength.length, 255)
    assert.equal(assertValidContactEmail(maxLength), maxLength)

    assert.throws(
      () => assertValidContactEmail(`a${maxLength}`),
      InvalidTransportCompanyContactEmailException,
    )
  })
})

test.group('UpdateTransportCompanyUseCase — contact details', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(TransportCompanyRepository))

  test('records contact details on a company that had none', async ({ assert }) => {
    const company = await TransportCompanyFactory.apply('withoutContact').create()
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    const updated = await useCase.handle({
      id: company.id,
      name: company.name,
      contactPhone: '+33 2 40 12 34 56',
      contactEmail: 'dispatch@atlantique-transport.test',
    })

    assert.equal(updated.contactPhone, '+33 2 40 12 34 56')
    assert.equal(updated.contactEmail, 'dispatch@atlantique-transport.test')
  })

  test('replaces previously recorded contact details', async ({ assert }) => {
    const company = await TransportCompanyFactory.merge({
      contactPhone: '+33 1 11 11 11 11',
      contactEmail: 'old@example.test',
    }).create()
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    const updated = await useCase.handle({
      id: company.id,
      name: company.name,
      contactPhone: '+33 2 22 22 22 22',
      contactEmail: 'new@example.test',
    })

    assert.equal(updated.contactPhone, '+33 2 22 22 22 22')
    assert.equal(updated.contactEmail, 'new@example.test')
  })

  test('preserves identity, name, status, and lifecycle context when only contact details change', async ({
    assert,
  }) => {
    const company = await TransportCompanyFactory.apply('reactivated').create()
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    const updated = await useCase.handle({
      id: company.id,
      name: company.name,
      contactPhone: '+33 2 40 12 34 56',
      contactEmail: 'dispatch@atlantique-transport.test',
    })

    assert.equal(updated.id, company.id)
    assert.equal(updated.name, company.name)
    assert.equal(updated.status, 'AVAILABLE')
    assert.equal(
      Math.floor(updated.reactivatedAt?.toSeconds() ?? 0),
      Math.floor(company.reactivatedAt?.toSeconds() ?? 0),
    )
    assert.equal(updated.reactivationComment, company.reactivationComment)
    assert.isTrue(updated.updatedAt.toSeconds() >= company.updatedAt.toSeconds())
  })

  test('changing only the name preserves previously recorded contact details', async ({
    assert,
  }) => {
    const company = await TransportCompanyFactory.merge({
      contactPhone: '+33 2 40 12 34 56',
      contactEmail: 'dispatch@atlantique-transport.test',
    }).create()
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    const updated = await useCase.handle({
      id: company.id,
      name: 'Atlantique Transport Routier',
      contactPhone: company.contactPhone as string,
      contactEmail: company.contactEmail as string,
    })

    assert.equal(updated.name, 'Atlantique Transport Routier')
    assert.equal(updated.contactPhone, '+33 2 40 12 34 56')
    assert.equal(updated.contactEmail, 'dispatch@atlantique-transport.test')
  })

  test('trims surrounding whitespace before storing contact values', async ({ assert }) => {
    const company = await TransportCompanyFactory.create()
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    const updated = await useCase.handle({
      id: company.id,
      name: company.name,
      contactPhone: '  +33 2 40 12 34 56  ',
      contactEmail: '  dispatch@atlantique-transport.test  ',
    })

    assert.equal(updated.contactPhone, '+33 2 40 12 34 56')
    assert.equal(updated.contactEmail, 'dispatch@atlantique-transport.test')
  })

  test('resubmitting identical contact values succeeds', async ({ assert }) => {
    const company = await TransportCompanyFactory.merge({
      contactPhone: '+33 2 40 12 34 56',
      contactEmail: 'dispatch@atlantique-transport.test',
    }).create()
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    const updated = await useCase.handle({
      id: company.id,
      name: company.name,
      contactPhone: '+33 2 40 12 34 56',
      contactEmail: 'dispatch@atlantique-transport.test',
    })

    assert.equal(updated.contactPhone, '+33 2 40 12 34 56')
    assert.equal(updated.contactEmail, 'dispatch@atlantique-transport.test')
  })

  test('rejects contact changes on an archived company, submitted with valid contact values', async ({
    assert,
  }) => {
    const archived = await TransportCompanyFactory.apply('archived')
      .merge({
        contactPhone: '+33 2 40 12 34 56',
        contactEmail: 'dispatch@atlantique-transport.test',
      })
      .create()
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: archived.id,
          name: archived.name,
          contactPhone: '+33 9 99 99 99 99',
          contactEmail: 'attacker@example.test',
        }),
      ArchivedTransportCompanyReadOnlyException,
    )

    await archived.refresh()
    assert.equal(archived.contactPhone, '+33 2 40 12 34 56')
    assert.equal(archived.contactEmail, 'dispatch@atlantique-transport.test')
  })

  test('rejects contact changes on a company that does not exist', async ({ assert }) => {
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: '00000000-0000-4000-8000-000000000000',
          name: 'New name',
          contactPhone: '+33 9 99 99 99 99',
          contactEmail: 'attacker@example.test',
        }),
      TransportCompanyNotFoundException,
    )
  })

  test('refuses a contact change on a company archived after it was loaded', async ({ assert }) => {
    const company = await TransportCompanyFactory.merge({
      contactPhone: '+33 2 40 12 34 56',
      contactEmail: 'dispatch@atlantique-transport.test',
    }).create()
    // Simulate a concurrent archival that happened after the caller loaded the company but
    // before the update reaches the repository.
    company.status = 'ARCHIVED'
    company.archivedAt = DateTime.now()
    await company.save()
    const useCase = await app.container.make(UpdateTransportCompanyUseCase)

    await assert.rejects(
      () =>
        useCase.handle({
          id: company.id,
          name: company.name,
          contactPhone: '+33 9 99 99 99 99',
          contactEmail: 'attacker@example.test',
        }),
      ArchivedTransportCompanyReadOnlyException,
    )

    await company.refresh()
    assert.equal(company.contactPhone, '+33 2 40 12 34 56')
    assert.equal(company.contactEmail, 'dispatch@atlantique-transport.test')
  })
})

test.group('CreateTransportCompanyUseCase — contact details', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(TransportCompanyRepository))

  test('records trimmed contact details on the created company', async ({ assert }) => {
    const useCase = await app.container.make(CreateTransportCompanyUseCase)

    const created = await useCase.handle({
      name: 'Presqu île Fret',
      contactPhone: '  +33 2 40 12 34 56  ',
      contactEmail: '  dispatch@presquile-fret.test  ',
    })

    assert.equal(created.contactPhone, '+33 2 40 12 34 56')
    assert.equal(created.contactEmail, 'dispatch@presquile-fret.test')
  })

  test('persists a created company that satisfies the contact-details check constraint', async ({
    assert,
  }) => {
    const useCase = await app.container.make(CreateTransportCompanyUseCase)

    const created = await useCase.handle({
      name: 'Golfe Morbihan Transports',
      contactPhone: '+33 2 97 12 34 56',
      contactEmail: 'dispatch@golfe-morbihan.test',
    })

    const persisted = await TransportCompany.find(created.id)
    assert.isNotNull(persisted)
    assert.equal(persisted?.contactPhone, '+33 2 97 12 34 56')
    assert.equal(persisted?.contactEmail, 'dispatch@golfe-morbihan.test')
  })
})
