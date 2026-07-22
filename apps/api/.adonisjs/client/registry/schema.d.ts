/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

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
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/login_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'customers.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/customers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['show']>>>
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
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['archive']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/customers_controller').default['reactivate']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
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
  'docks.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/docks/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['show']>>>
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
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['archive']>>> | { status: 422; response: { errors: SimpleError[] } }
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
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/docks_controller').default['reactivate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
}
