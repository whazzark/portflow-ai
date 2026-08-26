import type { Route } from '@tuyau/core/types'

export type UserDto = Route.Response<'users.index'>['data'][number]

export type UserAccessStatus = UserDto['accessStatus']
export type UserRole = UserDto['role']
