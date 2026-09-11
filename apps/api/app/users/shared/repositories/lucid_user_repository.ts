import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'
import User from '#models/user'
import UserActivationToken from '#models/user_activation_token'
import isForeignKeyViolation from '#shared/database/is_foreign_key_violation'
import isUniqueViolation from '#shared/database/is_unique_violation'

import UserRepository, {
  type AcceptInvitationCommand,
  type AcceptInvitationResult,
  type ApplyUserIdentityCommand,
  type ApplyUserIdentityResult,
  type CancelPendingInvitationCommand,
  type CancelPendingInvitationResult,
  type ChangeUserRoleCommand,
  type ChangeUserRoleResult,
  type CreateUserCommand,
  type DeactivateUserCommand,
  type DeactivateUserResult,
  type InviteUserCommand,
  type InviteUserResult,
  type RemoveUserCommand,
  type RemoveUserResult,
  type RenewPasswordCommand,
  type RenewPasswordResult,
  type RequirePasswordRenewalCommand,
  type RequirePasswordRenewalResult,
} from './user_repository.ts'

/**
 * Thrown inside the acceptance transaction to roll it back, and caught outside it: a zero-row guard
 * is a refusal, not a failure, and it must undo whichever statement already ran.
 */
class UnusableActivationLink extends Error {}

/**
 * An instant in the exact format Lucid stored `@column.dateTime` values in on this dialect, so a
 * comparison against such a column is an instant comparison on PostgreSQL and a well-ordered string
 * comparison on SQLite. The model query builder binds a `DateTime` in a `where` as-is, which SQLite
 * refuses, and `toSQL()` would add milliseconds the stored value never has.
 */
function asStoredDateTime(value: DateTime, client: QueryClientContract): string {
  return value.toFormat(client.dialect.dateTimeFormat)
}

/**
 * Every user read that serializes the access history needs all six actor relations, and a missed
 * one is invisible in types: Lucid resolves an unpreloaded relation to `undefined` and the
 * transformer turns that into `null`, so the actor reads as "nobody did this" on one endpoint and
 * is named on every other. Gathered here, in the shape `lucid_truck_repository.ts` already uses,
 * so a seventh lifecycle event is a one-line change.
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
    .preload('passwordResetBy')
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
            cancellationComment: null,
            deactivatedAt: null,
            deactivatedByUserId: null,
            reactivatedAt: null,
            reactivatedByUserId: null,
            passwordResetAt: null,
            passwordResetByUserId: null,
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

  findPendingByActivationTokenHash(hash: string, now: DateTime): Promise<User | null> {
    const query = User.query()

    return query
      .where('accessStatus', 'PENDING')
      .whereHas('activationToken', (token) => {
        token.where('hash', hash).where('expiresAt', '>', asStoredDateTime(now, query.client))
      })
      .first()
  }

  /**
   * The guarded delete of the token, not a lock, is the concurrency control: two acceptances racing
   * on one link both reach it, and only one of them deletes the row — the loser matches zero rows,
   * on PostgreSQL once the winner's row lock is released and on SQLite because writes serialize.
   * The expiry is part of that guard, so a link that expired between the caller's early check and
   * this write is refused here rather than accepted a moment too late.
   *
   * The user transition is guarded too, on `PENDING`, so a link whose user moved on — cancelled
   * today, anything a later slice introduces — is never accepted. Either zero-row outcome throws
   * inside the transaction, which rolls the other statement back: a consumed link with a pending
   * user, or an active user whose link still works, is a half-accepted invitation.
   *
   * The row is deleted rather than marked as used: nothing reads a used link, the refusal a stale
   * link meets is the same whatever became of it, and `user_activation_tokens` holds live links only.
   */
  async acceptInvitation(command: AcceptInvitationCommand): Promise<AcceptInvitationResult> {
    try {
      return await User.transaction(async (trx) => {
        const token = await UserActivationToken.query({ client: trx })
          .where('hash', command.tokenHash)
          .first()

        if (!token) {
          throw new UnusableActivationLink()
        }

        const [consumed] = await UserActivationToken.query({ client: trx })
          .where('id', token.id)
          .where('expiresAt', '>', asStoredDateTime(command.acceptedAt, trx))
          .delete()

        if (Number(consumed) !== 1) {
          throw new UnusableActivationLink()
        }

        const acceptedAt = command.acceptedAt.toSQL({ includeOffset: false })
        const [activated] = await User.query({ client: trx })
          .where('id', token.userId)
          .where('accessStatus', 'PENDING')
          .update({
            accessStatus: 'ACTIVE',
            password: command.hashedPassword,
            activatedAt: acceptedAt,
            // Self-attributed: the invited person causes their own activation.
            activatedByUserId: token.userId,
            // The query-builder `.update()` bypasses the model's autoUpdate column hook, so the
            // bookkeeping timestamp is written by hand — as every other guarded write here does.
            updatedAt: acceptedAt,
          })

        if (Number(activated) !== 1) {
          throw new UnusableActivationLink()
        }

        const user = await preloadAccessHistory(
          User.query({ client: trx }).where('id', token.userId),
        ).firstOrFail()

        return { kind: 'ACCEPTED', user }
      })
    } catch (error) {
      if (error instanceof UnusableActivationLink) {
        return { kind: 'UNUSABLE' }
      }

      throw error
    }
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
   * The same guard-as-concurrency-control as `renewPassword` below, for the same reason: a
   * single-row conditional `UPDATE` is atomic on both PostgreSQL and SQLite, so
   * `WHERE access_status <> 'DEACTIVATED'` is what refuses a target that was deactivated between
   * the moment an administrator opened the record and the moment they confirmed. A read followed by
   * an unguarded write would accept it.
   *
   * No transaction, unlike every other write in this file. `renewPassword` needs one because
   * recording the password and revoking the other remembered connections must not be separable, and
   * `suspendAvailable` needs one because it reads a related row inside the write. Here the write is
   * a single statement, and the two reads around it are diagnostic — classifying a zero-row refusal,
   * and reloading the row for the response. Neither can leave the user half-changed, and a target
   * that moved again before a re-read is reported as its newest state, which is the honest answer.
   *
   * Submitting the role the user already holds still matches the guard, so it affects one row and
   * comes back `CHANGED`: a success with an unchanged row, which is what the interface must show
   * rather than a failure.
   */
  async changeRole(command: ChangeUserRoleCommand): Promise<ChangeUserRoleResult> {
    const [affectedRows] = await User.query()
      .where('id', command.userId)
      .whereNot('accessStatus', 'DEACTIVATED')
      .update({
        role: command.role,
        // The query-builder `.update()` bypasses the model's autoUpdate column hook, so the
        // bookkeeping timestamp is written by hand — as every other guarded write here does.
        updatedAt: DateTime.now().toSQL({ includeOffset: false }),
      })

    if (Number(affectedRows) !== 1) {
      const current = await User.query().where('id', command.userId).first()

      return current ? { kind: 'DEACTIVATED' } : { kind: 'NOT_FOUND' }
    }

    // Reloaded with the lifecycle actors so the response carries the same projection
    // `users.index` returns to an organization admin, who is the only caller that gets here.
    const changed = await preloadAccessHistory(User.query().where('id', command.userId)).first()

    return changed ? { kind: 'CHANGED', user: changed } : { kind: 'NOT_FOUND' }
  }

  /**
   * The guard is the eligibility rule and the concurrency control at once, as in `changeRole` above:
   * a single-row conditional `DELETE` is atomic on both dialects, so
   * `WHERE access_status IN ('PENDING', 'CANCELLED')` is what refuses a user who activated their
   * access between the workbench listing them and this statement, and what lets exactly one of two
   * concurrent removals through. The re-read after a zero-row delete only names the reason.
   *
   * Nothing here is a second statement: the activation link goes with the user through
   * `user_activation_tokens`' `ON DELETE CASCADE`, inside this very statement; so would a remembered
   * connection, though a user who never signed in holds none. The `SET NULL` references — every
   * `*_by_user_id` column on users and site references — cannot name this user at all: only an
   * active user performs a lifecycle action or an archival, so no other record is rewritten.
   *
   * A `RESTRICT` reference is the one thing that can stand in the way, and the database is left to
   * say so rather than a pre-check of `shifts`: a restricting table added later is then covered the
   * day its migration lands. That refusal is why the one statement still runs in a transaction of
   * its own. PostgreSQL aborts whatever transaction a failed statement ran in; in production this
   * transaction holds nothing else, but under the suites' global transaction Lucid nests it as a
   * savepoint, so a refused removal rolls back alone rather than aborting the test around it. This
   * method takes no client, so it never joins a caller's `db.transaction()` — a caller that ever
   * needs that must pass one in, and inherits this reasoning.
   */
  async removeNeverActivated(command: RemoveUserCommand): Promise<RemoveUserResult> {
    let affectedRows: number

    try {
      const [deletedRows] = await User.transaction((trx) =>
        User.query({ client: trx })
          .where('id', command.id)
          .whereIn('accessStatus', ['PENDING', 'CANCELLED'])
          .delete(),
      )

      affectedRows = Number(deletedRows)
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        return { kind: 'REFERENCED' }
      }

      throw error
    }

    if (affectedRows === 1) {
      return { kind: 'REMOVED' }
    }

    const current = await User.query().where('id', command.id).first()

    return current
      ? { kind: 'NOT_REMOVABLE', accessStatus: current.accessStatus }
      : { kind: 'NOT_FOUND' }
  }

  /**
   * The mirror of `renewPassword` below, and it borrows both of that method's reasons for a
   * transaction and a guard.
   *
   * The guard `WHERE access_status = 'ACTIVE'` is the concurrency control and the eligibility rule
   * at once: a single-row conditional `UPDATE` is atomic on both dialects, so two administrators
   * resetting the same user concurrently leave exactly one requirement standing, and a target that
   * stopped being active between the workbench listing it and this write simply matches zero rows.
   *
   * The transaction is what makes the requirement and the revocation inseparable — see
   * `revokeEveryRememberedConnection`.
   */
  requirePasswordRenewal(
    command: RequirePasswordRenewalCommand,
  ): Promise<RequirePasswordRenewalResult> {
    return User.transaction(async (trx) => {
      const resetAt = command.resetAt.toSQL({ includeOffset: false })

      // Read before the write so a zero-row `UPDATE` can be told apart from an unknown user: FR-006
      // wants a refusal naming the current access status, and one guarded statement alone cannot
      // distinguish "no such row" from "the row was not ACTIVE".
      const target = await User.query({ client: trx })
        .where('id', command.targetUserId)
        .forUpdate()
        .first()

      if (!target) {
        return { kind: 'NOT_FOUND' }
      }
      if (target.accessStatus !== 'ACTIVE') {
        return { kind: 'NOT_ACTIVE' }
      }

      const [affectedRows] = await User.query({ client: trx })
        .where('id', command.targetUserId)
        .where('accessStatus', 'ACTIVE')
        .update({
          passwordRenewalRequiredAt: resetAt,
          passwordResetAt: resetAt,
          passwordResetByUserId: command.resetByUserId,
          // The query-builder `.update()` bypasses the model's autoUpdate column hook, so the
          // bookkeeping timestamp is written by hand — the same treatment every other guarded write
          // in this codebase gives it.
          updatedAt: resetAt,
        })

      if (Number(affectedRows) !== 1) {
        // The row read above was ACTIVE, so a zero-row UPDATE means it moved on in between.
        // PostgreSQL cannot reach this — the `forUpdate()` above holds the row — but knex emits no
        // `FOR UPDATE` on SQLite, where a concurrent deactivation would otherwise be reported as a
        // successful reset of a user who was never required to renew.
        const current = await User.query({ client: trx }).where('id', command.targetUserId).first()

        return current ? { kind: 'NOT_ACTIVE' } : { kind: 'NOT_FOUND' }
      }

      await this.revokeEveryRememberedConnection(trx, command.targetUserId)

      const reset = await preloadAccessHistory(
        User.query({ client: trx }).where('id', command.targetUserId),
      ).firstOrFail()

      return { kind: 'RESET', user: reset }
    })
  }

  /**
   * Closes the window the reset exists to close. A remembered connection restores access for up to
   * 30 days without presenting a password, so leaving one standing would keep the credential being
   * replaced usable for weeks — the very exposure the administrator acted on.
   *
   * **Every** connection goes, unlike `revokeOtherRememberedConnections` below, which spares the one
   * the renewal was performed from. There is nothing to spare here: the actor is the administrator,
   * not the target, so no connection in this set belongs to the person making the request.
   *
   * Live sessions are deliberately left standing — `PasswordRenewalMiddleware` confines them at
   * their next request, so the target meets the renewal step instead of an unexplained sign-out and
   * loses no work in progress.
   *
   * Reached only on a successful reset, inside the same transaction as the write, so a refused reset
   * revokes nothing and a failed revocation takes the requirement down with it (FR-013).
   *
   * Deleted through the query builder rather than `RememberMeToken`: the guard's token provider
   * writes these rows itself, in a shape the model's date columns refuse to hydrate.
   */
  private async revokeEveryRememberedConnection(
    trx: TransactionClientContract,
    targetUserId: string,
  ) {
    await trx.from('remember_me_tokens').where('tokenable_id', targetUserId).delete()
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
   * `deactivateActive` with the status and the side effect swapped, and it borrows both of that
   * method's reasons. The guard `WHERE access_status = 'PENDING'` is the eligibility rule and the
   * concurrency control at once: two racing cancellations match one row between them, and a target
   * that was activated, deactivated, or cancelled after the workbench listed it matches none.
   *
   * The transaction makes the status change and the end of the link inseparable (FR-005): a
   * cancelled user holding a live activation token, or a pending user whose token vanished under a
   * cancellation that did not complete, is a half-withdrawn access.
   *
   * The token is **deleted**, not flagged: `user_activation_tokens` holds the one live link of a
   * pending user, so once it is gone a presented secret matches nothing — exactly the answer an
   * unknown link gets — and restoring the invitation later inserts a fresh row. A pending user who
   * holds no token (seeded before invitations existed) makes the delete a no-op, which is still the
   * outcome FR-004 asks for: no usable link remains.
   *
   * What this cannot do alone is stop a token being *written* for this user by a concurrent renewal
   * or acceptance: inserting a token only takes a key-share lock on the `users` row, which this
   * `UPDATE` does not block. Those writes must guard on the same row still being `PENDING` — the
   * obligation recorded in the feature's HTTP contract.
   */
  cancelPendingInvitation(
    command: CancelPendingInvitationCommand,
  ): Promise<CancelPendingInvitationResult> {
    return User.transaction(async (trx) => {
      const changedAt = command.cancelledAt.toSQL({ includeOffset: false })
      const [affectedRows] = await User.query({ client: trx })
        .where('id', command.id)
        .where('accessStatus', 'PENDING')
        .update({
          accessStatus: 'CANCELLED',
          cancelledAt: changedAt,
          cancelledByUserId: command.cancelledByUserId,
          cancellationComment: command.comment,
          // The query-builder `.update()` bypasses the model's autoUpdate column hook, so the
          // bookkeeping timestamp is written by hand — as every other guarded write here does.
          updatedAt: changedAt,
        })

      if (Number(affectedRows) !== 1) {
        // Only names the reason; the guard above already decided the outcome, so there is no
        // check-then-act window here to lose. Nothing is written and no token is touched.
        const user = await User.query({ client: trx }).where('id', command.id).first()

        return user
          ? { kind: 'NOT_PENDING', accessStatus: user.accessStatus }
          : { kind: 'NOT_FOUND' }
      }

      await UserActivationToken.query({ client: trx }).where('userId', command.id).delete()

      // Reloaded with every lifecycle actor resolved, for the reason `deactivateActive` gives: the
      // response projects the whole access history, and a relation left unpreloaded would serialize
      // as `null`.
      const user = await preloadAccessHistory(
        User.query({ client: trx }).where('id', command.id),
      ).firstOrFail()

      return { kind: 'CANCELLED', user }
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
