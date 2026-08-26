import type { UserAccessStatus, UserRole } from '@/features/users/types'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ORGANIZATION_ADMIN: 'Organization admin',
  OPERATIONS_ADMIN: 'Operations admin',
  OPERATIONS_LEAD: 'Operations lead',
  OBSERVER: 'Observer',
}

export const USER_ACCESS_STATUS_LABELS: Record<UserAccessStatus, string> = {
  ACTIVE: 'Active',
  PENDING: 'Pending',
  DEACTIVATED: 'Deactivated',
  CANCELLED: 'Cancelled',
}

/**
 * The access status views, in the order the workbench presents them. `active` leads because it is
 * the view selected on arrival.
 */
export const USER_STATUS_VIEWS = ['active', 'pending', 'deactivated', 'cancelled'] as const

export type UserStatusView = (typeof USER_STATUS_VIEWS)[number]

const VIEW_TO_ACCESS_STATUS: Record<UserStatusView, UserAccessStatus> = {
  active: 'ACTIVE',
  pending: 'PENDING',
  deactivated: 'DEACTIVATED',
  cancelled: 'CANCELLED',
}

export function toAccessStatus(view: UserStatusView): UserAccessStatus {
  return VIEW_TO_ACCESS_STATUS[view]
}

export function statusViewLabel(view: UserStatusView) {
  return USER_ACCESS_STATUS_LABELS[toAccessStatus(view)]
}

/** Accessible name of the table showing a view, for example `Active users`. */
export function statusViewTableLabel(view: UserStatusView) {
  return `${statusViewLabel(view)} users`
}

/** Empty state title for a view holding no user at all, for example `No active users`. */
export function statusViewEmptyTitle(view: UserStatusView) {
  return `No ${statusViewLabel(view).toLowerCase()} users`
}
