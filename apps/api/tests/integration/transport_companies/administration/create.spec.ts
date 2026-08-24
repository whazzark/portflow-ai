import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { UserFactory } from '#database/factories/user_factory'
import TransportCompany from '#models/transport_company'

const VALID_CONTACT = {
  contactPhone: '+33 1 23 45 67 89',
  contactEmail: 'contact@example.test',
}

test.group('POST /api/v1/transport-companies', (group) => {
  // Cleaning up inline after the assertions leaks rows as soon as one of them fails, which then
  // poisons every later test reusing a name. Snapshot the table instead and drop the additions.
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

  test('creates an available company and returns the complete representation', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: 'Atlantique Transport Routier', ...VALID_CONTACT })

    response.assertStatus(201)
    const data = response.body().data
    assert.isString(data.id)
    assert.equal(data.name, 'Atlantique Transport Routier')
    assert.equal(data.status, 'AVAILABLE')
    assert.isNull(data.archivedAt)
    assert.isNull(data.archivedByUserId)
    assert.isNull(data.archivedBy)
    assert.isNull(data.archiveComment)
    assert.isNull(data.reactivatedAt)
    assert.isNull(data.reactivatedByUserId)
    assert.isNull(data.reactivatedBy)
    assert.isNull(data.reactivationComment)
    assert.equal(data.contactPhone, VALID_CONTACT.contactPhone)
    assert.equal(data.contactEmail, VALID_CONTACT.contactEmail)
    assert.isNotNull(data.createdAt)
    assert.equal(
      Math.floor(new Date(data.updatedAt).getTime() / 1000),
      Math.floor(new Date(data.createdAt).getTime() / 1000),
    )
  })

  test('accepts either administration role', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const response = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: 'Créé Par Org Admin', ...VALID_CONTACT })

    response.assertStatus(201)
    assert.equal(response.body().data.name, 'Créé Par Org Admin')
  })

  test('publishes the created company to both consultation collections', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const created = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: 'Baie Douarnenez Transports', ...VALID_CONTACT })

    created.assertStatus(201)
    const id = created.body().data.id

    const all = await client.get('/api/v1/transport-companies').loginAs(admin)
    const available = await client.get('/api/v1/transport-companies/available').loginAs(admin)

    all.assertStatus(200)
    available.assertStatus(200)
    assert.isTrue(all.body().data.some((item: { id: string }) => item.id === id))
    assert.isTrue(available.body().data.some((item: { id: string }) => item.id === id))

    const names = available.body().data.map((item: { name: string }) => item.name)
    assert.deepEqual(
      names,
      [...names].sort((left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0)),
    )
  })

  test('trims surrounding whitespace while preserving the submitted casing', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: '  Grand OUEST Camions  ', ...VALID_CONTACT })

    response.assertStatus(201)
    assert.equal(response.body().data.name, 'Grand OUEST Camions')
  })

  test('leaves an existing company untouched when a new one is created', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const existing = await TransportCompanyFactory.merge({ name: 'Armor Fret Services' }).create()

    const response = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: 'Rade Brest Transports', ...VALID_CONTACT })

    response.assertStatus(201)
    await existing.refresh()
    assert.equal(existing.name, 'Armor Fret Services')
    assert.equal(existing.status, 'AVAILABLE')
  })

  test('rejects missing, blank, whitespace-only, and over-long names', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const before = await TransportCompany.query().count('* as total')

    const missing = await client.post('/api/v1/transport-companies').loginAs(admin).json({})
    const blank = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: '', ...VALID_CONTACT })
    const whitespace = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: '   ', ...VALID_CONTACT })
    const tooLong = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: 'A'.repeat(256), ...VALID_CONTACT })

    missing.assertStatus(422)
    blank.assertStatus(422)
    whitespace.assertStatus(422)
    tooLong.assertStatus(422)
    assert.equal(missing.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(blank.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(whitespace.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(tooLong.body().error.code, 'E_VALIDATION_ERROR')
    assert.isTrue(
      whitespace.body().error.details.some((detail: { field: string }) => detail.field === 'name'),
    )

    const after = await TransportCompany.query().count('* as total')
    assert.deepEqual(totalOf(after), totalOf(before))
  })

  test('accepts a name at exactly the maximum length', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: 'M'.repeat(255), ...VALID_CONTACT })

    response.assertStatus(201)
    assert.equal(response.body().data.name.length, 255)
  })

  test('rejects a duplicate name without naming the colliding company', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const existing = await TransportCompanyFactory.merge({ name: 'Loire Vrac Transport' }).create()

    const response = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: '  loire VRAC transport  ', ...VALID_CONTACT })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRANSPORT_COMPANY_NAME_CONFLICT')
    assert.notInclude(response.body().error.message, existing.name)
  })

  test('rejects a name reserved by an archived company', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    await TransportCompanyFactory.apply('archived').merge({ name: 'Noroît Logistique' }).create()

    const response = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: 'Noroît Logistique', ...VALID_CONTACT })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRANSPORT_COMPANY_NAME_CONFLICT')
  })

  test('creates exactly one company when the same name is submitted twice', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

    const first = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: 'Presqu île Transports', ...VALID_CONTACT })
    const second = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: '  presqu île TRANSPORTS  ', ...VALID_CONTACT })

    first.assertStatus(201)
    second.assertStatus(409)
    assert.equal(second.body().error.code, 'E_TRANSPORT_COMPANY_NAME_CONFLICT')

    const matches = await TransportCompany.query().whereILike('name', 'presqu île transports')
    assert.lengthOf(matches, 1)
  })

  test('creates a company that owns no truck', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .post('/api/v1/transport-companies')
      .loginAs(admin)
      .json({ name: 'Sans Camion Transports', ...VALID_CONTACT })

    response.assertStatus(201)
    const id = response.body().data.id

    const trucks = await client.get('/api/v1/trucks').loginAs(admin)
    trucks.assertStatus(200)
    assert.isFalse(
      trucks
        .body()
        .data.some((truck: { transportCompanyId: string }) => truck.transportCompanyId === id),
    )

    const available = await client.get('/api/v1/transport-companies/available').loginAs(admin)
    assert.isTrue(available.body().data.some((company: { id: string }) => company.id === id))
  })

  test('rejects unauthenticated creation', async ({ assert, client }) => {
    const before = await TransportCompany.query().count('* as total')
    const response = await client
      .post('/api/v1/transport-companies')
      .json({ name: 'Anonyme Transports' })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')

    const after = await TransportCompany.query().count('* as total')
    assert.deepEqual(totalOf(after), totalOf(before))
  })

  test('rejects creation by a user whose access is not active', async ({ assert, client }) => {
    const suspended = await UserFactory.apply('deactivated')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .create()
    const before = await TransportCompany.query().count('* as total')

    const response = await client
      .post('/api/v1/transport-companies')
      .loginAs(suspended)
      .json({ name: 'Suspendu Transports' })

    assert.notEqual(response.status(), 201)
    assert.isTrue(response.status() === 401 || response.status() === 403)

    const after = await TransportCompany.query().count('* as total')
    assert.deepEqual(totalOf(after), totalOf(before))
  })

  test('rejects creation by an active non-administrator', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const before = await TransportCompany.query().count('* as total')

    const response = await client
      .post('/api/v1/transport-companies')
      .loginAs(observer)
      .json({ name: 'Observateur Transports' })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')

    const after = await TransportCompany.query().count('* as total')
    assert.deepEqual(totalOf(after), totalOf(before))
  })

  test('refuses an unauthorized request before validating its body', async ({ client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const response = await client
      .post('/api/v1/transport-companies')
      .loginAs(observer)
      .json({ name: '   ' })

    // Authorization runs before validation, so a blank body from a non-administrator is a 403
    // rather than a 422: an unauthorized caller learns nothing about validity.
    response.assertStatus(403)
  })
})

function totalOf(rows: unknown[]) {
  return Number((rows[0] as { $extras: { total: string | number } }).$extras.total)
}
