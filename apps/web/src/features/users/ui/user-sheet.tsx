import { Sheet, SheetContent } from '@/components/ui/sheet'
import type { UserDto } from '@/features/users/types'
import { EditUserIdentityPanel } from '@/features/users/ui/edit-user-identity-panel'
import { UserAccessRecord } from '@/features/users/ui/user-access-record'
import type { UserIdentityValue } from '@/features/users/ui/user-identity-form'

type UserSheetProps = {
  /** Resolved from the retrieved collection — this feature adds no per-user consultation seam. */
  user?: UserDto
  mode: 'view' | 'edit'
  /** Whether this viewer may correct this user. The API stays authoritative either way. */
  canEdit: boolean
  onClose: () => void
  onEdit: () => void
  onCancelEdit: () => void
  onUpdate: (value: UserIdentityValue) => Promise<UserDto>
  onUpdated: (user: UserDto) => void
}

/**
 * The record is open exactly when a user of the visible view backs it: a userId naming no visible
 * user is dropped from the URL rather than presented as a failed load, so there is no unresolved
 * state for this sheet to report.
 */
export function UserSheet({
  user,
  mode,
  canEdit,
  onClose,
  onEdit,
  onCancelEdit,
  onUpdate,
  onUpdated,
}: UserSheetProps) {
  // A hand-typed `?mode=edit` opens nothing this viewer may not do: the panel falls back to the
  // record rather than presenting a form the API would refuse.
  const editing = mode === 'edit' && canEdit

  return (
    <Sheet open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-hidden" size="lg">
        {user &&
          (editing ? (
            <EditUserIdentityPanel
              onCancel={onCancelEdit}
              onSuccess={onUpdated}
              onUpdate={onUpdate}
              user={user}
            />
          ) : (
            <UserAccessRecord canEdit={canEdit} onEdit={onEdit} user={user} />
          ))}
      </SheetContent>
    </Sheet>
  )
}
