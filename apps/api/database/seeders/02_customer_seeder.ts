import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { CustomerFactory } from '#database/factories/customer_factory'
import { CUSTOMER_FIXTURES } from '#database/fixtures/customers'
import Customer from '#models/customer'

export default class CustomerSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    for (const fixture of CUSTOMER_FIXTURES) {
      const byId = await Customer.find(fixture.id)
      const byCode = await Customer.query()
        .whereRaw('LOWER(code) = ?', [fixture.attributes.code.toLowerCase()])
        .first()
      if (byCode && byCode.id !== fixture.id) {
        throw new Error(
          `Fixture UUID conflict for customer: ${fixture.attributes.code}. Run migration:fresh.`,
        )
      }
      const factory =
        fixture.state === 'available' ? CustomerFactory : CustomerFactory.apply(fixture.state)
      const candidate = await factory.merge({ id: fixture.id, ...fixture.attributes }).make()
      if (byId) {
        byId.merge(candidate.$attributes)
        await byId.save()
      } else {
        await candidate.save()
      }
    }
  }
}
