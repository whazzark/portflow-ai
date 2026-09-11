import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import DeactivateUserUseCase from '#users/deactivate/deactivate_user_use_case'
import { deactivateUserValidator } from '#users/deactivate/deactivate_user_validator'
import InviteUserUseCase from '#users/invite/invite_user_use_case'
import { inviteUserValidator } from '#users/invite/invite_user_validator'
import ListUsersUseCase from '#users/list/list_users_use_case'
import UserTransformer from '#users/shared/transformers/user_transformer'
import UserPolicy from '#users/shared/user_policy'

@inject()
export default class UsersController {
  constructor(
    private listUsersUseCase: ListUsersUseCase,
    private inviteUserUseCase: InviteUserUseCase,
    private deactivateUserUseCase: DeactivateUserUseCase,
  ) {}

  /**
   * The activation link travels in this response and nowhere else: it is the only moment the secret
   * is readable, which is why the created user is projected with the same variant the collection
   * uses rather than through a shape of its own.
   */
  async store({ auth, bouncer, request, response, serialize }: HttpContext) {
    await bouncer.with(UserPolicy).authorize('invite')

    const invitedBy = auth.getUserOrFail()
    const payload = await request.validateUsing(inviteUserValidator)

    const { user, activationLink } = await this.inviteUserUseCase.handle({ ...payload, invitedBy })

    response.status(201)

    return serialize({
      user: UserTransformer.transform(user, { includeAccessHistory: true }).useVariant(
        'toAdministration',
      ),
      activationLink,
    })
  }

  async index({ auth, bouncer, serialize }: HttpContext) {
    await bouncer.with(UserPolicy).authorize('list')

    const viewer = auth.getUserOrFail()
    const { users, includeAccessHistory } = await this.listUsersUseCase.handle(viewer)

    return serialize(
      UserTransformer.transform(users, { includeAccessHistory }).useVariant('toAdministration'),
    )
  }

  /**
   * Authorization first, deliberately: a caller who may not deactivate must not be able to learn
   * from a validation error or a 404 whether a given identifier names a user.
   */
  async deactivate({ auth, bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(UserPolicy).authorize('deactivate')

    const viewer = auth.getUserOrFail()
    const payload = await request.validateUsing(deactivateUserValidator, { data: { params } })

    const user = await this.deactivateUserUseCase.handle({
      id: payload.params.id,
      deactivatedByUserId: viewer.id,
      deactivatedAt: DateTime.now(),
    })

    // Only an organization admin reaches this command, and that is exactly the viewer the
    // collection already serves the access history to.
    return serialize(
      UserTransformer.transform(user, { includeAccessHistory: true }).useVariant(
        'toAdministration',
      ),
    )
  }
}
