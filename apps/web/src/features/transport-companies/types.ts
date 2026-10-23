import type { Route } from '@tuyau/core/types'

export type TransportCompanyDto = Route.Response<'transport_companies.index'>['data'][number]
export type TransportCompanyLifecycle = 'available' | 'archived'
