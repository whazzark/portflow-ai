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

  toObject() {
    return this.pick(this.resource, [
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
    ])
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
      deactivatedAt: this.when(includeAccessHistory, () => this.resource.deactivatedAt),
      deactivatedBy: this.when(includeAccessHistory, () =>
        this.toActor(this.resource.deactivatedBy),
      ),
      reactivatedAt: this.when(includeAccessHistory, () => this.resource.reactivatedAt),
      reactivatedBy: this.when(includeAccessHistory, () =>
        this.toActor(this.resource.reactivatedBy),
      ),
    }
  }

  private toActor(actor: User | null) {
    return actor ? UserTransformer.transform(actor).useVariant('toSummary') : null
  }
}
