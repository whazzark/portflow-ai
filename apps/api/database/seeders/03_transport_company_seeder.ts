import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TRANSPORT_COMPANY_FIXTURES } from '#database/fixtures/transport_companies'
import TransportCompany from '#models/transport_company'

export default class TransportCompanySeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    for (const fixture of TRANSPORT_COMPANY_FIXTURES) {
      const byId = await TransportCompany.find(fixture.id)
      const matches = await TransportCompany.query()
        .whereRaw('LOWER(name) = ?', [fixture.attributes.name.toLowerCase()])
        .limit(2)
      if (matches.some((item) => item.id !== fixture.id)) {
        throw new Error(
          `Fixture UUID conflict for transport company: ${fixture.attributes.name}. Run migration:fresh.`,
        )
      }
      const factory =
        fixture.state === 'available'
          ? TransportCompanyFactory
          : TransportCompanyFactory.apply(fixture.state)
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
