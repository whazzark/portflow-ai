import type { Route } from '@tuyau/core/types'

export type TransportCompanyDto = Route.Response<'transport_companies.index'>['data'][number]
export type TransportCompanyLifecycle = 'available' | 'archived'
// The union of both bulk lifecycle route responses, not just archive_many: one bulk toolbar
// component now submits either direction. The two shapes are structurally identical today, so
// this union collapses to one type; it exists so a future divergence fails typecheck here instead
// of quietly mistyping one direction as the other.
export type BulkTransportCompanyLifecycleResult =
  | Route.Response<'transport_companies.archive_many'>['data']
  | Route.Response<'transport_companies.reactivate_many'>['data']
export type BulkTransportCompanyLifecycleBlocker =
  BulkTransportCompanyLifecycleResult['blockedCompanies'][number]
