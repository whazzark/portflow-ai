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
  type ApplyOwnPasswordCommand,
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
  type ReactivateUserCommand,
  type ReactivateUserResult,
  type RemoveUserCommand,
  type RemoveUserResult,
  type RenewActivationLinkCommand,
  type RenewActivationLinkResult,
  type RenewPasswordCommand,
  type RenewPasswordResult,
  type RequirePasswordRenewalCommand,
  type RequirePasswordRenewalResult,
  type RestoreCancelledInvitationCommand,
  type RestoreCancelledInvitationResult,
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
 * Every user read that serializes the access history needs all eight actor relations, and a missed
 * one is invisible in types: Lucid resolves an unpreloaded relation to `undefined` and the
 * transformer turns that into `null`, so the actor reads as "nobody did this" on one endpoint and
 * is named on every other. Gathered here, in the shape `lucid_truck_repository.ts` already uses,
 * so a ninth lifecycle event is a one-line change.
 *
 * `activationToken` is not an actor: it is a pending user's live link, preloaded so the projection
 * can state until when it works. Only its expiry is ever read from it — the digest never leaves this
 * layer.
 */
function preloadAccessHistory(
  query: ModelQueryBuilderContract<typeof User, User>,
): ModelQueryBuilderContract<typeof User, User> {
  return query
    .preload('invitedBy')
    .preload('activatedBy')
    .preload('cancelledBy')
    .preload('invitationRestoredBy')
    .preload('deactivatedBy')
    .preload('reactivatedBy')
    .preload('passwordResetBy')
    .preload('activationLinkRenewedBy')
    .preload('activationToken')
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
            invitationRestoredAt: null,
            invitationRestoredByUserId: null,
            invitationRestorationComment: null,
            deactivatedAt: null,
            deactivatedByUserId: null,
            reactivatedAt: null,
            reactivatedByUserId: null,
            passwordResetAt: null,
            passwordResetByUserId: null,
            passwordRenewalRequiredAt: null,
            activationLinkRenewedAt: null,
            activationLinkRenewedByUserId: null,
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
   * One transaction, decided under the locks `lockTargetAndActiveOrganizationAdmins` takes. A single
   * conditional `UPDATE` was enough while the only rule was about the target's own row; the rule
   * that the organization keeps an active organization admin is about other rows too, and two
   * administrators demoting each other write two *different* rows — a guard on each would see the
   * other still an admin, and both would pass. Deciding on rows every such change must lock first is
   * what judges them one after the other.
   *
   * Submitting the role the user already holds comes back `CHANGED`: a success with an unchanged
   * row, which is what the interface must show rather than a failure. Submitting the organization
   * admin role is never refused by the rule — it can only add to the admins who remain.
   */
  changeRole(command: ChangeUserRoleCommand): Promise<ChangeUserRoleResult> {
    // The canonical spelling `users.id` stores, used by every statement below. PostgreSQL would
    // match an upper-cased identifier anyway; SQLite compares it as text and would not, so without
    // this the admin half of the locking read could find a row the `UPDATE` then misses.
    const userId = command.userId.toLowerCase()

    return User.transaction(async (trx) => {
      const { target, otherActiveOrganizationAdmins } =
        await this.lockTargetAndActiveOrganizationAdmins(trx, userId)

      if (!target) {
        return { kind: 'NOT_FOUND' }
      }
      if (target.accessStatus === 'DEACTIVATED') {
        return { kind: 'DEACTIVATED' }
      }
      if (
        target.accessStatus === 'ACTIVE' &&
        target.role === 'ORGANIZATION_ADMIN' &&
        command.role !== 'ORGANIZATION_ADMIN' &&
        otherActiveOrganizationAdmins.length === 0
      ) {
        return { kind: 'LAST_ACTIVE_ORGANIZATION_ADMIN' }
      }

      const [affectedRows] = await User.query({ client: trx })
        .where('id', userId)
        .whereNot('accessStatus', 'DEACTIVATED')
        .update({
          role: command.role,
          // The query-builder `.update()` bypasses the model's autoUpdate column hook, so the
          // bookkeeping timestamp is written by hand — as every other guarded write here does.
          updatedAt: DateTime.now().toSQL({ includeOffset: false }),
        })

      if (Number(affectedRows) !== 1) {
        // The row read above was not deactivated, so a zero-row UPDATE means it moved on in between.
        // PostgreSQL cannot reach this — the lock above holds the row — but knex emits no locking
        // clause on SQLite, where the guard is what keeps a deactivated user's role frozen.
        const current = await User.query({ client: trx }).where('id', userId).first()

        return current ? { kind: 'DEACTIVATED' } : { kind: 'NOT_FOUND' }
      }

      // Reloaded with the lifecycle actors so the response carries the same projection
      // `users.index` returns to an organization admin, who is the only caller that gets here.
      const changed = await preloadAccessHistory(
        User.query({ client: trx }).where('id', userId),
      ).firstOrFail()

      return { kind: 'CHANGED', user: changed }
    })
  }

  /**
   * The target, and every other active organization admin, read under row locks held until the
   * caller's transaction ends. Any change that could take the organization's last active
   * organization admin away must decide on these rows, and must lock them here, the same way:
   *
   * - **One statement, in id order.** Every caller locks the same kind of rows in the same order, and
   *   `id` never changes, so no two of them can deadlock. Locking the target first and the admins
   *   second would: an administrator demoting another holds that row and waits on their own, while
   *   the other does the reverse.
   * - **What was waited for is re-read.** PostgreSQL re-evaluates the `WHERE` of any row a locking read
   *   had to wait for, against the version that committed: an admin demoted or deactivated in the
   *   meantime is simply not returned, and is not counted.
   * - **`FOR NO KEY UPDATE`, not `FOR UPDATE`.** Every insert of a row referencing a user takes
   *   `FOR KEY SHARE` on that user through its foreign-key check, which `FOR UPDATE` would conflict
   *   with: an admin's ordinary work would wait on a role change, and a transaction referencing two
   *   users could deadlock with it. `FOR NO KEY UPDATE` still conflicts with every writer that
   *   matters — another such read, and any `UPDATE` of these rows, deactivation included. Lucid
   *   exposes only `forUpdate()` and `forShare()`, so the clause is set on the knex builder; knex
   *   emits nothing on SQLite, which serializes writers anyway.
   *
   * One limit, accepted: a user promoted to organization admin by a transaction that commits while
   * this read waits was not in its snapshot, so is not counted. A demotion can then be refused where,
   * a moment later, it would be allowed — the safe direction, and a retry succeeds.
   *
   * `deactivateActive` does not call this: it locks its actor and its target through `lockUsers`,
   * with the same clause and the same order, and re-reads the actor under that lock. A demotion and
   * a deactivation always share a locked row — the deactivation's actor is an active organization
   * admin, so this read locks it too — so they are judged one after the other all the same, and
   * whichever queues second sees the organization admin the first removed.
   *
   * `id` must arrive in the lower-case spelling `users.id` stores: it is compared with the rows as
   * text, as SQLite compares it.
   */
  private async lockTargetAndActiveOrganizationAdmins(
    trx: TransactionClientContract,
    id: string,
  ): Promise<{ target: User | null; otherActiveOrganizationAdmins: User[] }> {
    const query = User.query({ client: trx })
      .where('id', id)
      .orWhere((admins) =>
        admins.where('role', 'ORGANIZATION_ADMIN').where('accessStatus', 'ACTIVE'),
      )
      .orderBy('id')
    query.knexQuery.forNoKeyUpdate()

    const rows = await query
    const target = rows.find((row) => row.id === id) ?? null

    return {
      target,
      otherActiveOrganizationAdmins: rows.filter(
        (row) =>
          row !== target && row.role === 'ORGANIZATION_ADMIN' && row.accessStatus === 'ACTIVE',
      ),
    }
  }

  /**
   * The guard is the eligibility rule and the concurrency control at once, as in `deactivateActive` below:
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
   * One transaction, because the three writes are one effect: recording the renewal, retiring the
   * previous link, and bringing the new one into being. A failure anywhere rolls all three back, so
   * the previous link keeps working exactly as before and nothing claims a renewal that did not
   * happen (FR-014).
   *
   * The previous link is **deleted**, not updated in place. Deleting treats a pending user who holds
   * no link at all — one seeded before invitations existed — exactly like any other, and leaves
   * `created_at` meaning "when this link was issued". The `user_id` unique index still guarantees a
   * single row, and the deleted digest can never be looked up again, which is what makes the previous
   * link stop working in the very commit that issues the new one (FR-003).
   *
   * **The `users` row lock is the serialization point for a pending user's link.** Every write that
   * consumes or retires one — acceptance (GH-8), cancellation (GH-12) — must take the same lock (or
   * guard on `access_status = 'PENDING'`), and acceptance must re-read the token by its digest
   * *under* that lock. Then a renewal racing an acceptance of the previous link resolves in lock
   * order and never both ways: renewal first, and the presented digest no longer exists; acceptance
   * first, and this method answers `NOT_PENDING`.
   */
  renewActivationLink(command: RenewActivationLinkCommand): Promise<RenewActivationLinkResult> {
    return User.transaction(async (trx) => {
      const renewedAt = command.renewedAt.toSQL({ includeOffset: false })

      // Read under the row lock before the write, for the two reasons `requirePasswordRenewal`
      // gives: the refusal must name the status the target holds, which a zero-row `UPDATE` cannot
      // tell apart from "no such row"; and on PostgreSQL the lock serializes concurrent renewals, so
      // the second one deletes the first one's link and exactly one survives — the last issued.
      const target = await User.query({ client: trx })
        .where('id', command.targetUserId)
        .forUpdate()
        .first()

      if (!target) {
        return { kind: 'NOT_FOUND' }
      }
      if (target.accessStatus !== 'PENDING') {
        return { kind: 'NOT_PENDING', accessStatus: target.accessStatus }
      }

      const [affectedRows] = await User.query({ client: trx })
        .where('id', command.targetUserId)
        .where('accessStatus', 'PENDING')
        .update({
          activationLinkRenewedAt: renewedAt,
          activationLinkRenewedByUserId: command.renewedByUserId,
          // The query-builder `.update()` bypasses the model's autoUpdate column hook, so the
          // bookkeeping timestamp is written by hand — as every other guarded write here does.
          updatedAt: renewedAt,
        })

      if (Number(affectedRows) !== 1) {
        // The row read above was PENDING, so a zero-row UPDATE means it moved on in between.
        // PostgreSQL cannot reach this — the `forUpdate()` above holds the row — but knex emits no
        // `FOR UPDATE` on SQLite, where a concurrent acceptance or cancellation would otherwise be
        // answered with a link for a user who is no longer pending.
        const current = await User.query({ client: trx }).where('id', command.targetUserId).first()

        return current
          ? { kind: 'NOT_PENDING', accessStatus: current.accessStatus }
          : { kind: 'NOT_FOUND' }
      }

      await UserActivationToken.query({ client: trx })
        .where('userId', command.targetUserId)
        .delete()

      const activationToken = await UserActivationToken.create(
        {
          userId: command.targetUserId,
          hash: command.activationTokenHash,
          expiresAt: command.activationTokenExpiresAt,
        },
        { client: trx },
      )

      const user = await preloadAccessHistory(
        User.query({ client: trx }).where('id', command.targetUserId),
      ).firstOrFail()

      return { kind: 'RENEWED', user, activationToken }
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
   * Two concurrency controls, for two different races.
   *
   * Two deactivations of the *same* user are settled by the guard, exactly as in `renewPassword`
   * above: `WHERE access_status = 'ACTIVE'` records one deactivation, because the loser matches
   * zero rows. The re-read that follows a zero-row update is only there to name the reason; it
   * never decides the outcome, so there is no check-then-act window to lose.
   *
   * Two administrators deactivating *each other* are not: each `UPDATE` touches a different row, so
   * neither waits for the other, and under READ COMMITTED a check on the actor would read a snapshot
   * where the other administrator is still active — both land, and the organization is left without
   * an organization admin. So the actor's and the target's rows are locked first, and the actor is
   * re-read under that lock: whichever request queues second reads the first one's committed result
   * and finds its own actor gone. The deactivation takes effect only while its actor is still an
   * active organization admin; with `SELF` already refused, that actor is the organization admin the
   * write leaves behind.
   *
   * The transaction is also there because recording the deactivation and revoking the user's
   * remembered connections are two statements that must not be separable: a revocation that failed
   * after the `UPDATE` had committed would leave a credential restoring access for its full 30 days
   * to someone who has just been told they have none.
   */
  deactivateActive(command: DeactivateUserCommand): Promise<DeactivateUserResult> {
    return User.transaction(async (trx) => {
      const locked = await this.lockUsers(trx, [command.deactivatedByUserId, command.id])
      const actorId = command.deactivatedByUserId.toLowerCase()
      const actor = locked.find((user) => user.id.toLowerCase() === actorId)

      // Before anything about the target is observed: an actor who lost the entitlement is told
      // nothing about the user they were deactivating. Status and role are all that entitle, as in
      // `UserPolicy.deactivate` — a password renewal requirement changes neither — and a demotion or
      // deactivation committed before the lock is exactly what this re-read is here to see.
      if (actor?.accessStatus !== 'ACTIVE' || actor.role !== 'ORGANIZATION_ADMIN') {
        return { kind: 'ACTOR_NOT_ENTITLED' }
      }

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
   * `deactivateActive` with the guard reversed, and it inherits that method's argument: `WHERE
   * access_status = 'DEACTIVATED'` is the eligibility rule and the concurrency control at once, so
   * two racing reactivations match one row between them. The re-read after a zero-row update only
   * names the reason; it never decides the outcome.
   *
   * One statement writes the status, the reactivation event, and the password renewal requirement,
   * so an active user whose pre-deactivation credential works unchallenged is not a state this write
   * can leave behind, even halfway. The requirement is stamped with the reactivation instant: the
   * column is read as a boolean everywhere, and what the record presents as its origin is each
   * event's own pair of columns. `deactivated_*` and `password_reset_*` stay — they record events
   * that happened — and the password is not touched: the user signs in with it and renews.
   *
   * The remembered connections are deleted in the same transaction although `deactivateActive`
   * already deleted them and a deactivated user cannot create one: a user deactivated before that
   * revocation existed would otherwise carry a 30-day credential straight through the reactivation.
   * `session_reactivation.ts` stamps a restored session with the current reactivation, which is only
   * safe because no remembered connection from before it survives this commit.
   */
  reactivateDeactivated(command: ReactivateUserCommand): Promise<ReactivateUserResult> {
    return User.transaction(async (trx) => {
      const changedAt = command.reactivatedAt.toSQL({ includeOffset: false })
      const [affectedRows] = await User.query({ client: trx })
        .where('id', command.id)
        .where('accessStatus', 'DEACTIVATED')
        .update({
          accessStatus: 'ACTIVE',
          reactivatedAt: changedAt,
          reactivatedByUserId: command.reactivatedByUserId,
          passwordRenewalRequiredAt: changedAt,
          // The query-builder `.update()` bypasses the model's autoUpdate column hook, so the
          // bookkeeping timestamp is written by hand — as every other guarded write here does.
          updatedAt: changedAt,
        })

      if (Number(affectedRows) !== 1) {
        const user = await User.query({ client: trx }).where('id', command.id).first()

        return user
          ? { kind: 'NOT_DEACTIVATED', accessStatus: user.accessStatus }
          : { kind: 'NOT_FOUND' }
      }

      await this.revokeEveryRememberedConnection(trx, command.id)

      // Reloaded with every lifecycle actor resolved, for the reason `deactivateActive` gives — and
      // here the deactivation this reverses must arrive resolved alongside the reactivation.
      const user = await preloadAccessHistory(
        User.query({ client: trx }).where('id', command.id),
      ).firstOrFail()

      return { kind: 'REACTIVATED', user }
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
   * `cancelPendingInvitation` run backwards, and it borrows that method's reasons. The guard
   * `WHERE access_status = 'CANCELLED'` is the eligibility rule and the concurrency control at once:
   * two racing restorations match one row between them — the loser re-evaluates the `WHERE` once the
   * winner commits, finds `PENDING`, and matches nothing — so exactly one link is ever issued. A
   * target that was restored, removed, or otherwise moved on after the workbench listed it matches
   * none. No `SELECT … FOR UPDATE` is needed: the renewal takes one because it changes no status and
   * so has nothing to guard on.
   *
   * The transaction makes the status change and the new link inseparable (FR-007): a pending user
   * left without a link by a restoration that did not complete, or a cancelled user holding one, is a
   * half-restored invitation.
   *
   * Every token the user still holds is **deleted before** the new one is inserted. GH-12 already
   * deleted the link at cancellation, so this is normally a no-op — but acceptance (GH-8) takes any
   * live token of a *pending* user, and a token that survived a cancellation would come back to life
   * the moment its user is pending again (FR-006). The delete makes that impossible whatever state a
   * legacy or seeded row is in, and keeps the `user_id` unique index from turning such a row into a
   * failure.
   *
   * A removal racing this write resolves in row-lock order: restoration first, and the removal then
   * deletes a pending user, the new token going with it (`ON DELETE CASCADE`); removal first, and
   * this `UPDATE` matches nothing.
   */
  restoreCancelledInvitation(
    command: RestoreCancelledInvitationCommand,
  ): Promise<RestoreCancelledInvitationResult> {
    return User.transaction(async (trx) => {
      const changedAt = command.restoredAt.toSQL({ includeOffset: false })
      const [affectedRows] = await User.query({ client: trx })
        .where('id', command.id)
        .where('accessStatus', 'CANCELLED')
        .update({
          accessStatus: 'PENDING',
          invitationRestoredAt: changedAt,
          invitationRestoredByUserId: command.restoredByUserId,
          invitationRestorationComment: command.comment,
          // The query-builder `.update()` bypasses the model's autoUpdate column hook, so the
          // bookkeeping timestamp is written by hand — as every other guarded write here does.
          updatedAt: changedAt,
        })

      if (Number(affectedRows) !== 1) {
        // Only names the reason; the guard above already decided the outcome, so there is no
        // check-then-act window here to lose. No token is deleted or inserted.
        const current = await User.query({ client: trx }).where('id', command.id).first()

        return current
          ? { kind: 'NOT_CANCELLED', accessStatus: current.accessStatus }
          : { kind: 'NOT_FOUND' }
      }

      await UserActivationToken.query({ client: trx }).where('userId', command.id).delete()

      const activationToken = await UserActivationToken.create(
        {
          userId: command.id,
          hash: command.activationTokenHash,
          expiresAt: command.activationTokenExpiresAt,
        },
        { client: trx },
      )

      // Reloaded with every lifecycle actor resolved, for the reason `deactivateActive` gives: the
      // response projects the whole access history, and a relation left unpreloaded would serialize
      // as `null`.
      const user = await preloadAccessHistory(
        User.query({ client: trx }).where('id', command.id),
      ).firstOrFail()

      return { kind: 'RESTORED', user, activationToken }
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
   * Locked by id, as `LucidWarehouseRepository.lockWarehouses` locks its rows, so that concurrent
   * writes over overlapping sets of users always take the locks in the same order and queue behind
   * each other rather than deadlock: two administrators deactivating each other would otherwise each
   * hold their own row and wait on the other's, and one of them would get a 500.
   *
   * `FOR NO KEY UPDATE` rather than `FOR UPDATE`: it still conflicts with itself and with every
   * `UPDATE` of these rows, which is all the queueing needs, but not with the `FOR KEY SHARE` a
   * foreign-key check takes on the user it points to. `FOR UPDATE` would: an administrator resetting
   * the password of the administrator deactivating them holds that row and writes
   * `password_reset_by_user_id` pointing back at the row locked here, and each would wait on the
   * other until PostgreSQL aborted one. Lucid wraps `forUpdate()` only, hence the knex query.
   *
   * Any write that can take the organization admin role or active access away from a user must
   * decide under this same lock, or it can interleave with a deactivation and leave the organization
   * without an active organization admin. `changeRole` does, through
   * `lockTargetAndActiveOrganizationAdmins`: the same clause in the same order, over a set that
   * always includes a row locked here.
   *
   * A no-op on SQLite, like `findByIdForUpdate` above; PostgreSQL is where it earns its place — and
   * the only place it is proven, by the concurrent runs in the GH-21 quickstart: on the test
   * database, removing the lock or its order fails nothing.
   */
  private lockUsers(trx: TransactionClientContract, ids: string[]) {
    const query = User.query({ client: trx }).whereIn('id', ids).orderBy('id')
    query.knexQuery.forNoKeyUpdate()

    return query
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

  /**
   * Runs inside the caller's transaction, never its own: replacing the credential and revoking the
   * connections established under it are one indivisible effect. A revocation that failed after the
   * `UPDATE` had committed would leave a credential restoring access for its full 30 days under a
   * password the user has just replaced — the very window a password change exists to close.
   */
  async applyOwnPassword(command: ApplyOwnPasswordCommand): Promise<User> {
    const { client } = command

    await User.query({ client })
      .where('id', command.id)
      .update({
        password: command.hashedPassword,
        // The query-builder `.update()` bypasses the model's autoUpdate column hook, so the
        // bookkeeping timestamp is written by hand — as every other guarded write here does.
        updatedAt: command.changedAt.toSQL({ includeOffset: false }),
      })

    const revocation = client.from('remember_me_tokens').where('tokenable_id', command.id)

    if (command.keptRememberedConnectionId !== null) {
      revocation.whereNot('id', command.keptRememberedConnectionId)
    }

    await revocation.delete()

    return User.query({ client }).where('id', command.id).firstOrFail()
  }
}
