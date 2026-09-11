/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'health.show': {
    methods: ["GET","HEAD"]
    pattern: '/health'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/health_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/health_controller').default['show']>>>
    }
  }
  'auth.login': {
    methods: ["POST"]
    pattern: '/api/v1/auth/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#auth/login/login_validator').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#auth/login/login_validator').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/login_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/login_controller').default['store']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'auth.invitation_acceptance.preview': {
    methods: ["POST"]
    pattern: '/api/v1/auth/invitation-acceptance/preview'
    types: {
      body: ExtractBody<InferInput<(typeof import('#auth/invitation_acceptance/invitation_acceptance_validator').invitationPreviewValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#auth/invitation_acceptance/invitation_acceptance_validator').invitationPreviewValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invitation_acceptance_controller').default['preview']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invitation_acceptance_controller').default['preview']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'auth.invitation_acceptance.store': {
    methods: ["POST"]
    pattern: '/api/v1/auth/invitation-acceptance'
    types: {
      body: ExtractBody<InferInput<(typeof import('#auth/invitation_acceptance/invitation_acceptance_validator').invitationAcceptanceValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#auth/invitation_acceptance/invitation_acceptance_validator').invitationAcceptanceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invitation_acceptance_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invitation_acceptance_controller').default['store']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'auth.me': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/auth/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/me_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/me_controller').default['show']>>>
    }
  }
  'auth.logout': {
    methods: ["POST"]
    pattern: '/api/v1/auth/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/logout_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/logout_controller').default['destroy']>>>
    }
  }
  'auth.password_renewal': {
    methods: ["POST"]
    pattern: '/api/v1/auth/password-renewal'
    types: {
      body: ExtractBody<InferInput<(typeof import('#auth/password_renewal/password_renewal_validator').passwordRenewalValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#auth/password_renewal/password_renewal_validator').passwordRenewalValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/password_renewal_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/password_renewal_controller').default['store']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'customers.store': {
    methods: ["POST"]
    pattern: '/api/v1/customers'
    types: {
      body: ExtractBody<InferInput<(typeof import('#customers/shared/customer_validator').createCustomerValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#customers/shared/customer_validator').createCustomerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['store']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'customers.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/customers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['index']>>>
    }
  }
  'customers.available': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/customers/available'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['available']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['available']>>>
    }
  }
  'customers.archive_many': {
    methods: ["POST"]
    pattern: '/api/v1/customers/archive'
    types: {
      body: ExtractBody<InferInput<(typeof import('#customers/shared/customer_validator').archiveCustomersValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#customers/shared/customer_validator').archiveCustomersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['archiveMany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['archiveMany']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'customers.reactivate_many': {
    methods: ["POST"]
    pattern: '/api/v1/customers/reactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#customers/shared/customer_validator').reactivateCustomersValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#customers/shared/customer_validator').reactivateCustomersValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['reactivateMany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['reactivateMany']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'customers.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/customers/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#customers/shared/customer_validator').updateCustomerValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#customers/shared/customer_validator').updateCustomerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['update']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'customers.archive': {
    methods: ["POST"]
    pattern: '/api/v1/customers/:id/archive'
    types: {
      body: ExtractBody<InferInput<(typeof import('#customers/shared/customer_validator').archiveCustomerValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#customers/shared/customer_validator').archiveCustomerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['archive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['archive']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'customers.reactivate': {
    methods: ["POST"]
    pattern: '/api/v1/customers/:id/reactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#customers/shared/customer_validator').reactivateCustomerValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#customers/shared/customer_validator').reactivateCustomerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['reactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['reactivate']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'transport_companies.store': {
    methods: ["POST"]
    pattern: '/api/v1/transport-companies'
    types: {
      body: ExtractBody<InferInput<(typeof import('#transport_companies/shared/transport_company_validator').createTransportCompanyValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#transport_companies/shared/transport_company_validator').createTransportCompanyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['store']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'transport_companies.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/transport-companies'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['index']>>>
    }
  }
  'transport_companies.available': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/transport-companies/available'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['available']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['available']>>>
    }
  }
  'transport_companies.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/transport-companies/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#transport_companies/shared/transport_company_validator').updateTransportCompanyValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#transport_companies/shared/transport_company_validator').updateTransportCompanyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['update']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'transport_companies.archive_many': {
    methods: ["POST"]
    pattern: '/api/v1/transport-companies/archive'
    types: {
      body: ExtractBody<InferInput<(typeof import('#transport_companies/shared/transport_company_validator').archiveTransportCompaniesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#transport_companies/shared/transport_company_validator').archiveTransportCompaniesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['archiveMany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['archiveMany']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'transport_companies.reactivate_many': {
    methods: ["POST"]
    pattern: '/api/v1/transport-companies/reactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#transport_companies/shared/transport_company_validator').reactivateTransportCompaniesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#transport_companies/shared/transport_company_validator').reactivateTransportCompaniesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['reactivateMany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['reactivateMany']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'transport_companies.archive': {
    methods: ["POST"]
    pattern: '/api/v1/transport-companies/:id/archive'
    types: {
      body: ExtractBody<InferInput<(typeof import('#transport_companies/shared/transport_company_validator').archiveTransportCompanyValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#transport_companies/shared/transport_company_validator').archiveTransportCompanyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['archive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['archive']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'transport_companies.reactivate': {
    methods: ["POST"]
    pattern: '/api/v1/transport-companies/:id/reactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#transport_companies/shared/transport_company_validator').reactivateTransportCompanyValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#transport_companies/shared/transport_company_validator').reactivateTransportCompanyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['reactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transport_companies_controller').default['reactivate']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'trucks.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/trucks'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['index']>>>
    }
  }
  'trucks.available': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/trucks/available'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['available']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['available']>>>
    }
  }
  'trucks.suspended': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/trucks/suspended'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['suspended']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['suspended']>>>
    }
  }
  'trucks.store': {
    methods: ["POST"]
    pattern: '/api/v1/trucks'
    types: {
      body: ExtractBody<InferInput<(typeof import('#trucks/shared/truck_validator').createTruckValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#trucks/shared/truck_validator').createTruckValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['store']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'trucks.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/trucks/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#trucks/shared/truck_validator').updateTruckValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#trucks/shared/truck_validator').updateTruckValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['update']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'trucks.archive_many': {
    methods: ["POST"]
    pattern: '/api/v1/trucks/archive'
    types: {
      body: ExtractBody<InferInput<(typeof import('#trucks/shared/truck_validator').archiveTrucksValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#trucks/shared/truck_validator').archiveTrucksValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['archiveMany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['archiveMany']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'trucks.archive': {
    methods: ["POST"]
    pattern: '/api/v1/trucks/:id/archive'
    types: {
      body: ExtractBody<InferInput<(typeof import('#trucks/shared/truck_validator').archiveTruckValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#trucks/shared/truck_validator').archiveTruckValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['archive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['archive']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'trucks.reactivate_many': {
    methods: ["POST"]
    pattern: '/api/v1/trucks/reactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#trucks/shared/truck_validator').reactivateTrucksValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#trucks/shared/truck_validator').reactivateTrucksValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['reactivateMany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['reactivateMany']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'trucks.reactivate': {
    methods: ["POST"]
    pattern: '/api/v1/trucks/:id/reactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#trucks/shared/truck_validator').reactivateTruckValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#trucks/shared/truck_validator').reactivateTruckValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['reactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['reactivate']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'trucks.suspend': {
    methods: ["POST"]
    pattern: '/api/v1/trucks/:id/suspend'
    types: {
      body: ExtractBody<InferInput<(typeof import('#trucks/shared/truck_validator').suspendTruckValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#trucks/shared/truck_validator').suspendTruckValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['suspend']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['suspend']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'trucks.return_to_service': {
    methods: ["POST"]
    pattern: '/api/v1/trucks/:id/return-to-service'
    types: {
      body: ExtractBody<InferInput<(typeof import('#trucks/shared/truck_validator').returnTruckToServiceValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#trucks/shared/truck_validator').returnTruckToServiceValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['returnToService']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/trucks_controller').default['returnToService']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'discharges.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/discharges'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/discharges_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/discharges_controller').default['index']>>>
    }
  }
  'discharges.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/discharges/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/discharges_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/discharges_controller').default['show']>>>
    }
  }
  'users.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/users'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['index']>>>
    }
  }
  'users.store': {
    methods: ["POST"]
    pattern: '/api/v1/users'
    types: {
      body: ExtractBody<InferInput<(typeof import('#users/invite/invite_user_validator').inviteUserValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#users/invite/invite_user_validator').inviteUserValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['store']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'users.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/users/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#users/shared/user_validator').updateUserIdentityValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#users/shared/user_validator').updateUserIdentityValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['update']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'users.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/users/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#users/removal/remove_user_validator').removeUserValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#users/removal/remove_user_validator').removeUserValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['destroy']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'users.deactivate': {
    methods: ["POST"]
    pattern: '/api/v1/users/:id/deactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#users/deactivate/deactivate_user_validator').deactivateUserValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#users/deactivate/deactivate_user_validator').deactivateUserValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['deactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['deactivate']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'users.cancel_invitation': {
    methods: ["POST"]
    pattern: '/api/v1/users/:id/cancel-invitation'
    types: {
      body: ExtractBody<InferInput<(typeof import('#users/cancel_invitation/cancel_user_invitation_validator').cancelUserInvitationValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#users/cancel_invitation/cancel_user_invitation_validator').cancelUserInvitationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['cancelInvitation']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['cancelInvitation']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'users.change_role': {
    methods: ["PATCH"]
    pattern: '/api/v1/users/:id/role'
    types: {
      body: ExtractBody<InferInput<(typeof import('#users/shared/user_validator').changeUserRoleValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#users/shared/user_validator').changeUserRoleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['changeRole']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['changeRole']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'users.password_reset': {
    methods: ["POST"]
    pattern: '/api/v1/users/:id/password-reset'
    types: {
      body: ExtractBody<InferInput<(typeof import('#users/password_reset/reset_user_password_validator').resetUserPasswordValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#users/password_reset/reset_user_password_validator').resetUserPasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['resetPassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['resetPassword']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'docks.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/docks'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['index']>>>
    }
  }
  'docks.store': {
    methods: ["POST"]
    pattern: '/api/v1/docks'
    types: {
      body: ExtractBody<InferInput<(typeof import('#docks/shared/dock_validator').createDockValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#docks/shared/dock_validator').createDockValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['store']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'docks.available': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/docks/available'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['available']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['available']>>>
    }
  }
  'docks.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/docks/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#docks/shared/dock_validator').updateDockValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#docks/shared/dock_validator').updateDockValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['update']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'docks.archive_many': {
    methods: ["POST"]
    pattern: '/api/v1/docks/archive'
    types: {
      body: ExtractBody<InferInput<(typeof import('#docks/shared/dock_validator').archiveDocksValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#docks/shared/dock_validator').archiveDocksValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['archiveMany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['archiveMany']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'docks.archive': {
    methods: ["POST"]
    pattern: '/api/v1/docks/:id/archive'
    types: {
      body: ExtractBody<InferInput<(typeof import('#docks/shared/dock_validator').archiveDockValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#docks/shared/dock_validator').archiveDockValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['archive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['archive']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'docks.reactivate_many': {
    methods: ["POST"]
    pattern: '/api/v1/docks/reactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#docks/shared/dock_validator').reactivateDocksValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#docks/shared/dock_validator').reactivateDocksValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['reactivateMany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['reactivateMany']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'docks.reactivate': {
    methods: ["POST"]
    pattern: '/api/v1/docks/:id/reactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#docks/shared/dock_validator').reactivateDockValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#docks/shared/dock_validator').reactivateDockValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['reactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['reactivate']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'weighing_areas.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/weighing-areas'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['index']>>>
    }
  }
  'weighing_areas.store': {
    methods: ["POST"]
    pattern: '/api/v1/weighing-areas'
    types: {
      body: ExtractBody<InferInput<(typeof import('#weighing_areas/shared/weighing_area_validator').createWeighingAreaValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#weighing_areas/shared/weighing_area_validator').createWeighingAreaValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['store']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'weighing_areas.available': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/weighing-areas/available'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['available']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['available']>>>
    }
  }
  'weighing_areas.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/weighing-areas/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#weighing_areas/shared/weighing_area_validator').updateWeighingAreaValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#weighing_areas/shared/weighing_area_validator').updateWeighingAreaValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['update']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'weighing_areas.archive_many': {
    methods: ["POST"]
    pattern: '/api/v1/weighing-areas/archive'
    types: {
      body: ExtractBody<InferInput<(typeof import('#weighing_areas/shared/weighing_area_validator').archiveWeighingAreasValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#weighing_areas/shared/weighing_area_validator').archiveWeighingAreasValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['archiveMany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['archiveMany']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'weighing_areas.archive': {
    methods: ["POST"]
    pattern: '/api/v1/weighing-areas/:id/archive'
    types: {
      body: ExtractBody<InferInput<(typeof import('#weighing_areas/shared/weighing_area_validator').archiveWeighingAreaValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#weighing_areas/shared/weighing_area_validator').archiveWeighingAreaValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['archive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['archive']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'weighing_areas.reactivate_many': {
    methods: ["POST"]
    pattern: '/api/v1/weighing-areas/reactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#weighing_areas/shared/weighing_area_validator').reactivateWeighingAreasValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#weighing_areas/shared/weighing_area_validator').reactivateWeighingAreasValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['reactivateMany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['reactivateMany']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'weighing_areas.reactivate': {
    methods: ["POST"]
    pattern: '/api/v1/weighing-areas/:id/reactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#weighing_areas/shared/weighing_area_validator').reactivateWeighingAreaValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#weighing_areas/shared/weighing_area_validator').reactivateWeighingAreaValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['reactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/weighing_areas_controller').default['reactivate']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'warehouse_doors.store': {
    methods: ["POST"]
    pattern: '/api/v1/warehouse-doors'
    types: {
      body: ExtractBody<InferInput<(typeof import('#warehouse_doors/shared/warehouse_door_validator').createWarehouseDoorValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#warehouse_doors/shared/warehouse_door_validator').createWarehouseDoorValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/warehouse_doors_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/warehouse_doors_controller').default['store']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'warehouse_doors.available': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/warehouse-doors/available'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/warehouse_doors_controller').default['available']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/warehouse_doors_controller').default['available']>>>
    }
  }
  'warehouse_doors.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/warehouse-doors/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#warehouse_doors/shared/warehouse_door_validator').updateWarehouseDoorValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#warehouse_doors/shared/warehouse_door_validator').updateWarehouseDoorValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/warehouse_doors_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/warehouse_doors_controller').default['update']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'warehouse_doors.archive_many': {
    methods: ["POST"]
    pattern: '/api/v1/warehouse-doors/archive'
    types: {
      body: ExtractBody<InferInput<(typeof import('#warehouse_doors/shared/warehouse_door_validator').archiveWarehouseDoorsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#warehouse_doors/shared/warehouse_door_validator').archiveWarehouseDoorsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/warehouse_doors_controller').default['archiveMany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/warehouse_doors_controller').default['archiveMany']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'warehouse_doors.archive': {
    methods: ["POST"]
    pattern: '/api/v1/warehouse-doors/:id/archive'
    types: {
      body: ExtractBody<InferInput<(typeof import('#warehouse_doors/shared/warehouse_door_validator').archiveWarehouseDoorValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#warehouse_doors/shared/warehouse_door_validator').archiveWarehouseDoorValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/warehouse_doors_controller').default['archive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/warehouse_doors_controller').default['archive']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'warehouse_doors.reactivate': {
    methods: ["POST"]
    pattern: '/api/v1/warehouse-doors/:id/reactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#warehouse_doors/shared/warehouse_door_validator').reactivateWarehouseDoorValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#warehouse_doors/shared/warehouse_door_validator').reactivateWarehouseDoorValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/warehouse_doors_controller').default['reactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/warehouse_doors_controller').default['reactivate']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'warehouses.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/warehouses'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/warehouses_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/warehouses_controller').default['index']>>>
    }
  }
  'warehouses.store': {
    methods: ["POST"]
    pattern: '/api/v1/warehouses'
    types: {
      body: ExtractBody<InferInput<(typeof import('#warehouses/shared/warehouse_validator').createWarehouseValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#warehouses/shared/warehouse_validator').createWarehouseValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/warehouses_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/warehouses_controller').default['store']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'warehouses.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/warehouses/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#warehouses/shared/warehouse_validator').updateWarehouseValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#warehouses/shared/warehouse_validator').updateWarehouseValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/warehouses_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/warehouses_controller').default['update']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'warehouses.archive_many': {
    methods: ["POST"]
    pattern: '/api/v1/warehouses/archive'
    types: {
      body: ExtractBody<InferInput<(typeof import('#warehouses/shared/warehouse_validator').archiveWarehousesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#warehouses/shared/warehouse_validator').archiveWarehousesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/warehouses_controller').default['archiveMany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/warehouses_controller').default['archiveMany']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'warehouses.archive': {
    methods: ["POST"]
    pattern: '/api/v1/warehouses/:id/archive'
    types: {
      body: ExtractBody<InferInput<(typeof import('#warehouses/shared/warehouse_validator').archiveWarehouseValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#warehouses/shared/warehouse_validator').archiveWarehouseValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/warehouses_controller').default['archive']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/warehouses_controller').default['archive']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'warehouses.reactivate_many': {
    methods: ["POST"]
    pattern: '/api/v1/warehouses/reactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#warehouses/shared/warehouse_validator').reactivateWarehousesValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#warehouses/shared/warehouse_validator').reactivateWarehousesValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/warehouses_controller').default['reactivateMany']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/warehouses_controller').default['reactivateMany']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
  'warehouses.reactivate': {
    methods: ["POST"]
    pattern: '/api/v1/warehouses/:id/reactivate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#warehouses/shared/warehouse_validator').reactivateWarehouseValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#warehouses/shared/warehouse_validator').reactivateWarehouseValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/warehouses_controller').default['reactivate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/warehouses_controller').default['reactivate']>>> | { status: 422; response: { error: { code: 'E_VALIDATION_ERROR'; message: string; details: Array<{ field: string; message: string; rule: string; index?: number; meta?: Record<string, unknown> }> } } }
    }
  }
}
