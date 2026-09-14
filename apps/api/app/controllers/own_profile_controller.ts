import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

import { presentedRememberedConnectionId } from '#auth/shared/presented_remembered_connection'
import ChangeOwnPasswordUseCase from '#users/profile/change_own_password_use_case'
import { changeOwnPasswordValidator } from '#users/profile/change_own_password_validator'
import UpdateOwnProfileUseCase from '#users/profile/update_own_profile_use_case'
import { updateOwnProfileValidator } from '#users/profile/update_own_profile_validator'
import UserTransformer from '#users/shared/transformers/user_transformer'
import UserPolicy from '#users/shared/user_policy'

@inject()
export default class OwnProfileController {
  constructor(
    private updateOwnProfileUseCase: UpdateOwnProfileUseCase,
    private changeOwnPasswordUseCase: ChangeOwnPasswordUseCase,
  ) {}

  /**
   * The target is the session's user and nothing in the request can name another. The answer is the
   * session projection `auth.me` returns, so the client refreshes its session from it directly — and
   * a viewer who may not consult the access history is not handed it here either.
   */
  async update({ auth, bouncer, request, serialize }: HttpContext) {
    // biome-ignore lint/security/noSecrets: policy ability name, not a secret
    await bouncer.with(UserPolicy).authorize('updateOwnProfile')

    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(updateOwnProfileValidator)

    const updated = await this.updateOwnProfileUseCase.handle({
      user,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      currentPassword: payload.currentPassword,
      changedAt: DateTime.now(),
    })

    return serialize(UserTransformer.transform(updated))
  }

  /**
   * The password the user chooses for themselves. Answers the session projection, like the identity
   * update above: the client refreshes its session from it, and nothing about the credential travels
   * back.
   */
  async changePassword({ auth, bouncer, request, serialize }: HttpContext) {
    // biome-ignore lint/security/noSecrets: policy ability name, not a secret
    await bouncer.with(UserPolicy).authorize('updateOwnProfile')

    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(changeOwnPasswordValidator)

    const updated = await this.changeOwnPasswordUseCase.handle({
      user,
      currentPassword: payload.currentPassword,
      password: payload.password,
      keptRememberedConnectionId: await presentedRememberedConnectionId(request),
      changedAt: DateTime.now(),
    })

    return serialize(UserTransformer.transform(updated))
  }
}
