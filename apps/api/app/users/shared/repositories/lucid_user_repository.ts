import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import User from '#models/user'

import UserRepository, {
  type CreateUserCommand,
  type DeactivateUserCommand,
  type DeactivateUserResult,
  type RenewPasswordCommand,
  type RenewPasswordResult,
} from './user_repository.ts'

export default class LucidUserRepository extends UserRepository {
  create(command: CreateUserCommand): Promise<User> {
    return User.create(command)
  }

  findByEmail(email: string): Promise<User | null> {
    return User.query().whereRaw('LOWER(email) = ?', [email.toLowerCase()]).first()
  }

  list(): Promise<User[]> {
    return User.query()
      .preload('invitedBy')
      .preload('activatedBy')
      .preload('cancelledBy')
      .preload('deactivatedBy')
      .preload('reactivatedBy')
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

      // Reloaded with the responsible administrator resolved, because the response projects the
      // access history and `deactivatedBy` is the field this very write produced.
      const user = await User.query({ client: trx })
        .where('id', command.id)
        .preload('deactivatedBy')
        .firstOrFail()

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
}
