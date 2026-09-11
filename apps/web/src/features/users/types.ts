import type { Route } from '@tuyau/core/types'

export type UserDto = Route.Response<'users.index'>['data'][number]

export type UserAccessStatus = UserDto['accessStatus']
export type UserRole = UserDto['role']

/** The invitation outcome: the created pending user, and the link handed over once. */
export type UserInvitationDto = Route.Response<'users.store'>['data']

export type ActivationLinkDto = UserInvitationDto['activationLink']
