import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

import CancelUserInvitationUseCase from '#users/cancel_invitation/cancel_user_invitation_use_case'
import { cancelUserInvitationValidator } from '#users/cancel_invitation/cancel_user_invitation_validator'
import DeactivateUserUseCase from '#users/deactivate/deactivate_user_use_case'
import { deactivateUserValidator } from '#users/deactivate/deactivate_user_validator'
import UpdateUserIdentityUseCase from '#users/identity/update_user_identity_use_case'
import InviteUserUseCase from '#users/invite/invite_user_use_case'
import { inviteUserValidator } from '#users/invite/invite_user_validator'
import ListUsersUseCase from '#users/list/list_users_use_case'
import ResetUserPasswordUseCase from '#users/password_reset/reset_user_password_use_case'
import { resetUserPasswordValidator } from '#users/password_reset/reset_user_password_validator'
import RemoveUserUseCase from '#users/removal/remove_user_use_case'
import { removeUserValidator } from '#users/removal/remove_user_validator'
import ChangeUserRoleUseCase from '#users/role_change/change_user_role_use_case'
import UserTransformer from '#users/shared/transformers/user_transformer'
import UserPolicy from '#users/shared/user_policy'
import { changeUserRoleValidator, updateUserIdentityValidator } from '#users/shared/user_validator'

@inject()
export default class UsersController {
  constructor(
    private listUsersUseCase: ListUsersUseCase,
    private inviteUserUseCase: InviteUserUseCase,
    private deactivateUserUseCase: DeactivateUserUseCase,
    private updateUserIdentityUseCase: UpdateUserIdentityUseCase,
    private changeUserRoleUseCase: ChangeUserRoleUseCase,
    private resetUserPasswordUseCase: ResetUserPasswordUseCase,
    private cancelUserInvitationUseCase: CancelUserInvitationUseCase,
    private removeUserUseCase: RemoveUserUseCase,
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

  async update({ auth, bouncer, request, serialize }: HttpContext) {
    await bouncer.with(UserPolicy).authorize('updateIdentity')

    const administrator = auth.getUserOrFail()
    const payload = await request.validateUsing(updateUserIdentityValidator)

    const user = await this.updateUserIdentityUseCase.handle({
      targetUserId: payload.params.id,
      requestedByUserId: administrator.id,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      changedAt: DateTime.now(),
    })

    // Only an organization admin reaches this seam at all, and that is exactly the viewer the
    // access history is exposed to, so the corrected user comes back in the same projection the
    // collection uses.
    return serialize(
      UserTransformer.transform(user, { includeAccessHistory: true }).useVariant(
        'toAdministration',
      ),
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

  /**
   * Authorization first, for the reason `deactivate` records: a viewer who may not cancel
   * invitations receives the same denial whether the id is malformed, unknown, or names a pending
   * user — so the refusal discloses nothing about the target (FR-009).
   *
   * The body is optional; `request.body()` is merged with the route params so the validator reads
   * both from one object, the shape the generated client contract expects.
   */
  async cancelInvitation({ auth, bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(UserPolicy).authorize('cancelInvitation')

    const viewer = auth.getUserOrFail()
    const payload = await request.validateUsing(cancelUserInvitationValidator, {
      data: { ...request.body(), params },
    })

    const user = await this.cancelUserInvitationUseCase.handle({
      id: payload.params.id,
      cancelledByUserId: viewer.id,
      cancelledAt: DateTime.now(),
      comment: payload.comment,
    })

    // Only an organization admin reaches this command, and that is exactly the viewer the
    // collection already serves the access history to.
    return serialize(
      UserTransformer.transform(user, { includeAccessHistory: true }).useVariant(
        'toAdministration',
      ),
    )
  }

  /**
   * Authorization runs before the target is ever looked up, which is what keeps a refusal
   * uninformative: a viewer who may not change roles receives the same denial whether the id names
   * a pending user, a deactivated one, or nobody at all.
   *
   * The response carries the access history because the only viewer that reaches here is an
   * organization admin — exactly the viewer that projection exists for.
   */
  async changeRole({ bouncer, request, serialize }: HttpContext) {
    await bouncer.with(UserPolicy).authorize('changeRole')

    const payload = await request.validateUsing(changeUserRoleValidator)

    const user = await this.changeUserRoleUseCase.handle({
      userId: payload.params.id,
      role: payload.role,
    })

    return serialize(
      UserTransformer.transform(user, { includeAccessHistory: true }).useVariant(
        'toAdministration',
      ),
    )
  }

  /**
   * Authorization first, for the reason `deactivate` records: a caller who may not remove users must
   * not learn from a validation error, a 404, or a 409 whether an identifier names anyone.
   *
   * A `204` with no body, unlike every other write here: the user no longer exists, and nothing
   * about them is kept to project.
   */
  async destroy({ bouncer, params, request, response }: HttpContext) {
    await bouncer.with(UserPolicy).authorize('remove')

    const payload = await request.validateUsing(removeUserValidator, { data: { params } })

    await this.removeUserUseCase.handle({ id: payload.params.id })

    response.status(204)
  }

  /**
   * Authorization first, for the reason `deactivate` records. The request carries no body: the
   * validator checks the target identifier in the path, and the actor comes from the session.
   *
   * `includeAccessHistory` is unconditionally true because the policy above admits organization
   * admins only, which is exactly the audience allowed to consult it.
   */
  async resetPassword({ auth, bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(UserPolicy).authorize('resetPassword')

    const administrator = auth.use('web').getUserOrFail()
    const payload = await request.validateUsing(resetUserPasswordValidator, { data: { params } })

    const target = await this.resetUserPasswordUseCase.handle({
      targetUserId: payload.params.id,
      actorUserId: administrator.id,
      resetAt: DateTime.now(),
    })

    return serialize(
      UserTransformer.transform(target, { includeAccessHistory: true }).useVariant(
        'toAdministration',
      ),
    )
  }
}
