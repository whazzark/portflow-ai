import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { UserFactory } from '#database/factories/user_factory'
import TransportCompany from '#models/transport_company'

test.group('PATCH /api/v1/transport-companies/:id — contact details', () => {
  test('records contact details on a company that had none, for both administration roles', async ({
    assert,
    client,
  }) => {
    for (const role of ['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN'] as const) {
      const admin = await UserFactory.apply('active').merge({ role }).create()
      const company = await TransportCompanyFactory.apply('withoutContact').create()

      const response = await client
        .patch(`/api/v1/transport-companies/${company.id}`)
        .loginAs(admin)
        .json({
          name: company.name,
          contactPhone: '+33 2 40 12 34 56',
          contactEmail: 'dispatch@atlantique-transport.test',
        })

      response.assertStatus(200)
      const data = response.body().data
      assert.equal(data.contactPhone, '+33 2 40 12 34 56')
      assert.equal(data.contactEmail, 'dispatch@atlantique-transport.test')
    }
  })

  test('replaces previously recorded contact details while preserving name, identity, and lifecycle context', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.apply('reactivated')
      .merge({ contactPhone: '+33 1 11 11 11 11', contactEmail: 'old@example.test' })
      .create()

    const response = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({
        name: company.name,
        contactPhone: '+33 2 22 22 22 22',
        contactEmail: 'new@example.test',
      })

    response.assertStatus(200)
    const data = response.body().data
    assert.equal(data.id, company.id)
    assert.equal(data.name, company.name)
    assert.equal(data.status, 'AVAILABLE')
    assert.equal(data.contactPhone, '+33 2 22 22 22 22')
    assert.equal(data.contactEmail, 'new@example.test')
    assert.equal(data.reactivationComment, company.reactivationComment)
  })

  test('changing only the name preserves the recorded contact details', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.merge({
      name: 'Bretagne Colis Express',
      contactPhone: '+33 2 40 12 34 56',
      contactEmail: 'dispatch@atlantique-transport.test',
    }).create()

    const response = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({
        name: 'Bretagne Colis Renommé',
        contactPhone: company.contactPhone,
        contactEmail: company.contactEmail,
      })

    response.assertStatus(200)
    const data = response.body().data
    assert.equal(data.name, 'Bretagne Colis Renommé')
    assert.equal(data.contactPhone, '+33 2 40 12 34 56')
    assert.equal(data.contactEmail, 'dispatch@atlantique-transport.test')
  })

  test('rejects malformed, blank, and over-long contact values, reporting every offending field at once', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.merge({
      contactPhone: '+33 2 40 12 34 56',
      contactEmail: 'dispatch@atlantique-transport.test',
    }).create()

    const malformedPhone = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({ name: company.name, contactPhone: 'not a phone', contactEmail: company.contactEmail })
    const blankPhone = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({ name: company.name, contactPhone: '   ', contactEmail: company.contactEmail })
    const malformedEmail = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({
        name: company.name,
        contactPhone: company.contactPhone,
        contactEmail: 'not-an-email',
      })
    const overLongPhone = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({
        name: company.name,
        contactPhone: `+${'1'.repeat(32)}`,
        contactEmail: company.contactEmail,
      })
    const overLongEmail = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({
        name: company.name,
        contactPhone: company.contactPhone,
        contactEmail: `${'a'.repeat(250)}@example.test`,
      })
    const bothInvalid = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({ name: company.name, contactPhone: 'nope', contactEmail: 'nope' })

    for (const response of [
      malformedPhone,
      blankPhone,
      malformedEmail,
      overLongPhone,
      overLongEmail,
      bothInvalid,
    ]) {
      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    }
    const fields = bothInvalid.body().error.details.map((detail: { field: string }) => detail.field)
    assert.includeMembers(fields, ['contactPhone', 'contactEmail'])

    await company.refresh()
    assert.equal(company.contactPhone, '+33 2 40 12 34 56')
    assert.equal(company.contactEmail, 'dispatch@atlantique-transport.test')
  })

  test('accepts two different companies recording the same phone number and email address', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const first = await TransportCompanyFactory.apply('withoutContact').create()
    const second = await TransportCompanyFactory.apply('withoutContact').create()
    const shared = { contactPhone: '+33 2 40 99 99 99', contactEmail: 'shared@example.test' }

    const firstResponse = await client
      .patch(`/api/v1/transport-companies/${first.id}`)
      .loginAs(admin)
      .json({ name: first.name, ...shared })
    const secondResponse = await client
      .patch(`/api/v1/transport-companies/${second.id}`)
      .loginAs(admin)
      .json({ name: second.name, ...shared })

    firstResponse.assertStatus(200)
    secondResponse.assertStatus(200)
    assert.equal(firstResponse.body().data.contactPhone, shared.contactPhone)
    assert.equal(secondResponse.body().data.contactPhone, shared.contactPhone)
  })

  test('rejects unauthenticated and non-administrator contact updates', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const company = await TransportCompanyFactory.merge({
      contactPhone: '+33 2 40 12 34 56',
      contactEmail: 'dispatch@atlantique-transport.test',
    }).create()
    const payload = {
      name: company.name,
      contactPhone: '+33 9 99 99 99 99',
      contactEmail: 'attacker@example.test',
    }

    const unauthenticated = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .json(payload)
    const nonAdmin = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(observer)
      .json(payload)

    unauthenticated.assertStatus(401)
    assert.equal(unauthenticated.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    nonAdmin.assertStatus(403)
    assert.equal(nonAdmin.body().error.code, 'E_AUTHORIZATION_FAILURE')

    await company.refresh()
    assert.equal(company.contactPhone, '+33 2 40 12 34 56')
    assert.equal(company.contactEmail, 'dispatch@atlantique-transport.test')
  })

  test('refuses an unauthorized request before validating a malformed contact value', async ({
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const company = await TransportCompanyFactory.create()

    const response = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(observer)
      .json({ name: company.name, contactPhone: 'not a phone', contactEmail: 'not-an-email' })

    // Authorization runs before validation: an unauthorized caller learns nothing about validity.
    response.assertStatus(403)
  })

  test('rejects contact changes on an archived company and on one that does not exist', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const archived = await TransportCompanyFactory.apply('archived')
      .merge({
        contactPhone: '+33 2 40 12 34 56',
        contactEmail: 'dispatch@atlantique-transport.test',
      })
      .create()
    const payload = {
      name: 'New Name',
      contactPhone: '+33 9 99 99 99 99',
      contactEmail: 'attacker@example.test',
    }

    const archivedResponse = await client
      .patch(`/api/v1/transport-companies/${archived.id}`)
      .loginAs(admin)
      .json(payload)
    const notFoundResponse = await client
      .patch('/api/v1/transport-companies/00000000-0000-4000-8000-000000000000')
      .loginAs(admin)
      .json(payload)

    archivedResponse.assertStatus(409)
    assert.equal(archivedResponse.body().error.code, 'E_TRANSPORT_COMPANY_ARCHIVED')
    notFoundResponse.assertStatus(404)
    assert.equal(notFoundResponse.body().error.code, 'E_TRANSPORT_COMPANY_NOT_FOUND')

    await archived.refresh()
    assert.equal(archived.contactPhone, '+33 2 40 12 34 56')
    assert.equal(archived.contactEmail, 'dispatch@atlantique-transport.test')
  })
})

test.group('POST /api/v1/transport-companies — contact details', (group) => {
  // See the sibling create.spec.ts: snapshotting and restricting the teardown to newly added
  // rows avoids leaking a row across tests when an assertion fails mid-test.
  let preExistingIds: string[] = []

  group.each.setup(async () => {
    preExistingIds = (await TransportCompany.query().select('id')).map((company) => company.id)
  })

  group.each.teardown(async () => {
    const additions = TransportCompany.query()

    if (preExistingIds.length > 0) {
      additions.whereNotIn('id', preExistingIds)
    }

    await additions.delete()
  })

  test('creates a company with contact details recorded, immediately visible in both collections', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    const response = await client.post('/api/v1/transport-companies').loginAs(admin).json({
      name: 'Golfe Morbihan Transports',
      contactPhone: '+33 2 97 12 34 56',
      contactEmail: 'dispatch@golfe-morbihan.test',
    })

    response.assertStatus(201)
    const data = response.body().data
    assert.equal(data.contactPhone, '+33 2 97 12 34 56')
    assert.equal(data.contactEmail, 'dispatch@golfe-morbihan.test')

    const available = await client.get('/api/v1/transport-companies/available').loginAs(admin)
    const listed = available.body().data.find((company: { id: string }) => company.id === data.id)
    assert.equal(listed.contactPhone, '+33 2 97 12 34 56')
    assert.equal(listed.contactEmail, 'dispatch@golfe-morbihan.test')
  })

  test('rejects creation missing either contact field, creating nothing', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const before = await TransportCompany.query().count('* as total')

    const missingPhone = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: 'Rade Lorient Fret', contactEmail: 'dispatch@rade-lorient.test' })
    const missingEmail = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: 'Baie Audierne Transports', contactPhone: '+33 2 98 12 34 56' })

    missingPhone.assertStatus(422)
    missingEmail.assertStatus(422)
    assert.equal(missingPhone.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(missingEmail.body().error.code, 'E_VALIDATION_ERROR')

    const after = await TransportCompany.query().count('* as total')
    assert.deepEqual(
      Number((before[0] as unknown as { $extras: { total: string | number } }).$extras.total),
      Number((after[0] as unknown as { $extras: { total: string | number } }).$extras.total),
    )
  })

  test('rejects malformed and over-long contact values, creating nothing', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const before = await TransportCompany.query().count('* as total')

    const malformedPhone = await client.post('/api/v1/transport-companies').loginAs(admin).json({
      name: 'Anse Douarnenez Fret',
      contactPhone: 'not a phone',
      contactEmail: 'dispatch@anse-douarnenez.test',
    })
    const malformedEmail = await client.post('/api/v1/transport-companies').loginAs(admin).json({
      name: 'Baie Concarneau Transports',
      contactPhone: '+33 2 98 55 66 77',
      contactEmail: 'not-an-email',
    })
    const overLongPhone = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({
        name: 'Rade Brest Colis',
        contactPhone: `+${'1'.repeat(32)}`,
        contactEmail: 'dispatch@rade-brest.test',
      })
    const overLongEmail = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({
        name: 'Golfe Gascogne Fret',
        contactPhone: '+33 2 40 11 22 33',
        contactEmail: `${'a'.repeat(250)}@example.test`,
      })

    for (const response of [malformedPhone, malformedEmail, overLongPhone, overLongEmail]) {
      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    }

    const after = await TransportCompany.query().count('* as total')
    assert.deepEqual(
      Number((before[0] as unknown as { $extras: { total: string | number } }).$extras.total),
      Number((after[0] as unknown as { $extras: { total: string | number } }).$extras.total),
    )
  })

  test('rejects unauthenticated and non-administrator creation, creating nothing', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const before = await TransportCompany.query().count('* as total')
    const payload = {
      name: 'Anonyme Contact Transports',
      contactPhone: '+33 2 40 12 34 56',
      contactEmail: 'dispatch@anonyme.test',
    }

    const unauthenticated = await client.post('/api/v1/transport-companies').json(payload)
    const nonAdmin = await client
      .post('/api/v1/transport-companies')
      .loginAs(observer)
      .json(payload)

    unauthenticated.assertStatus(401)
    assert.equal(unauthenticated.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    nonAdmin.assertStatus(403)
    assert.equal(nonAdmin.body().error.code, 'E_AUTHORIZATION_FAILURE')

    const after = await TransportCompany.query().count('* as total')
    assert.deepEqual(
      Number((before[0] as unknown as { $extras: { total: string | number } }).$extras.total),
      Number((after[0] as unknown as { $extras: { total: string | number } }).$extras.total),
    )
  })

  test('refuses an unauthorized creation before validating a malformed contact value', async ({
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client
      .post('/api/v1/transport-companies')
      .loginAs(observer)
      .json({ name: 'Nouveau', contactPhone: 'not a phone', contactEmail: 'not-an-email' })

    response.assertStatus(403)
  })
})

test.group('transport_companies_contact_details_check', () => {
  test('rejects a row carrying exactly one of contact_phone and contact_email', async ({
    assert,
  }) => {
    // Bypasses the validator and the use case entirely to prove the invariant is enforced by the
    // database itself, not only by application code — the guarantee FR-004 actually depends on.
    await assert.rejects(() =>
      TransportCompanyFactory.merge({
        contactPhone: '+33 2 40 12 34 56',
        contactEmail: null,
      }).create(),
    )
    await assert.rejects(() =>
      TransportCompanyFactory.merge({
        contactPhone: null,
        contactEmail: 'dispatch@example.test',
      }).create(),
    )
  })
})
