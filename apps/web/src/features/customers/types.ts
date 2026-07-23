import type { Route } from '@tuyau/core/types'

export type CustomerDto = Route.Response<'customers.index'>['data'][number]
