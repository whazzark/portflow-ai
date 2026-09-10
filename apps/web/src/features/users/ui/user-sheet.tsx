import { Sheet, SheetContent } from '@/components/ui/sheet'
import type { UserDto } from '@/features/users/types'
import { UserAccessRecord } from '@/features/users/ui/user-access-record'

type UserSheetProps = {
  /** Resolved from the retrieved collection — this feature adds no per-user consultation seam. */
  user?: UserDto
  onClose: () => void
}

/**
 * The record is open exactly when a user of the visible view backs it: a userId naming no visible
 * user is dropped from the URL rather than presented as a failed load, so there is no unresolved
 * state for this sheet to report.
 */
export function UserSheet({ user, onClose }: UserSheetProps) {
  return (
    <Sheet open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-hidden" size="lg">
        {user && <UserAccessRecord user={user} />}
      </SheetContent>
    </Sheet>
  )
}
