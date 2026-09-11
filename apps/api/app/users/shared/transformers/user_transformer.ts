import { BaseTransformer } from '@adonisjs/core/transformers'

import type User from '#models/user'

export type UserAdministrationOptions = {
  /**
   * Whether the viewer may consult the access history. Withheld from every viewer but an
   * organization admin: a responsible administrator is itself a user they may not consult.
   */
  includeAccessHistory: boolean
}

export default class UserTransformer extends BaseTransformer<User> {
  constructor(
    user: User,
    private options: UserAdministrationOptions = { includeAccessHistory: false },
  ) {
    super(user)
  }

  toSummary() {
    return this.pick(this.resource, ['id', 'firstName', 'lastName'])
  }

  /**
   * What the holder of an activation link sees before choosing a password: enough to recognize the
   * access as theirs, and for a password manager to file the credential under the right email.
   * Nothing more — no id, role, status, or date.
   */
  toActivationPreview() {
    return this.pick(this.resource, ['firstName', 'lastName', 'email'])
  }

  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'firstName',
        'lastName',
        'email',
        'role',
        'accessStatus',
        'invitedAt',
        'activatedAt',
        'cancelledAt',
        'deactivatedAt',
        'reactivatedAt',
        // biome-ignore lint/security/noSecrets: field name, not a secret
        'invitedByUserId',
        'activatedByUserId',
        'cancelledByUserId',
        'deactivatedByUserId',
        'reactivatedByUserId',
      ]),
      // Derived, and composed alongside the picked set because `pick` cannot express it. The raw
      // `passwordRenewalRequiredAt` is deliberately not serialized: it would say *when* an
      // administrator acted, and the only two producers are a password reset and a reactivation.
      // The interface needs one bit to choose a route; it gets one bit.
      passwordRenewalRequired: this.resource.passwordRenewalRequiredAt !== null,
    }
  }

  /**
   * The user administration collection projection. Every authorized viewer receives the identity
   * block; the dated lifecycle events and their responsible administrators are added only when the
   * viewer may consult the access history. Withheld keys are absent from the payload, not null.
   */
  toAdministration() {
    const identity = this.pick(this.resource, [
      'id',
      'firstName',
      'lastName',
      'email',
      'role',
      'accessStatus',
    ])
    const { includeAccessHistory } = this.options

    return {
      ...identity,
      invitedAt: this.when(includeAccessHistory, () => this.resource.invitedAt),
      invitedBy: this.when(includeAccessHistory, () => this.toActor(this.resource.invitedBy)),
      activatedAt: this.when(includeAccessHistory, () => this.resource.activatedAt),
      activatedBy: this.when(includeAccessHistory, () => this.toActor(this.resource.activatedBy)),
      cancelledAt: this.when(includeAccessHistory, () => this.resource.cancelledAt),
      cancelledBy: this.when(includeAccessHistory, () => this.toActor(this.resource.cancelledBy)),
      // The administrator's own words on the latest cancellation, gated like the event it annotates.
      cancellationComment: this.when(includeAccessHistory, () => this.resource.cancellationComment),
      deactivatedAt: this.when(includeAccessHistory, () => this.resource.deactivatedAt),
      deactivatedBy: this.when(includeAccessHistory, () =>
        this.toActor(this.resource.deactivatedBy),
      ),
      reactivatedAt: this.when(includeAccessHistory, () => this.resource.reactivatedAt),
      reactivatedBy: this.when(includeAccessHistory, () =>
        this.toActor(this.resource.reactivatedBy),
      ),
      passwordResetAt: this.when(includeAccessHistory, () => this.resource.passwordResetAt),
      passwordResetBy: this.when(includeAccessHistory, () =>
        this.toActor(this.resource.passwordResetBy),
      ),
      activationLinkRenewedAt: this.when(
        includeAccessHistory,
        () => this.resource.activationLinkRenewedAt,
      ),
      activationLinkRenewedBy: this.when(includeAccessHistory, () =>
        this.toActor(this.resource.activationLinkRenewedBy),
      ),
      // The expiry, not an `expired` flag: validity is a comparison with the current time, and a
      // flag computed here would go stale in a collection left open across the expiry. The workbench
      // compares at render time instead. `null` for a pending user holding no link, and for every
      // user who is not pending — a link matters only while its user is. Gated with the history:
      // that an administrator issued a link is the same class of information as who did.
      activationLinkExpiresAt: this.when(includeAccessHistory, () =>
        this.resource.accessStatus === 'PENDING'
          ? (this.resource.activationToken?.expiresAt ?? null)
          : null,
      ),
      // Gated like the events above, and for the same reason: that an administrator acted on this
      // user is the same class of information as the identity of the administrator who did.
      //
      // Derived rather than the raw `passwordRenewalRequiredAt`, which stays unserialized
      // everywhere — the timestamp would say *when* an administrator acted, and where it came from
      // is what `passwordResetAt` answers, correctly attributed. A requirement recorded by a
      // reactivation will be dated by that event instead, which is why the state and the origin are
      // separate keys rather than one derived pair.
      passwordRenewalRequired: this.when(
        includeAccessHistory,
        () => this.resource.passwordRenewalRequiredAt !== null,
      ),
    }
  }

  private toActor(actor: User | null) {
    return actor ? UserTransformer.transform(actor).useVariant('toSummary') : null
  }
}
