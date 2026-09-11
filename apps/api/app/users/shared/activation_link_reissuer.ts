import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import type User from '#models/user'

export type ReissueActivationLinkCommand = {
  user: User
  /** The corrected address the pending user is now reached at. */
  email: string
  /** The correction's transaction: the link and the identity commit together or not at all. */
  client: TransactionClientContract
}

export type ReissueActivationLinkResult = { kind: 'REISSUED' } | { kind: 'UNAVAILABLE' }

/**
 * Replaces the outstanding activation link of a pending user whose email address has just been
 * corrected, so that no link handed out under the previous address stays usable.
 *
 * GH-7 issues the link at invitation (`ActivationLinkIssuer`), but a replacement is a secret with a
 * single read: it has to reach the administrator in the correction's response and be shown to them
 * once, which this slice's contract does not carry. Until it does, the bound implementation reports
 * the capability unavailable, the correction rolls back, and the invariant this port protects holds
 * by construction rather than by hope.
 */
export default abstract class ActivationLinkReissuer {
  abstract reissueForCorrectedEmail(
    command: ReissueActivationLinkCommand,
  ): Promise<ReissueActivationLinkResult>
}

export class UnavailableActivationLinkReissuer extends ActivationLinkReissuer {
  reissueForCorrectedEmail(): Promise<ReissueActivationLinkResult> {
    return Promise.resolve({ kind: 'UNAVAILABLE' })
  }
}
