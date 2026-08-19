import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DockFactory } from '#database/factories/dock_factory'
import { DOCK_FIXTURES } from '#database/fixtures/docks'
import Dock from '#models/dock'

export default class DockSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    for (const fixture of DOCK_FIXTURES) {
      const byId = await Dock.find(fixture.id)
      const byName = await Dock.query()
        .whereRaw('LOWER(name) = ?', [fixture.attributes.name.toLowerCase()])
        .first()
      if (byName && byName.id !== fixture.id) {
        throw new Error(
          `Fixture UUID conflict for dock: ${fixture.attributes.name}. Run migration:fresh.`,
        )
      }
      const factory = fixture.state === 'available' ? DockFactory : DockFactory.apply(fixture.state)
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
