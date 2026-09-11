import { ArrowLeftIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatFullName } from '@/features/users/helpers/name'
import type { UserDto } from '@/features/users/types'
import { UserIdentityForm, type UserIdentityValue } from '@/features/users/ui/user-identity-form'

type EditUserIdentityPanelProps = {
  user: UserDto
  onCancel: () => void
  onUpdate: (value: UserIdentityValue) => Promise<UserDto>
  onSuccess: (user: UserDto) => void
}

export function EditUserIdentityPanel({
  user,
  onCancel,
  onUpdate,
  onSuccess,
}: EditUserIdentityPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <Button className="self-start" onClick={onCancel} size="sm" variant="ghost">
          <ArrowLeftIcon aria-hidden="true" />
          Back to details
        </Button>
        <SheetTitle>Edit identity</SheetTitle>
        <SheetDescription>
          Correct {formatFullName(user)}'s name and email address. Their role and access status are
          unchanged.
        </SheetDescription>
      </SheetHeader>
      <div className="px-4 pb-6">
        <UserIdentityForm onSuccess={onSuccess} onUpdate={onUpdate} user={user} />
      </div>
    </div>
  )
}
