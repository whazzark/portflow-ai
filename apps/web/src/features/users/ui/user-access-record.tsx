import { ResourceDetailField } from '@/components/resource/resource-details'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { formatFullName } from '@/features/users/helpers/name'
import { USER_ACCESS_STATUS_LABELS, USER_ROLE_LABELS } from '@/features/users/helpers/user-labels'
import type { UserAccessStatus, UserDto } from '@/features/users/types'
import { UserAccessActions } from '@/features/users/ui/user-access-actions'
import { UserAccessHistory } from '@/features/users/ui/user-access-history'
import { UserAvatar } from '@/features/users/ui/user-avatar'
import { userAccessActions } from '@/features/users/user-access'

const ACCESS_STATUS_TONE: Record<
  UserAccessStatus,
  'success' | 'warning' | 'destructive' | 'neutral'
> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  DEACTIVATED: 'destructive',
  CANCELLED: 'neutral',
}

type UserAccessRecordProps = {
  user: UserDto
  /** `mayEditUserIdentity`'s answer, which the sheet also needs to gate a hand-typed edit mode. */
  canEdit: boolean
  onEdit: () => void
}

/**
 * Identity, role, access status, and the recorded access history, with the actions the viewer may
 * take on this user in the footer — the correction on the left, the access actions on the right, as
 * in the customer record. Invitation, cancellation, reactivation, and role change are still owned
 * by their own slices and are not offered here.
 *
 * A record with no action available renders no footer at all rather than an empty bordered bar.
 */
export function UserAccessRecord({ user, canEdit, onEdit }: UserAccessRecordProps) {
  const viewer = useAuthenticatedUser()
  const accessActions = userAccessActions(viewer, user)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="shrink-0 border-b">
        <SheetTitle className="flex items-center gap-3">
          <UserAvatar aria-hidden={true} size="sm" user={user} />
          {formatFullName(user)}
        </SheetTitle>
        <SheetDescription>{user.email}</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
          <ResourceDetailField label="Role" value={USER_ROLE_LABELS[user.role]} />
          <div className="grid gap-1">
            <dt className="text-muted-foreground text-sm">Access status</dt>
            <dd>
              <StatusIndicator
                label={USER_ACCESS_STATUS_LABELS[user.accessStatus]}
                variant={ACCESS_STATUS_TONE[user.accessStatus]}
              />
            </dd>
          </div>
        </dl>
        <Separator className="my-6" />
        <UserAccessHistory user={user} />
      </div>
      {(canEdit || accessActions.length > 0) && (
        <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:items-center sm:justify-between">
          {canEdit && <Button onClick={onEdit}>Edit</Button>}
          {/* Pushed right on its own too, so a record offering no correction keeps the access
              actions where they always are. */}
          <UserAccessActions actions={accessActions} className="sm:ml-auto" user={user} />
        </SheetFooter>
      )}
    </div>
  )
}
