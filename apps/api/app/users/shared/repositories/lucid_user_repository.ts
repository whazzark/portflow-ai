import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'
import User from '#models/user'
import UserActivationToken from '#models/user_activation_token'
import isUniqueViolation from '#shared/database/is_unique_violation'

import UserRepository, {
  type ApplyUserIdentityCommand,
  type ApplyUserIdentityResult,
  type CreateUserCommand,
  type DeactivateUserCommand,
  type DeactivateUserResult,
  type InviteUserCommand,
  type InviteUserResult,
  type RenewPasswordCommand,
  type RenewPasswordResult,
} from './user_repository.ts'

/**
 * Every user read that serializes the access history needs all five actor relations, and a missed
 * one is invisible in types: Lucid resolves an unpreloaded relation to `undefined` and the
 * transformer turns that into `null`, so the actor reads as "nobody did this" on one endpoint and
 * is named on every other. Gathered here, in the shape `lucid_truck_repository.ts` already uses,
 * so a sixth lifecycle event is a one-line change.
 */
function preloadAccessHistory(
  query: ModelQueryBuilderContract<typeof User, User>,
): ModelQueryBuilderContract<typeof User, User> {
  return query
    .preload('invitedBy')
    .preload('activatedBy')
    .preload('cancelledBy')
    .preload('deactivatedBy')
    .preload('reactivatedBy')
}

export default class LucidUserRepository extends UserRepository {
  create(command: CreateUserCommand): Promise<User> {
    return User.create(command)
  }

  /**
   * The pending user and its activation token are two statements that must not be separable
   * (FR-018), hence the transaction. The refusal is left to the `users_email_unique` index rather
   * than to the caller's earlier lookup: only the index decides between two invitations of the same
   * email racing each other, and it decides the same way whatever the timing.
   *
   * A violation is reported as `DUPLICATE_EMAIL` because that index is the only one this write can
   * realistically collide on — the token digest is 256 bits of randomness.
   */
  async invite(command: InviteUserCommand): Promise<InviteUserResult> {
    try {
      return await User.transaction(async (trx) => {
        const user = await User.create(
          {
            firstName: command.firstName,
            lastName: command.lastName,
            email: command.email,
            role: command.role,
            accessStatus: 'PENDING',
            password: null,
            invitedAt: command.invitedAt,
            invitedByUserId: command.invitedByUserId,
            // Written as explicit nulls rather than left unset: an invitation records one lifecycle
            // event and no other (FR-003), and the instance the caller projects has to say so as
            // plainly as the row does.
            activatedAt: null,
            activatedByUserId: null,
            cancelledAt: null,
            cancelledByUserId: null,
            deactivatedAt: null,
            deactivatedByUserId: null,
            reactivatedAt: null,
            reactivatedByUserId: null,
            passwordRenewalRequiredAt: null,
          },
          { client: trx },
        )

        const activationToken = await UserActivationToken.create(
          {
            userId: user.id,
            hash: command.activationTokenHash,
            expiresAt: command.activationTokenExpiresAt,
          },
          { client: trx },
        )

        return { kind: 'CREATED', user, activationToken }
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { kind: 'DUPLICATE_EMAIL' }
      }

      throw error
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return User.query().whereRaw('LOWER(email) = ?', [email.toLowerCase()]).first()
  }

  list(): Promise<User[]> {
    return preloadAccessHistory(User.query())
      .orderBy('lastName', 'asc')
      .orderBy('firstName', 'asc')
      .orderBy('id', 'asc')
  }

  // No preload: the lifecycle actors are withheld from the viewers this read serves.
  listActive(): Promise<User[]> {
    return User.query()
      .where('accessStatus', 'ACTIVE')
      .orderBy('lastName', 'asc')
      .orderBy('firstName', 'asc')
      .orderBy('id', 'asc')
  }

  /**
   * The guard, not a lock, is the concurrency control: a single-row conditional `UPDATE` is atomic
   * on both PostgreSQL and SQLite, so `WHERE password_renewal_required_at IS NOT NULL` is what makes
   * two racing renewals record exactly one password — the loser matches zero rows. The truck
   * lifecycle writes reach for `SELECT … FOR UPDATE` because they must read a related row inside the
   * same transaction; there is no second row to read here.
   *
   * The same zero-row outcome is also the refusal for a session that owes no renewal — one
   * mechanism, two requirements.
   *
   * The transaction is not there for the guard. It is there because recording the password and
   * revoking the other remembered connections are two statements that must not be separable: if the
   * revocation failed after the `UPDATE` had committed, the password would be replaced while the
   * connections established under the old one kept restoring access for their full 30 days — the
   * exact window this slice exists to close, and the partial change FR-017 forbids. Hashing happens
   * before this call, so scrypt never runs inside the transaction.
   */
  renewPassword(command: RenewPasswordCommand): Promise<RenewPasswordResult> {
    return User.transaction(async (trx) => {
      const [affectedRows] = await User.query({ client: trx })
        .where('id', command.userId)
        .whereNotNull('passwordRenewalRequiredAt')
        .update({
          password: command.hashedPassword,
          passwordRenewalRequiredAt: null,
          // The query-builder `.update()` bypasses the model's autoUpdate column hook, so the
          // bookkeeping timestamp is written by hand — the same treatment every other guarded write
          // in this codebase gives it.
          updatedAt: DateTime.now().toSQL({ includeOffset: false }),
        })

      if (Number(affectedRows) !== 1) {
        return 'NOT_REQUIRED'
      }

      await this.revokeOtherRememberedConnections(trx, command)

      return 'RENEWED'
    })
  }

  /**
   * The guard is the concurrency control, exactly as in `renewPassword` above: `WHERE access_status
   * = 'ACTIVE'` is what makes two racing deactivations record one deactivation, because the loser
   * matches zero rows. The re-read that follows a zero-row update is only there to name the reason;
   * it never decides the outcome, so there is no check-then-act window to lose.
   *
   * The transaction is not there for the guard. It is there because recording the deactivation and
   * revoking the user's remembered connections are two statements that must not be separable: a
   * revocation that failed after the `UPDATE` had committed would leave a credential restoring
   * access for its full 30 days to someone who has just been told they have none.
   */
  deactivateActive(command: DeactivateUserCommand): Promise<DeactivateUserResult> {
    return User.transaction(async (trx) => {
      const changedAt = command.deactivatedAt.toSQL({ includeOffset: false })
      const [affectedRows] = await User.query({ client: trx })
        .where('id', command.id)
        .where('accessStatus', 'ACTIVE')
        .update({
          accessStatus: 'DEACTIVATED',
          deactivatedAt: changedAt,
          deactivatedByUserId: command.deactivatedByUserId,
          // The query-builder `.update()` bypasses the model's autoUpdate column hook, so the
          // bookkeeping timestamp is written by hand — as every other guarded write here does.
          updatedAt: changedAt,
        })

      if (Number(affectedRows) !== 1) {
        const user = await User.query({ client: trx }).where('id', command.id).first()

        return user
          ? { kind: 'NOT_ACTIVE', accessStatus: user.accessStatus }
          : { kind: 'NOT_FOUND' }
      }

      await trx.from('remember_me_tokens').where('tokenable_id', command.id).delete()

      // Reloaded with every lifecycle actor resolved, not just the `deactivatedBy` this write
      // produced: the response projects the whole access history, and a relation left unpreloaded
      // would serialize as `null` — telling the workbench nobody ever invited or activated this
      // user, and contradicting the collection it caches alongside.
      const user = await preloadAccessHistory(
        User.query({ client: trx }).where('id', command.id),
      ).firstOrFail()

      return { kind: 'DEACTIVATED', user }
    })
  }

  /**
   * Closes the window the renewal exists to close: a remembered connection restores access for up
   * to 30 days without presenting a password, so every one established under the replaced
   * credential must stop working. Only the connection this request came from survives.
   *
   * Reached only on a `RENEWED` outcome — a refused renewal revokes nothing (FR-017).
   *
   * Deleted through the query builder rather than `RememberMeToken`: the guard's token provider
   * writes these rows itself, in a shape the model's date columns refuse to hydrate.
   */
  private async revokeOtherRememberedConnections(
    trx: TransactionClientContract,
    command: RenewPasswordCommand,
  ) {
    const revocation = trx.from('remember_me_tokens').where('tokenable_id', command.userId)

    if (command.keptRememberedConnectionId !== null) {
      revocation.whereNot('id', command.keptRememberedConnectionId)
    }

    await revocation.delete()
  }

  /**
   * The lock, not a guard, is the concurrency control here: the use case decides from the stored
   * identity — whether anything changed, whether a pending user reaches a different mailbox — and
   * those decisions must still hold when the write lands, which means reading the stored values and
   * writing the new ones under one lock. A compare-and-swap would need every replaced column in its `WHERE`, which is a hand-rolled
   * optimistic lock where a row lock already exists — the shape the truck lifecycle writes use.
   *
   * `forUpdate()` is a no-op on SQLite, which serializes writes anyway; PostgreSQL is where it earns
   * its place.
   *
   * Preloaded because a submission that changes nothing returns this very instance, and the
   * response projects the whole access history: a relation left unpreloaded would serialize as
   * `null`.
   */
  findByIdForUpdate(id: string, client: TransactionClientContract): Promise<User | null> {
    return preloadAccessHistory(User.query({ client }).where('id', id).forUpdate()).first()
  }

  /**
   * Runs inside the caller's transaction, never its own: the use case coordinates this write with
   * the activation link a pending user's corrected address needs, and the two are one indivisible
   * effect (ADR 0013).
   */
  async applyIdentity(command: ApplyUserIdentityCommand): Promise<ApplyUserIdentityResult> {
    const { client } = command

    // Asked before the write for the sake of a precise answer; `users_email_unique` on
    // `LOWER(email)` remains the authority, and the catch below is what closes the window between
    // this question and the write.
    const holder = await User.query({ client })
      .whereRaw('LOWER(email) = ?', [command.email.toLowerCase()])
      .whereNot('id', command.id)
      .first()

    if (holder) {
      return { kind: 'EMAIL_TAKEN' }
    }

    const changedAt = command.changedAt.toSQL({ includeOffset: false })

    try {
      await User.query({ client }).where('id', command.id).update({
        firstName: command.firstName,
        lastName: command.lastName,
        email: command.email,
        // The query-builder `.update()` bypasses the model's autoUpdate column hook, so the
        // bookkeeping timestamp is written by hand — as every other guarded write here does.
        updatedAt: changedAt,
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { kind: 'EMAIL_TAKEN' }
      }

      throw error
    }

    // Also what answers an unknown id: the `UPDATE` above matched no row, so there is nothing to
    // reload.
    const corrected = await preloadAccessHistory(User.query({ client }))
      .where('id', command.id)
      .first()

    if (!corrected) {
      return { kind: 'NOT_FOUND' }
    }

    return { kind: 'UPDATED', user: corrected }
  }
}
