import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { UserInvitationDto } from '@/features/users/types'
import { InviteUserForm, type InviteUserValues } from '@/features/users/ui/invite-user-form'

type InviteUserPanelProps = {
  onInvite: (value: InviteUserValues) => Promise<UserInvitationDto>
  onSuccess: (invitation: UserInvitationDto) => void
}

export function InviteUserPanel({ onInvite, onSuccess }: InviteUserPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="shrink-0 gap-1 border-b py-5 pr-14 pl-6">
        <SheetTitle className="font-semibold text-lg">Invite user</SheetTitle>
        <SheetDescription>
          The invited person activates their own access from a confidential link, and chooses their
          password themselves.
        </SheetDescription>
      </SheetHeader>
      <InviteUserForm onInvite={onInvite} onSuccess={onSuccess} />
    </div>
  )
}
