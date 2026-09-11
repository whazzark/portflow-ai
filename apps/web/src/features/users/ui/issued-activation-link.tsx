import { createContext, type ReactNode, useContext, useState } from 'react'

import type { ActivationLinkDto, UserDto } from '@/features/users/types'
import { ActivationLinkDialog } from '@/features/users/ui/activation-link-dialog'

type IssuedActivationLink = { user: UserDto; activationLink: ActivationLinkDto }

const PresentActivationLinkContext = createContext<((issued: IssuedActivationLink) => void) | null>(
  null,
)

/**
 * Holds a renewed activation link at the level of the users page, where it outlives whatever the
 * renewal was started from.
 *
 * The renewal is started from a record or a row menu, and both can disappear while the outcome is on
 * screen: a Back in the browser closes the record, a refreshed collection re-renders the row. The
 * previous link is already dead by then, so the new one must not go with them — the reason the
 * invitation, too, keeps its outcome on the page rather than in the form that produced it.
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
          origin="renewal"
        />
      )}
    </PresentActivationLinkContext.Provider>
  )
}

/** Hands a renewed link to the page, which presents it once and forgets it on acknowledgement. */
export function usePresentActivationLink() {
  const present = useContext(PresentActivationLinkContext)

  if (!present) {
    throw new Error('usePresentActivationLink must be used within IssuedActivationLinkProvider')
  }

  return present
}
