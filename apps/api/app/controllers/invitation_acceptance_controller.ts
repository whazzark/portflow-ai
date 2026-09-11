import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import AcceptInvitationUseCase from '#auth/invitation_acceptance/accept_invitation_use_case'
import { InvitationAcceptedSessionNotOpenedException } from '#auth/invitation_acceptance/invitation_acceptance_exceptions'
import {
  invitationAcceptanceValidator,
  invitationPreviewValidator,
} from '#auth/invitation_acceptance/invitation_acceptance_validator'
import PreviewInvitationUseCase from '#auth/invitation_acceptance/preview_invitation_use_case'
import { resolveOpenSessionUser } from '#auth/shared/open_session'
import { REMEMBERED_CONNECTION_EXPIRES_AT_SESSION_KEY } from '#auth/shared/remembered_connection'
import UserTransformer from '#users/shared/transformers/user_transformer'

/**
 * Both actions are public — declared outside the `auth()` group, beside login — and both take the
 * activation secret from the request body, never from the URL: paths and query strings are what
 * access logs record, and the secret is a credential.
 */
@inject()
export default class InvitationAcceptanceController {
  constructor(
    private previewInvitationUseCase: PreviewInvitationUseCase,
    private acceptInvitationUseCase: AcceptInvitationUseCase,
  ) {}

  async preview({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(invitationPreviewValidator)

    const user = await this.previewInvitationUseCase.handle({
      token: payload.token,
      now: DateTime.now(),
    })

    return serialize(UserTransformer.transform(user).useVariant('toActivationPreview'))
  }

  async store(ctx: HttpContext) {
    const { request, auth, serialize, session } = ctx
    const payload = await request.validateUsing(invitationAcceptanceValidator)

    const signedInUser = await resolveOpenSessionUser(ctx)

    const user = await this.acceptInvitationUseCase.handle({
      token: payload.token,
      password: payload.password,
      signedInUserId: signedInUser?.id ?? null,
      acceptedAt: DateTime.now(),
    })

    // After the commit, because the session belongs to this layer and the write to the repository.
    // No remember argument: an acceptance opens a temporary session only, and the person chooses a
    // remembered connection at a later login. `login` regenerates the session id, as it does at
    // login, so no session fixed before the acceptance survives it. It keeps the session's data,
    // though: a remembered connection's expiry left behind by the replaced session would end this
    // one at the very next request.
    try {
      session.forget(REMEMBERED_CONNECTION_EXPIRES_AT_SESSION_KEY)
      await auth.use('web').login(user)
    } catch (error) {
      throw new InvitationAcceptedSessionNotOpenedException(undefined, { cause: error })
    }

    return serialize(UserTransformer.transform(user))
  }
}
