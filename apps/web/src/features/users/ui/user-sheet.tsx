import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { UserDto } from '@/features/users/types'
import { UserAccessRecord } from '@/features/users/ui/user-access-record'

type UserSheetProps = {
  /** Resolved from the retrieved collection — this feature adds no per-user consultation seam. */
  user?: UserDto
  userId?: string
  onClose: () => void
}

export function UserSheet({ user, userId, onClose }: UserSheetProps) {
  return (
    <Sheet open={Boolean(userId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-hidden sm:max-w-lg">
        {user ? (
          <UserAccessRecord user={user} />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Unable to load user</SheetTitle>
              <SheetDescription>
                The selected user could not be restored from the current list.
              </SheetDescription>
            </SheetHeader>
            <Alert variant="destructive">
              <AlertTitle>User record unavailable</AlertTitle>
              <AlertDescription>The user is no longer available in the list.</AlertDescription>
            </Alert>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
