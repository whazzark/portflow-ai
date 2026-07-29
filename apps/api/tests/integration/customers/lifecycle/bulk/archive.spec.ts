import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker, {
  type SiteReferenceUsageInput,
} from '#site_references/shared/site_reference_usage_checker'

class FirstReferenceUsedChecker extends SiteReferenceUsageChecker {
  findUsedByPlannedOrActiveDischarge(input: SiteReferenceUsageInput) {
    return Promise.resolve(new Set(input.referenceIds.slice(0, 1)))
  }
}

test.group('POST /api/v1/customers/archive', (group) => {
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated requests', async ({ assert, client }) => {
    const customer = await CustomerFactory.create()
    const response = await client.post('/api/v1/customers/archive').json({ ids: [customer.id] })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects duplicate IDs', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const customer = await CustomerFactory.create()
    const response = await client
      .post('/api/v1/customers/archive')
      .loginAs(admin)
      .json({ ids: [customer.id, customer.id] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('rejects duplicate IDs with different casing before changing state', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const customer = await CustomerFactory.create()
    const response = await client
      .post('/api/v1/customers/archive')
      .loginAs(admin)
      .json({ ids: [customer.id, customer.id.toUpperCase()] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    await customer.refresh()
    assert.equal(customer.status, 'AVAILABLE')
  })

  test('rejects an overlong comment before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const customer = await CustomerFactory.create()
    const response = await client
      .post('/api/v1/customers/archive')
      .loginAs(admin)
      .json({ ids: [customer.id], comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    await customer.refresh()
    assert.equal(customer.status, 'AVAILABLE')
  })

  test('archives multiple customers with a shared comment', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const first = await CustomerFactory.create()
    const second = await CustomerFactory.create()
    const response = await client
      .post('/api/v1/customers/archive')
      .loginAs(admin)
      .json({
        ids: [first.id, second.id],
        comment: '  Portfolio cleanup  ',
      })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedCustomers.map((customer: { id: string }) => customer.id),
      [first.id, second.id],
    )
    assert.isTrue(
      response
        .body()
        .data.updatedCustomers.every(
          (customer: { status: string; archiveComment: string }) =>
            customer.status === 'ARCHIVED' && customer.archiveComment === 'Portfolio cleanup',
        ),
    )
  })

  test('reports already archived customers separately', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const available = await CustomerFactory.create()
    const archived = await CustomerFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/customers/archive')
      .loginAs(admin)
      .json({ ids: [available.id, archived.id] })

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.updatedCustomers.map((customer: { id: string }) => customer.id),
      [available.id],
    )
    assert.deepEqual(
      response
        .body()
        .data.blockedCustomers.map((customer: { id: string; reason: string }) => [
          customer.id,
          customer.reason,
        ]),
      [[archived.id, 'ALREADY_ARCHIVED']],
    )
  })

  test('preserves request order across in-use, missing, and already archived blockers', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const used = await CustomerFactory.create()
    const archived = await CustomerFactory.apply('archived').create()
    const missingId = '00000000-0000-4000-8000-000000000000'
    app.container.swap(SiteReferenceUsageChecker, () =>
      app.container.make(FirstReferenceUsedChecker),
    )

    const response = await client
      .post('/api/v1/customers/archive')
      .loginAs(admin)
      .json({ ids: [used.id, missingId, archived.id] })

    response.assertStatus(200)
    assert.deepEqual(
      response
        .body()
        .data.blockedCustomers.map((customer: { id: string; reason: string }) => [
          customer.id,
          customer.reason,
        ]),
      [
        [used.id, 'IN_USE'],
        [missingId, 'NOT_FOUND'],
        [archived.id, 'ALREADY_ARCHIVED'],
      ],
    )
  })

  test('rejects non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const customer = await CustomerFactory.create()
    const response = await client
      .post('/api/v1/customers/archive')
      .loginAs(observer)
      .json({ ids: [customer.id] })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })
})
