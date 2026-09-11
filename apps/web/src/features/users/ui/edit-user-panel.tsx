import { ArrowLeftIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatFullName } from '@/features/users/helpers/name'
import type { UserDto } from '@/features/users/types'
import { EditUserForm, type EditUserValue } from '@/features/users/ui/edit-user-form'

type EditUserPanelProps = {
  user: UserDto
  onCancel: () => void
  onUpdate: (value: EditUserValue) => Promise<UserDto>
  onSuccess: (user: UserDto) => void
}

export function EditUserPanel({ user, onCancel, onUpdate, onSuccess }: EditUserPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <Button className="self-start" onClick={onCancel} size="sm" variant="ghost">
          <ArrowLeftIcon aria-hidden="true" />
          Back to details
        </Button>
        <SheetTitle>Edit user</SheetTitle>
        <SheetDescription>
          Correct {formatFullName(user)}'s name and email address, or change their role. Their
          access status is unchanged.
        </SheetDescription>
      </SheetHeader>
      <div className="px-4 pb-6">
        <EditUserForm onSuccess={onSuccess} onUpdate={onUpdate} user={user} />
      </div>
    </div>
  )
}
