import { screen } from '@testing-library/react'

import { formatFullName } from '@/features/users/helpers/name'

/**
 * The signed-in user's entry at the foot of the sidebar: proof the application shell is shown, and
 * for whom.
 */
export function findUserMenuTrigger(user: { firstName: string; lastName: string }) {
  return screen.findByRole('button', { name: `Open user menu for ${formatFullName(user)}` })
}
