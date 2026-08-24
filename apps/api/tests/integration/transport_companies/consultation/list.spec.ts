import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { UserFactory } from '#database/factories/user_factory'
import TransportCompany from '#models/transport_company'
import { USER_ROLES } from '#models/user'

test.group('GET /api/v1/transport-companies', (group) => {
  group.each.setup(async () => {
    await TransportCompany.query().delete()
  })

  test('rejects unauthenticated access', async ({ assert, client }) => {
    const response = await client.get('/api/v1/transport-companies')

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  for (const role of USER_ROLES) {
    test(`allows an active ${role} to browse all lifecycle states`, async ({ assert, client }) => {
      const user = await UserFactory.apply('active').merge({ role }).create()
      const available = await TransportCompanyFactory.merge({ name: `Available ${role}` }).create()
      const archived = await TransportCompanyFactory.apply('archived')
        .merge({ name: `Archived ${role}` })
        .create()

      const response = await client.get('/api/v1/transport-companies').loginAs(user)

      response.assertStatus(200)
      assert.includeMembers(
        response.body().data.map((company: { id: string }) => company.id),
        [available.id, archived.id],
      )
    })
  }

  test('rejects a non-active user without exposing records', async ({ assert, client }) => {
    const user = await UserFactory.apply('deactivated').create()
    await TransportCompanyFactory.create()

    const response = await client.get('/api/v1/transport-companies').loginAs(user)

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    assert.isUndefined(response.body().data)
  })

  test('orders by name and includes nullable lifecycle actor summaries', async ({
    assert,
    client,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const archivedAt = DateTime.fromISO('2026-07-20T14:32:11.000Z')
    const archived = await TransportCompanyFactory.apply('archived')
      .merge({ name: 'Atlantic Transport', archivedAt })
      .create()
    archived.archivedByUserId = actor.id
    archived.archiveComment = 'Provider no longer serves the site'
    await archived.save()
    const secondAvailable = await TransportCompanyFactory.merge({
      name: 'Atlantic Transport Extra',
    }).create()
    const third = await TransportCompanyFactory.merge({ name: 'Baltic Trucks' }).create()

    const response = await client.get('/api/v1/transport-companies').loginAs(actor)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.map((company: { id: string }) => company.id),
      [archived.id, secondAvailable.id, third.id],
    )
    const serialized = response
      .body()
      .data.find((company: { id: string }) => company.id === archived.id)
    assert.deepInclude(serialized, {
      archivedBy: { id: actor.id, firstName: actor.firstName, lastName: actor.lastName },
      archiveComment: 'Provider no longer serves the site',
    })
  })

  test('exposes contact details to an active observer, populated or null', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const withContact = await TransportCompanyFactory.merge({
      name: 'Atlantique Transport Routier',
      contactPhone: '+33 2 40 12 34 56',
      contactEmail: 'dispatch@atlantique-transport.test',
    }).create()
    const withoutContact = await TransportCompanyFactory.apply('withoutContact')
      .merge({ name: 'Noroît Logistique' })
      .create()

    const response = await client.get('/api/v1/transport-companies').loginAs(observer)

    response.assertStatus(200)
    const data = response.body().data
    const migrated = data.find((company: { id: string }) => company.id === withContact.id)
    const legacy = data.find((company: { id: string }) => company.id === withoutContact.id)
    assert.equal(migrated.contactPhone, '+33 2 40 12 34 56')
    assert.equal(migrated.contactEmail, 'dispatch@atlantique-transport.test')
    assert.isNull(legacy.contactPhone)
    assert.isNull(legacy.contactEmail)
  })

  test('returns an empty collection and reflects authoritative state on a later request', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').create()
    const empty = await client.get('/api/v1/transport-companies').loginAs(user)

    empty.assertStatus(200)
    assert.deepEqual(empty.body(), { data: [] })

    const company = await TransportCompanyFactory.create()
    company.status = 'ARCHIVED'
    company.archivedAt = DateTime.now()
    await company.save()

    const refreshed = await client.get('/api/v1/transport-companies').loginAs(user)

    assert.equal(refreshed.body().data[0].status, 'ARCHIVED')
  })
})
