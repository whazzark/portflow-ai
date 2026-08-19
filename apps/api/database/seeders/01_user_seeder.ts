import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { UserFactory } from '#database/factories/user_factory'
import { USER_FIXTURES } from '#database/fixtures/users'
import User from '#models/user'

export default class UserSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    for (const fixture of USER_FIXTURES) {
      const byId = await User.find(fixture.id)
      const byEmail = await User.query()
        .whereRaw('LOWER(email) = ?', [fixture.attributes.email.toLowerCase()])
        .first()
      if (byEmail && byEmail.id !== fixture.id) {
        throw new Error(
          `Fixture UUID conflict for user: ${fixture.attributes.email}. Run migration:fresh.`,
        )
      }
      const candidate = await UserFactory.apply(fixture.state)
        .merge({ id: fixture.id, ...fixture.attributes })
        .make()
      if (byId) {
        byId.merge(candidate.$attributes)
        await byId.save()
      } else {
        await candidate.save()
      }
    }
  }
}
