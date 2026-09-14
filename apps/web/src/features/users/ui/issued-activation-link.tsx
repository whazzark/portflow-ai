import { createContext, type ReactNode, useContext, useState } from 'react'

import type { ActivationLinkDto, UserDto } from '@/features/users/types'
import {
  ActivationLinkDialog,
  type ActivationLinkOrigin,
} from '@/features/users/ui/activation-link-dialog'

type IssuedActivationLink = {
  user: UserDto
  activationLink: ActivationLinkDto
  /** Which action issued it, for the one sentence that differs. The invitation keeps its own outcome. */
  origin: Exclude<ActivationLinkOrigin, 'invitation'>
}

const PresentActivationLinkContext = createContext<((issued: IssuedActivationLink) => void) | null>(
  null,
)

/**
 * Holds a renewed or restored activation link at the level of the users page, where it outlives
 * whatever the action was started from.
 *
 * Both are started from a record or a row menu, and both can disappear while the outcome is on
 * screen: a Back in the browser closes the record, a refreshed collection re-renders the row. A
 * restoration makes it certain rather than possible — the restored user leaves the cancelled view the
 * moment the collection refreshes, taking their record or row with them. The link must not go with
 * them — the reason the invitation, too, keeps its outcome on the page rather than in the form that
 * produced it.
 *
 * In component state rather than the URL, as the invitation's link is: the address bar is neither
 * private nor ephemeral, and a link with no second read cannot survive a reload anyway.
 */
export function IssuedActivationLinkProvider({ children }: { children: ReactNode }) {
  const [issued, setIssued] = useState<IssuedActivationLink | undefined>(undefined)

  return (
    <PresentActivationLinkContext.Provider value={setIssued}>
      {children}
      {issued && (
        <ActivationLinkDialog
          activationLink={issued.activationLink}
          invitedUser={issued.user}
          onAcknowledge={() => setIssued(undefined)}
          open={true}
          origin={issued.origin}
        />
      )}
    </PresentActivationLinkContext.Provider>
  )
}

/**
 * Hands a renewed or restored link to the page, which presents it once and forgets it on
 * acknowledgement.
 */
export function usePresentActivationLink() {
  const present = useContext(PresentActivationLinkContext)

  if (!present) {
    throw new Error('usePresentActivationLink must be used within IssuedActivationLinkProvider')
  }

  return present
}
