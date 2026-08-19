import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'
import { WEIGHING_AREA_FIXTURES } from '#database/fixtures/weighing_areas'
import WeighingArea from '#models/weighing_area'

export default class WeighingAreaSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    for (const fixture of WEIGHING_AREA_FIXTURES) {
      const byId = await WeighingArea.find(fixture.id)
      const byName = await WeighingArea.query()
        .whereRaw('LOWER(name) = ?', [fixture.attributes.name.toLowerCase()])
        .first()
      if (byName && byName.id !== fixture.id) {
        throw new Error(
          `Fixture UUID conflict for weighing area: ${fixture.attributes.name}. Run migration:fresh.`,
        )
      }
      const factory =
        fixture.state === 'available'
          ? WeighingAreaFactory
          : WeighingAreaFactory.apply(fixture.state)
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
