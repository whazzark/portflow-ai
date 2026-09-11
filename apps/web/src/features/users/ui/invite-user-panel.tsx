import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { UserInvitationDto } from '@/features/users/types'
import { InviteUserForm, type InviteUserValues } from '@/features/users/ui/invite-user-form'

type InviteUserPanelProps = {
  onInvite: (value: InviteUserValues) => Promise<UserInvitationDto>
  onSuccess: (invitation: UserInvitationDto) => void
}

export function InviteUserPanel({ onInvite, onSuccess }: InviteUserPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Invite user</SheetTitle>
        <SheetDescription>
          The invited person activates their own access from a confidential link, and chooses their
          password themselves.
        </SheetDescription>
      </SheetHeader>
      <div className="px-4">
        <InviteUserForm onInvite={onInvite} onSuccess={onSuccess} />
      </div>
    </div>
  )
}
