import { DbRememberMeTokensProvider } from '@adonisjs/auth/session'
import type { LucidModel } from '@adonisjs/lucid/types/model'

export default class FixedExpiryRememberMeTokensProvider<
  TokenableModel extends LucidModel,
> extends DbRememberMeTokensProvider<TokenableModel> {
  async recycle(
    user: InstanceType<TokenableModel>,
    identifier: string | number | BigInt,
    _expiresIn: string | number,
  ) {
    const token = await this.find(user, identifier)

    if (!token) {
      return super.recycle(user, identifier, _expiresIn)
    }

    const remainingLifetimeInSeconds = Math.max(
      0,
      Math.floor((token.expiresAt.getTime() - Date.now()) / 1000),
    )

    await this.delete(user, identifier)

    return this.create(user, remainingLifetimeInSeconds)
  }
}
