import { errors } from '@adonisjs/auth'
import { DbRememberMeTokensProvider } from '@adonisjs/auth/session'
import type { LucidModel } from '@adonisjs/lucid/types/model'

export default class FixedExpiryRememberMeTokensProvider<
  TokenableModel extends LucidModel,
> extends DbRememberMeTokensProvider<TokenableModel> {
  async recycle(
    user: InstanceType<TokenableModel>,
    identifier: string | number | bigint,
    _expiresIn: string | number,
  ) {
    const token = await this.find(user, identifier)

    if (!token) {
      throw new errors.E_UNAUTHORIZED_ACCESS('Invalid or expired user session', {
        guardDriverName: 'session',
      })
    }

    const remainingLifetimeInSeconds = Math.max(
      0,
      Math.floor((token.expiresAt.getTime() - Date.now()) / 1000),
    )

    const db = await this.getDb()
    const deletedCount = await db
      .query()
      .from(this.table)
      .where({ id: identifier, tokenable_id: user.$primaryKeyValue, hash: token.hash })
      .del()
      .exec()

    if (Number(deletedCount) !== 1) {
      throw new errors.E_UNAUTHORIZED_ACCESS('Invalid or expired user session', {
        guardDriverName: 'session',
      })
    }

    return this.create(user, remainingLifetimeInSeconds)
  }
}
