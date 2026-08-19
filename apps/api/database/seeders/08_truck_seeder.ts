import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { TruckFactory } from '#database/factories/truck_factory'
import { TRUCK_FIXTURES } from '#database/fixtures/trucks'
import TransportCompany from '#models/transport_company'
import Truck from '#models/truck'

export default class TruckSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    for (const fixture of TRUCK_FIXTURES) {
      if (!(await TransportCompany.find(fixture.attributes.transportCompanyId))) {
        throw new Error(
          `Fixture transport company not found for truck: ${fixture.attributes.registration}`,
        )
      }
      const byId = await Truck.find(fixture.id)
      const byRegistration = await Truck.query()
        // biome-ignore lint/security/noSecrets: SQL lookup expression, not a secret
        .whereRaw('LOWER(registration) = ?', [fixture.attributes.registration.toLowerCase()])
        .first()
      if (byRegistration && byRegistration.id !== fixture.id) {
        throw new Error(
          `Fixture UUID conflict for truck: ${fixture.attributes.registration}. Run migration:fresh.`,
        )
      }
      const factory =
        fixture.state === 'available' ? TruckFactory : TruckFactory.apply(fixture.state)
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
