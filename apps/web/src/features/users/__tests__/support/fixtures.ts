import type { UserDto } from '@/features/users/types'

export const API_BASE_URL = 'http://localhost:3333'

export const ORGANIZATION_ADMIN = {
  id: 'viewer-organization-admin',
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'claire.martin@portflow.test',
  role: 'ORGANIZATION_ADMIN',
  accessStatus: 'ACTIVE',
}

export const OPERATIONS_ADMIN = {
  ...ORGANIZATION_ADMIN,
  id: 'viewer-operations-admin',
  role: 'OPERATIONS_ADMIN',
  email: 'operations.admin@portflow.test',
}

export const OPERATIONS_LEAD = {
  ...ORGANIZATION_ADMIN,
  id: 'viewer-operations-lead',
  role: 'OPERATIONS_LEAD',
  email: 'operations.lead@portflow.test',
}

export const OBSERVER = {
  ...ORGANIZATION_ADMIN,
  id: 'viewer-observer',
  role: 'OBSERVER',
  email: 'observer@portflow.test',
}

export const RESPONSIBLE_ADMIN = { id: 'admin-1', firstName: 'Yann', lastName: 'Le Goff' }

/** The instant a deactivation staged by the test helpers records. */
export const DEACTIVATED_AT = '2026-09-10T09:04:22.000Z'

/** The instant a cancellation staged by the test helpers records. */
export const CANCELLED_AT = '2026-09-11T14:03:27.000Z'

const NO_LIFECYCLE = {
  invitedAt: null,
  invitedBy: null,
  activatedAt: null,
  activatedBy: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationComment: null,
  deactivatedAt: null,
  deactivatedBy: null,
  reactivatedAt: null,
  reactivatedBy: null,
}

/**
 * One user per access status, spanning every role, with recorded and unrecorded lifecycle events —
 * including an event whose responsible administrator was never recorded.
 */
export const USERS: UserDto[] = [
  {
    id: 'active-1',
    firstName: 'Amélie',
    lastName: 'Bernard',
    email: 'amelie.bernard@portflow.test',
    role: 'ORGANIZATION_ADMIN',
    accessStatus: 'ACTIVE',
    ...NO_LIFECYCLE,
    invitedAt: '2026-01-12T09:00:00.000Z',
    invitedBy: RESPONSIBLE_ADMIN,
    activatedAt: '2026-01-12T14:31:00.000Z',
    // Recorded without a responsible administrator: the event must still be presented.
    activatedBy: null,
  },
  {
    id: 'active-2',
    firstName: 'Bruno',
    lastName: 'Costa',
    email: 'bruno.costa@portflow.test',
    role: 'OPERATIONS_LEAD',
    accessStatus: 'ACTIVE',
    ...NO_LIFECYCLE,
    activatedAt: '2026-02-03T08:15:00.000Z',
    activatedBy: RESPONSIBLE_ADMIN,
  },
  {
    id: 'pending-1',
    firstName: 'Chloé',
    lastName: 'Durand',
    email: 'chloe.durand@portflow.test',
    role: 'OBSERVER',
    accessStatus: 'PENDING',
    ...NO_LIFECYCLE,
    invitedAt: '2026-03-01T10:00:00.000Z',
    invitedBy: RESPONSIBLE_ADMIN,
  },
  {
    id: 'deactivated-1',
    firstName: 'David',
    lastName: 'Évrard',
    email: 'david.evrard@portflow.test',
    role: 'OPERATIONS_ADMIN',
    accessStatus: 'DEACTIVATED',
    ...NO_LIFECYCLE,
    invitedAt: '2025-11-02T09:00:00.000Z',
    invitedBy: RESPONSIBLE_ADMIN,
    activatedAt: '2025-11-03T09:00:00.000Z',
    activatedBy: RESPONSIBLE_ADMIN,
    deactivatedAt: '2026-04-18T16:45:00.000Z',
    deactivatedBy: RESPONSIBLE_ADMIN,
  },
  {
    id: 'cancelled-1',
    firstName: 'Élodie',
    lastName: 'Fabre',
    email: 'elodie.fabre@portflow.test',
    role: 'OBSERVER',
    accessStatus: 'CANCELLED',
    ...NO_LIFECYCLE,
    invitedAt: '2026-05-05T11:00:00.000Z',
    invitedBy: RESPONSIBLE_ADMIN,
    cancelledAt: '2026-05-09T11:30:00.000Z',
    cancelledBy: RESPONSIBLE_ADMIN,
    cancellationComment: 'Took a position elsewhere before starting.',
  },
]

export const ACTIVE_USERS = USERS.filter((user) => user.accessStatus === 'ACTIVE')

/**
 * What an operations admin receives: the active users, identity block only, with no lifecycle key
 * present at all.
 */
/**
 * An active user who already owes a renewal from a reset, with the administrator who performed it.
 * Kept out of `USERS` so the default collection stays the one `#4`'s tests describe.
 */
export const RESET_USER: UserDto = {
  id: 'active-reset',
  firstName: 'Gaël',
  lastName: 'Hamon',
  email: 'gael.hamon@portflow.test',
  role: 'OPERATIONS_LEAD',
  accessStatus: 'ACTIVE',
  ...NO_LIFECYCLE,
  invitedAt: '2026-01-04T09:00:00.000Z',
  invitedBy: RESPONSIBLE_ADMIN,
  activatedAt: '2026-01-05T09:00:00.000Z',
  activatedBy: RESPONSIBLE_ADMIN,
  passwordResetAt: '2026-06-01T10:00:00.000Z',
  passwordResetBy: RESPONSIBLE_ADMIN,
  passwordRenewalRequired: true,
} as UserDto

/** The same user before any reset: no event, and no requirement outstanding. */
export const RESETTABLE_USER: UserDto = {
  ...RESET_USER,
  id: 'active-resettable',
  firstName: 'Inès',
  lastName: 'Joly',
  email: 'ines.joly@portflow.test',
  passwordResetAt: null,
  passwordResetBy: null,
  passwordRenewalRequired: false,
} as UserDto

export const USERS_WITH_RESET: UserDto[] = [...USERS, RESET_USER, RESETTABLE_USER]

/**
 * What an operations admin receives for the same users: identity only. The reset keys are **absent**
 * rather than null, exactly as every lifecycle key is.
 */
export const RESET_USERS_WITHOUT_LIFECYCLE = [RESET_USER, RESETTABLE_USER].map(
  ({ id, firstName, lastName, email, role, accessStatus }) => ({
    id,
    firstName,
    lastName,
    email,
    role,
    accessStatus,
  }),
) as UserDto[]

export const ACTIVE_USERS_WITHOUT_LIFECYCLE = ACTIVE_USERS.map(
  ({ id, firstName, lastName, email, role, accessStatus }) => ({
    id,
    firstName,
    lastName,
    email,
    role,
    accessStatus,
  }),
) as UserDto[]

/**
 * A pending user whose activation link is still valid and has never been renewed. The expiry sits
 * far in the future so the fixture stays valid whatever day the suite runs.
 */
export const RENEWABLE_USER: UserDto = {
  id: 'pending-renewable',
  firstName: 'Karim',
  lastName: 'Lemoine',
  email: 'karim.lemoine@portflow.test',
  role: 'OPERATIONS_LEAD',
  accessStatus: 'PENDING',
  ...NO_LIFECYCLE,
  invitedAt: '2026-09-01T09:00:00.000Z',
  invitedBy: RESPONSIBLE_ADMIN,
  activationLinkRenewedAt: null,
  activationLinkRenewedBy: null,
  activationLinkExpiresAt: '2099-01-01T09:00:00.000Z',
} as UserDto

/** A pending user whose link an administrator already renewed once. */
export const RENEWED_USER: UserDto = {
  ...RENEWABLE_USER,
  id: 'pending-renewed',
  firstName: 'Léa',
  lastName: 'Marchand',
  email: 'lea.marchand@portflow.test',
  activationLinkRenewedAt: '2026-09-05T10:00:00.000Z',
  activationLinkRenewedBy: RESPONSIBLE_ADMIN,
} as UserDto

/** A pending user whose link expired without being renewed. */
export const EXPIRED_LINK_USER: UserDto = {
  ...RENEWABLE_USER,
  id: 'pending-expired',
  firstName: 'Maël',
  lastName: 'Nicolas',
  email: 'mael.nicolas@portflow.test',
  activationLinkExpiresAt: '2020-01-01T09:00:00.000Z',
} as UserDto

/** A pending user holding no link at all — one seeded before invitations existed. */
export const NO_LINK_USER: UserDto = {
  ...RENEWABLE_USER,
  id: 'pending-no-link',
  firstName: 'Nora',
  lastName: 'Olivier',
  email: 'nora.olivier@portflow.test',
  activationLinkExpiresAt: null,
} as UserDto

export const USERS_WITH_PENDING_LINKS: UserDto[] = [
  ...USERS,
  RENEWABLE_USER,
  RENEWED_USER,
  EXPIRED_LINK_USER,
  NO_LINK_USER,
]
