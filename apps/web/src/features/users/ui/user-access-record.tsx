import { ResourceDetailField } from '@/components/resource/resource-details'
import { Separator } from '@/components/ui/separator'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { formatFullName } from '@/features/users/helpers/name'
import { USER_ACCESS_STATUS_LABELS, USER_ROLE_LABELS } from '@/features/users/helpers/user-labels'
import type { UserAccessStatus, UserDto } from '@/features/users/types'
import { UserAccessActions } from '@/features/users/ui/user-access-actions'
import { UserAccessHistory } from '@/features/users/ui/user-access-history'
import { UserAvatar } from '@/features/users/ui/user-avatar'

const ACCESS_STATUS_TONE: Record<
  UserAccessStatus,
  'success' | 'warning' | 'destructive' | 'neutral'
> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  DEACTIVATED: 'destructive',
  CANCELLED: 'neutral',
}

/**
 * Identity, role, access status, and the recorded access history, with the access actions the
 * viewer may take on this user in the footer. Invitation, cancellation, reactivation, role change,
 * and identity update are still owned by their own slices and are not offered here.
 */
export function UserAccessRecord({ user }: { user: UserDto }) {
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
      <UserAccessActions user={user} />
    </div>
  )
}
