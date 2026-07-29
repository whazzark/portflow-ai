import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getInitials } from '@/features/users/helpers/name'

type UserAvatarProps = {
  user: { firstName: string; lastName: string }
  size?: 'default' | 'sm' | 'lg'
  'aria-hidden'?: boolean
}

export function UserAvatar({ user, size, 'aria-hidden': ariaHidden }: UserAvatarProps) {
  return (
    <Avatar aria-hidden={ariaHidden} size={size}>
      <AvatarFallback>{getInitials(user)}</AvatarFallback>
    </Avatar>
  )
}
