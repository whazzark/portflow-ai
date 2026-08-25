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
}
