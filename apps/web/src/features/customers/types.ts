import type { Route } from '@tuyau/core/types'

export type CustomerDto = Route.Response<'customers.index'>['data'][number]
export type BulkCustomerLifecycleResult = Route.Response<'customers.archive_many'>['data']
export type BulkCustomerLifecycleBlocker = BulkCustomerLifecycleResult['blockedCustomers'][number]
