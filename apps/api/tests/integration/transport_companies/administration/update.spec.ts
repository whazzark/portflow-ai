import { test } from '@japa/runner'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'

const VALID_CONTACT = {
  contactPhone: '+33 1 23 45 67 89',
  contactEmail: 'contact@example.test',
}

test.group('PATCH /api/v1/transport-companies/:id', () => {
  test('rejects unauthenticated updates', async ({ assert, client }) => {
    const company = await TransportCompanyFactory.create()
    const response = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .json({ name: 'Updated', ...VALID_CONTACT })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects updates for non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const company = await TransportCompanyFactory.create()
    const response = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(observer)
      .json({ name: 'Updated', ...VALID_CONTACT })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('renames an available company while preserving identity, lifecycle context, and contact details', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.apply('reactivated').create()
    const response = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({
        name: 'Atlantique Transport Routier',
        contactPhone: company.contactPhone,
        contactEmail: company.contactEmail,
      })

    response.assertStatus(200)
    const data = response.body().data
    assert.equal(data.id, company.id)
    assert.equal(data.name, 'Atlantique Transport Routier')
    assert.equal(data.status, 'AVAILABLE')
    assert.equal(
      Math.floor(new Date(data.reactivatedAt).getTime() / 1000),
      Math.floor(company.reactivatedAt?.toSeconds() ?? 0),
    )
    assert.equal(data.reactivationComment, company.reactivationComment)
    assert.equal(data.contactPhone, company.contactPhone)
    assert.equal(data.contactEmail, company.contactEmail)
  })

  test('accepts either administration role', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const company = await TransportCompanyFactory.create()
    const response = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({ name: 'Renamed By Org Admin', ...VALID_CONTACT })

    response.assertStatus(200)
    assert.equal(response.body().data.name, 'Renamed By Org Admin')
  })

  test('trims surrounding whitespace and accepts the company own current name', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.merge({ name: 'Estuaire Bennes' }).create()
    const trimmed = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({ name: '  Estuaire Vrac  ', ...VALID_CONTACT })

    trimmed.assertStatus(200)
    assert.equal(trimmed.body().data.name, 'Estuaire Vrac')

    const resubmitted = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({ name: 'Estuaire Vrac', ...VALID_CONTACT })

    resubmitted.assertStatus(200)
    assert.equal(resubmitted.body().data.name, 'Estuaire Vrac')
  })

  test('rejects missing, blank, whitespace-only, and over-long names', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.create()

    const empty = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({})
    const blank = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({ name: '   ', ...VALID_CONTACT })
    const tooLong = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({ name: 'A'.repeat(256), ...VALID_CONTACT })
    const maxLength = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({ name: 'A'.repeat(255), ...VALID_CONTACT })

    empty.assertStatus(422)
    blank.assertStatus(422)
    tooLong.assertStatus(422)
    maxLength.assertStatus(200)
    assert.equal(empty.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(blank.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(tooLong.body().error.code, 'E_VALIDATION_ERROR')

    const unchanged = await client.get('/api/v1/transport-companies').loginAs(admin).qs({})
    const stored = unchanged.body().data.find((item: { id: string }) => item.id === company.id)
    assert.equal(stored.name, 'A'.repeat(255))
  })

  test('rejects a name already used by another company, case-insensitively', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const existing = await TransportCompanyFactory.merge({ name: 'Noroît Logistique' }).create()
    const company = await TransportCompanyFactory.create()

    const response = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({ name: '  noroît logistique  ', ...VALID_CONTACT })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRANSPORT_COMPANY_NAME_CONFLICT')

    const list = await client.get('/api/v1/transport-companies').loginAs(admin).qs({})
    const untouched = list.body().data.find((item: { id: string }) => item.id === company.id)
    const untouchedExisting = list
      .body()
      .data.find((item: { id: string }) => item.id === existing.id)
    assert.notEqual(untouched.name, 'noroît logistique')
    assert.equal(untouchedExisting.name, 'Noroît Logistique')
  })

  test('rejects updating an archived company as read-only', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const archived = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .patch(`/api/v1/transport-companies/${archived.id}`)
      .loginAs(admin)
      .json({ name: 'New name', ...VALID_CONTACT })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_TRANSPORT_COMPANY_ARCHIVED')
  })

  test('rejects updating a company that does not exist', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const response = await client
      .patch('/api/v1/transport-companies/00000000-0000-4000-8000-000000000000')
      .loginAs(admin)
      .json({ name: 'New name', ...VALID_CONTACT })

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_TRANSPORT_COMPANY_NOT_FOUND')
  })

  test('refuses an unauthorized request before validating its body', async ({ client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const archived = await TransportCompanyFactory.apply('archived').create()
    const response = await client
      .patch(`/api/v1/transport-companies/${archived.id}`)
      .loginAs(observer)
      .json({ name: '   ' })

    response.assertStatus(403)
  })

  test('preserves a truck association across a rename', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({ transportCompanyId: company.id }).create()

    const response = await client
      .patch(`/api/v1/transport-companies/${company.id}`)
      .loginAs(admin)
      .json({ name: 'Renamed With Trucks', ...VALID_CONTACT })

    response.assertStatus(200)
    await truck.refresh()
    assert.equal(truck.transportCompanyId, company.id)
    await truck.delete()
  })
})
