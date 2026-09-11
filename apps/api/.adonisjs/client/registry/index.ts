/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'health.show': {
    methods: ["GET","HEAD"],
    pattern: '/health',
    tokens: [{"old":"/health","type":0,"val":"health","end":""}],
    types: placeholder as Registry['health.show']['types'],
  },
  'auth.login': {
    methods: ["POST"],
    pattern: '/api/v1/auth/login',
    tokens: [{"old":"/api/v1/auth/login","type":0,"val":"api","end":""},{"old":"/api/v1/auth/login","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/login","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['auth.login']['types'],
  },
  'auth.me': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/auth/me',
    tokens: [{"old":"/api/v1/auth/me","type":0,"val":"api","end":""},{"old":"/api/v1/auth/me","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/me","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/me","type":0,"val":"me","end":""}],
    types: placeholder as Registry['auth.me']['types'],
  },
  'auth.logout': {
    methods: ["POST"],
    pattern: '/api/v1/auth/logout',
    tokens: [{"old":"/api/v1/auth/logout","type":0,"val":"api","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['auth.logout']['types'],
  },
  'auth.password_renewal': {
    methods: ["POST"],
    pattern: '/api/v1/auth/password-renewal',
    tokens: [{"old":"/api/v1/auth/password-renewal","type":0,"val":"api","end":""},{"old":"/api/v1/auth/password-renewal","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/password-renewal","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/password-renewal","type":0,"val":"password-renewal","end":""}],
    types: placeholder as Registry['auth.password_renewal']['types'],
  },
  'customers.store': {
    methods: ["POST"],
    pattern: '/api/v1/customers',
    tokens: [{"old":"/api/v1/customers","type":0,"val":"api","end":""},{"old":"/api/v1/customers","type":0,"val":"v1","end":""},{"old":"/api/v1/customers","type":0,"val":"customers","end":""}],
    types: placeholder as Registry['customers.store']['types'],
  },
  'customers.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/customers',
    tokens: [{"old":"/api/v1/customers","type":0,"val":"api","end":""},{"old":"/api/v1/customers","type":0,"val":"v1","end":""},{"old":"/api/v1/customers","type":0,"val":"customers","end":""}],
    types: placeholder as Registry['customers.index']['types'],
  },
  'customers.available': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/customers/available',
    tokens: [{"old":"/api/v1/customers/available","type":0,"val":"api","end":""},{"old":"/api/v1/customers/available","type":0,"val":"v1","end":""},{"old":"/api/v1/customers/available","type":0,"val":"customers","end":""},{"old":"/api/v1/customers/available","type":0,"val":"available","end":""}],
    types: placeholder as Registry['customers.available']['types'],
  },
  'customers.archive_many': {
    methods: ["POST"],
    pattern: '/api/v1/customers/archive',
    tokens: [{"old":"/api/v1/customers/archive","type":0,"val":"api","end":""},{"old":"/api/v1/customers/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/customers/archive","type":0,"val":"customers","end":""},{"old":"/api/v1/customers/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['customers.archive_many']['types'],
  },
  'customers.reactivate_many': {
    methods: ["POST"],
    pattern: '/api/v1/customers/reactivate',
    tokens: [{"old":"/api/v1/customers/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/customers/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/customers/reactivate","type":0,"val":"customers","end":""},{"old":"/api/v1/customers/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['customers.reactivate_many']['types'],
  },
  'customers.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/customers/:id',
    tokens: [{"old":"/api/v1/customers/:id","type":0,"val":"api","end":""},{"old":"/api/v1/customers/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/customers/:id","type":0,"val":"customers","end":""},{"old":"/api/v1/customers/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['customers.update']['types'],
  },
  'customers.archive': {
    methods: ["POST"],
    pattern: '/api/v1/customers/:id/archive',
    tokens: [{"old":"/api/v1/customers/:id/archive","type":0,"val":"api","end":""},{"old":"/api/v1/customers/:id/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/customers/:id/archive","type":0,"val":"customers","end":""},{"old":"/api/v1/customers/:id/archive","type":1,"val":"id","end":""},{"old":"/api/v1/customers/:id/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['customers.archive']['types'],
  },
  'customers.reactivate': {
    methods: ["POST"],
    pattern: '/api/v1/customers/:id/reactivate',
    tokens: [{"old":"/api/v1/customers/:id/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/customers/:id/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/customers/:id/reactivate","type":0,"val":"customers","end":""},{"old":"/api/v1/customers/:id/reactivate","type":1,"val":"id","end":""},{"old":"/api/v1/customers/:id/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['customers.reactivate']['types'],
  },
  'transport_companies.store': {
    methods: ["POST"],
    pattern: '/api/v1/transport-companies',
    tokens: [{"old":"/api/v1/transport-companies","type":0,"val":"api","end":""},{"old":"/api/v1/transport-companies","type":0,"val":"v1","end":""},{"old":"/api/v1/transport-companies","type":0,"val":"transport-companies","end":""}],
    types: placeholder as Registry['transport_companies.store']['types'],
  },
  'transport_companies.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/transport-companies',
    tokens: [{"old":"/api/v1/transport-companies","type":0,"val":"api","end":""},{"old":"/api/v1/transport-companies","type":0,"val":"v1","end":""},{"old":"/api/v1/transport-companies","type":0,"val":"transport-companies","end":""}],
    types: placeholder as Registry['transport_companies.index']['types'],
  },
  'transport_companies.available': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/transport-companies/available',
    tokens: [{"old":"/api/v1/transport-companies/available","type":0,"val":"api","end":""},{"old":"/api/v1/transport-companies/available","type":0,"val":"v1","end":""},{"old":"/api/v1/transport-companies/available","type":0,"val":"transport-companies","end":""},{"old":"/api/v1/transport-companies/available","type":0,"val":"available","end":""}],
    types: placeholder as Registry['transport_companies.available']['types'],
  },
  'transport_companies.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/transport-companies/:id',
    tokens: [{"old":"/api/v1/transport-companies/:id","type":0,"val":"api","end":""},{"old":"/api/v1/transport-companies/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/transport-companies/:id","type":0,"val":"transport-companies","end":""},{"old":"/api/v1/transport-companies/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['transport_companies.update']['types'],
  },
  'transport_companies.archive_many': {
    methods: ["POST"],
    pattern: '/api/v1/transport-companies/archive',
    tokens: [{"old":"/api/v1/transport-companies/archive","type":0,"val":"api","end":""},{"old":"/api/v1/transport-companies/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/transport-companies/archive","type":0,"val":"transport-companies","end":""},{"old":"/api/v1/transport-companies/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['transport_companies.archive_many']['types'],
  },
  'transport_companies.reactivate_many': {
    methods: ["POST"],
    pattern: '/api/v1/transport-companies/reactivate',
    tokens: [{"old":"/api/v1/transport-companies/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/transport-companies/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/transport-companies/reactivate","type":0,"val":"transport-companies","end":""},{"old":"/api/v1/transport-companies/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['transport_companies.reactivate_many']['types'],
  },
  'transport_companies.archive': {
    methods: ["POST"],
    pattern: '/api/v1/transport-companies/:id/archive',
    tokens: [{"old":"/api/v1/transport-companies/:id/archive","type":0,"val":"api","end":""},{"old":"/api/v1/transport-companies/:id/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/transport-companies/:id/archive","type":0,"val":"transport-companies","end":""},{"old":"/api/v1/transport-companies/:id/archive","type":1,"val":"id","end":""},{"old":"/api/v1/transport-companies/:id/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['transport_companies.archive']['types'],
  },
  'transport_companies.reactivate': {
    methods: ["POST"],
    pattern: '/api/v1/transport-companies/:id/reactivate',
    tokens: [{"old":"/api/v1/transport-companies/:id/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/transport-companies/:id/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/transport-companies/:id/reactivate","type":0,"val":"transport-companies","end":""},{"old":"/api/v1/transport-companies/:id/reactivate","type":1,"val":"id","end":""},{"old":"/api/v1/transport-companies/:id/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['transport_companies.reactivate']['types'],
  },
  'trucks.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trucks',
    tokens: [{"old":"/api/v1/trucks","type":0,"val":"api","end":""},{"old":"/api/v1/trucks","type":0,"val":"v1","end":""},{"old":"/api/v1/trucks","type":0,"val":"trucks","end":""}],
    types: placeholder as Registry['trucks.index']['types'],
  },
  'trucks.available': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trucks/available',
    tokens: [{"old":"/api/v1/trucks/available","type":0,"val":"api","end":""},{"old":"/api/v1/trucks/available","type":0,"val":"v1","end":""},{"old":"/api/v1/trucks/available","type":0,"val":"trucks","end":""},{"old":"/api/v1/trucks/available","type":0,"val":"available","end":""}],
    types: placeholder as Registry['trucks.available']['types'],
  },
  'trucks.suspended': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/trucks/suspended',
    tokens: [{"old":"/api/v1/trucks/suspended","type":0,"val":"api","end":""},{"old":"/api/v1/trucks/suspended","type":0,"val":"v1","end":""},{"old":"/api/v1/trucks/suspended","type":0,"val":"trucks","end":""},{"old":"/api/v1/trucks/suspended","type":0,"val":"suspended","end":""}],
    types: placeholder as Registry['trucks.suspended']['types'],
  },
  'trucks.store': {
    methods: ["POST"],
    pattern: '/api/v1/trucks',
    tokens: [{"old":"/api/v1/trucks","type":0,"val":"api","end":""},{"old":"/api/v1/trucks","type":0,"val":"v1","end":""},{"old":"/api/v1/trucks","type":0,"val":"trucks","end":""}],
    types: placeholder as Registry['trucks.store']['types'],
  },
  'trucks.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/trucks/:id',
    tokens: [{"old":"/api/v1/trucks/:id","type":0,"val":"api","end":""},{"old":"/api/v1/trucks/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/trucks/:id","type":0,"val":"trucks","end":""},{"old":"/api/v1/trucks/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['trucks.update']['types'],
  },
  'trucks.archive_many': {
    methods: ["POST"],
    pattern: '/api/v1/trucks/archive',
    tokens: [{"old":"/api/v1/trucks/archive","type":0,"val":"api","end":""},{"old":"/api/v1/trucks/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/trucks/archive","type":0,"val":"trucks","end":""},{"old":"/api/v1/trucks/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['trucks.archive_many']['types'],
  },
  'trucks.archive': {
    methods: ["POST"],
    pattern: '/api/v1/trucks/:id/archive',
    tokens: [{"old":"/api/v1/trucks/:id/archive","type":0,"val":"api","end":""},{"old":"/api/v1/trucks/:id/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/trucks/:id/archive","type":0,"val":"trucks","end":""},{"old":"/api/v1/trucks/:id/archive","type":1,"val":"id","end":""},{"old":"/api/v1/trucks/:id/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['trucks.archive']['types'],
  },
  'trucks.reactivate_many': {
    methods: ["POST"],
    pattern: '/api/v1/trucks/reactivate',
    tokens: [{"old":"/api/v1/trucks/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/trucks/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/trucks/reactivate","type":0,"val":"trucks","end":""},{"old":"/api/v1/trucks/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['trucks.reactivate_many']['types'],
  },
  'trucks.reactivate': {
    methods: ["POST"],
    pattern: '/api/v1/trucks/:id/reactivate',
    tokens: [{"old":"/api/v1/trucks/:id/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/trucks/:id/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/trucks/:id/reactivate","type":0,"val":"trucks","end":""},{"old":"/api/v1/trucks/:id/reactivate","type":1,"val":"id","end":""},{"old":"/api/v1/trucks/:id/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['trucks.reactivate']['types'],
  },
  'trucks.suspend': {
    methods: ["POST"],
    pattern: '/api/v1/trucks/:id/suspend',
    tokens: [{"old":"/api/v1/trucks/:id/suspend","type":0,"val":"api","end":""},{"old":"/api/v1/trucks/:id/suspend","type":0,"val":"v1","end":""},{"old":"/api/v1/trucks/:id/suspend","type":0,"val":"trucks","end":""},{"old":"/api/v1/trucks/:id/suspend","type":1,"val":"id","end":""},{"old":"/api/v1/trucks/:id/suspend","type":0,"val":"suspend","end":""}],
    types: placeholder as Registry['trucks.suspend']['types'],
  },
  'trucks.return_to_service': {
    methods: ["POST"],
    pattern: '/api/v1/trucks/:id/return-to-service',
    tokens: [{"old":"/api/v1/trucks/:id/return-to-service","type":0,"val":"api","end":""},{"old":"/api/v1/trucks/:id/return-to-service","type":0,"val":"v1","end":""},{"old":"/api/v1/trucks/:id/return-to-service","type":0,"val":"trucks","end":""},{"old":"/api/v1/trucks/:id/return-to-service","type":1,"val":"id","end":""},{"old":"/api/v1/trucks/:id/return-to-service","type":0,"val":"return-to-service","end":""}],
    types: placeholder as Registry['trucks.return_to_service']['types'],
  },
  'discharges.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/discharges',
    tokens: [{"old":"/api/v1/discharges","type":0,"val":"api","end":""},{"old":"/api/v1/discharges","type":0,"val":"v1","end":""},{"old":"/api/v1/discharges","type":0,"val":"discharges","end":""}],
    types: placeholder as Registry['discharges.index']['types'],
  },
  'users.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/users',
    tokens: [{"old":"/api/v1/users","type":0,"val":"api","end":""},{"old":"/api/v1/users","type":0,"val":"v1","end":""},{"old":"/api/v1/users","type":0,"val":"users","end":""}],
    types: placeholder as Registry['users.index']['types'],
  },
  'users.store': {
    methods: ["POST"],
    pattern: '/api/v1/users',
    tokens: [{"old":"/api/v1/users","type":0,"val":"api","end":""},{"old":"/api/v1/users","type":0,"val":"v1","end":""},{"old":"/api/v1/users","type":0,"val":"users","end":""}],
    types: placeholder as Registry['users.store']['types'],
  },
  'users.deactivate': {
    methods: ["POST"],
    pattern: '/api/v1/users/:id/deactivate',
    tokens: [{"old":"/api/v1/users/:id/deactivate","type":0,"val":"api","end":""},{"old":"/api/v1/users/:id/deactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/users/:id/deactivate","type":0,"val":"users","end":""},{"old":"/api/v1/users/:id/deactivate","type":1,"val":"id","end":""},{"old":"/api/v1/users/:id/deactivate","type":0,"val":"deactivate","end":""}],
    types: placeholder as Registry['users.deactivate']['types'],
  },
  'docks.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/docks',
    tokens: [{"old":"/api/v1/docks","type":0,"val":"api","end":""},{"old":"/api/v1/docks","type":0,"val":"v1","end":""},{"old":"/api/v1/docks","type":0,"val":"docks","end":""}],
    types: placeholder as Registry['docks.index']['types'],
  },
  'docks.store': {
    methods: ["POST"],
    pattern: '/api/v1/docks',
    tokens: [{"old":"/api/v1/docks","type":0,"val":"api","end":""},{"old":"/api/v1/docks","type":0,"val":"v1","end":""},{"old":"/api/v1/docks","type":0,"val":"docks","end":""}],
    types: placeholder as Registry['docks.store']['types'],
  },
  'docks.available': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/docks/available',
    tokens: [{"old":"/api/v1/docks/available","type":0,"val":"api","end":""},{"old":"/api/v1/docks/available","type":0,"val":"v1","end":""},{"old":"/api/v1/docks/available","type":0,"val":"docks","end":""},{"old":"/api/v1/docks/available","type":0,"val":"available","end":""}],
    types: placeholder as Registry['docks.available']['types'],
  },
  'docks.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/docks/:id',
    tokens: [{"old":"/api/v1/docks/:id","type":0,"val":"api","end":""},{"old":"/api/v1/docks/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/docks/:id","type":0,"val":"docks","end":""},{"old":"/api/v1/docks/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['docks.update']['types'],
  },
  'docks.archive_many': {
    methods: ["POST"],
    pattern: '/api/v1/docks/archive',
    tokens: [{"old":"/api/v1/docks/archive","type":0,"val":"api","end":""},{"old":"/api/v1/docks/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/docks/archive","type":0,"val":"docks","end":""},{"old":"/api/v1/docks/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['docks.archive_many']['types'],
  },
  'docks.archive': {
    methods: ["POST"],
    pattern: '/api/v1/docks/:id/archive',
    tokens: [{"old":"/api/v1/docks/:id/archive","type":0,"val":"api","end":""},{"old":"/api/v1/docks/:id/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/docks/:id/archive","type":0,"val":"docks","end":""},{"old":"/api/v1/docks/:id/archive","type":1,"val":"id","end":""},{"old":"/api/v1/docks/:id/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['docks.archive']['types'],
  },
  'docks.reactivate_many': {
    methods: ["POST"],
    pattern: '/api/v1/docks/reactivate',
    tokens: [{"old":"/api/v1/docks/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/docks/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/docks/reactivate","type":0,"val":"docks","end":""},{"old":"/api/v1/docks/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['docks.reactivate_many']['types'],
  },
  'docks.reactivate': {
    methods: ["POST"],
    pattern: '/api/v1/docks/:id/reactivate',
    tokens: [{"old":"/api/v1/docks/:id/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/docks/:id/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/docks/:id/reactivate","type":0,"val":"docks","end":""},{"old":"/api/v1/docks/:id/reactivate","type":1,"val":"id","end":""},{"old":"/api/v1/docks/:id/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['docks.reactivate']['types'],
  },
  'weighing_areas.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/weighing-areas',
    tokens: [{"old":"/api/v1/weighing-areas","type":0,"val":"api","end":""},{"old":"/api/v1/weighing-areas","type":0,"val":"v1","end":""},{"old":"/api/v1/weighing-areas","type":0,"val":"weighing-areas","end":""}],
    types: placeholder as Registry['weighing_areas.index']['types'],
  },
  'weighing_areas.store': {
    methods: ["POST"],
    pattern: '/api/v1/weighing-areas',
    tokens: [{"old":"/api/v1/weighing-areas","type":0,"val":"api","end":""},{"old":"/api/v1/weighing-areas","type":0,"val":"v1","end":""},{"old":"/api/v1/weighing-areas","type":0,"val":"weighing-areas","end":""}],
    types: placeholder as Registry['weighing_areas.store']['types'],
  },
  'weighing_areas.available': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/weighing-areas/available',
    tokens: [{"old":"/api/v1/weighing-areas/available","type":0,"val":"api","end":""},{"old":"/api/v1/weighing-areas/available","type":0,"val":"v1","end":""},{"old":"/api/v1/weighing-areas/available","type":0,"val":"weighing-areas","end":""},{"old":"/api/v1/weighing-areas/available","type":0,"val":"available","end":""}],
    types: placeholder as Registry['weighing_areas.available']['types'],
  },
  'weighing_areas.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/weighing-areas/:id',
    tokens: [{"old":"/api/v1/weighing-areas/:id","type":0,"val":"api","end":""},{"old":"/api/v1/weighing-areas/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/weighing-areas/:id","type":0,"val":"weighing-areas","end":""},{"old":"/api/v1/weighing-areas/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['weighing_areas.update']['types'],
  },
  'weighing_areas.archive_many': {
    methods: ["POST"],
    pattern: '/api/v1/weighing-areas/archive',
    tokens: [{"old":"/api/v1/weighing-areas/archive","type":0,"val":"api","end":""},{"old":"/api/v1/weighing-areas/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/weighing-areas/archive","type":0,"val":"weighing-areas","end":""},{"old":"/api/v1/weighing-areas/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['weighing_areas.archive_many']['types'],
  },
  'weighing_areas.archive': {
    methods: ["POST"],
    pattern: '/api/v1/weighing-areas/:id/archive',
    tokens: [{"old":"/api/v1/weighing-areas/:id/archive","type":0,"val":"api","end":""},{"old":"/api/v1/weighing-areas/:id/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/weighing-areas/:id/archive","type":0,"val":"weighing-areas","end":""},{"old":"/api/v1/weighing-areas/:id/archive","type":1,"val":"id","end":""},{"old":"/api/v1/weighing-areas/:id/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['weighing_areas.archive']['types'],
  },
  'weighing_areas.reactivate_many': {
    methods: ["POST"],
    pattern: '/api/v1/weighing-areas/reactivate',
    tokens: [{"old":"/api/v1/weighing-areas/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/weighing-areas/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/weighing-areas/reactivate","type":0,"val":"weighing-areas","end":""},{"old":"/api/v1/weighing-areas/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['weighing_areas.reactivate_many']['types'],
  },
  'weighing_areas.reactivate': {
    methods: ["POST"],
    pattern: '/api/v1/weighing-areas/:id/reactivate',
    tokens: [{"old":"/api/v1/weighing-areas/:id/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/weighing-areas/:id/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/weighing-areas/:id/reactivate","type":0,"val":"weighing-areas","end":""},{"old":"/api/v1/weighing-areas/:id/reactivate","type":1,"val":"id","end":""},{"old":"/api/v1/weighing-areas/:id/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['weighing_areas.reactivate']['types'],
  },
  'warehouse_doors.store': {
    methods: ["POST"],
    pattern: '/api/v1/warehouse-doors',
    tokens: [{"old":"/api/v1/warehouse-doors","type":0,"val":"api","end":""},{"old":"/api/v1/warehouse-doors","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouse-doors","type":0,"val":"warehouse-doors","end":""}],
    types: placeholder as Registry['warehouse_doors.store']['types'],
  },
  'warehouse_doors.available': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/warehouse-doors/available',
    tokens: [{"old":"/api/v1/warehouse-doors/available","type":0,"val":"api","end":""},{"old":"/api/v1/warehouse-doors/available","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouse-doors/available","type":0,"val":"warehouse-doors","end":""},{"old":"/api/v1/warehouse-doors/available","type":0,"val":"available","end":""}],
    types: placeholder as Registry['warehouse_doors.available']['types'],
  },
  'warehouse_doors.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/warehouse-doors/:id',
    tokens: [{"old":"/api/v1/warehouse-doors/:id","type":0,"val":"api","end":""},{"old":"/api/v1/warehouse-doors/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouse-doors/:id","type":0,"val":"warehouse-doors","end":""},{"old":"/api/v1/warehouse-doors/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['warehouse_doors.update']['types'],
  },
  'warehouse_doors.archive_many': {
    methods: ["POST"],
    pattern: '/api/v1/warehouse-doors/archive',
    tokens: [{"old":"/api/v1/warehouse-doors/archive","type":0,"val":"api","end":""},{"old":"/api/v1/warehouse-doors/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouse-doors/archive","type":0,"val":"warehouse-doors","end":""},{"old":"/api/v1/warehouse-doors/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['warehouse_doors.archive_many']['types'],
  },
  'warehouse_doors.archive': {
    methods: ["POST"],
    pattern: '/api/v1/warehouse-doors/:id/archive',
    tokens: [{"old":"/api/v1/warehouse-doors/:id/archive","type":0,"val":"api","end":""},{"old":"/api/v1/warehouse-doors/:id/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouse-doors/:id/archive","type":0,"val":"warehouse-doors","end":""},{"old":"/api/v1/warehouse-doors/:id/archive","type":1,"val":"id","end":""},{"old":"/api/v1/warehouse-doors/:id/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['warehouse_doors.archive']['types'],
  },
  'warehouse_doors.reactivate': {
    methods: ["POST"],
    pattern: '/api/v1/warehouse-doors/:id/reactivate',
    tokens: [{"old":"/api/v1/warehouse-doors/:id/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/warehouse-doors/:id/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouse-doors/:id/reactivate","type":0,"val":"warehouse-doors","end":""},{"old":"/api/v1/warehouse-doors/:id/reactivate","type":1,"val":"id","end":""},{"old":"/api/v1/warehouse-doors/:id/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['warehouse_doors.reactivate']['types'],
  },
  'warehouses.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/warehouses',
    tokens: [{"old":"/api/v1/warehouses","type":0,"val":"api","end":""},{"old":"/api/v1/warehouses","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouses","type":0,"val":"warehouses","end":""}],
    types: placeholder as Registry['warehouses.index']['types'],
  },
  'warehouses.store': {
    methods: ["POST"],
    pattern: '/api/v1/warehouses',
    tokens: [{"old":"/api/v1/warehouses","type":0,"val":"api","end":""},{"old":"/api/v1/warehouses","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouses","type":0,"val":"warehouses","end":""}],
    types: placeholder as Registry['warehouses.store']['types'],
  },
  'warehouses.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/warehouses/:id',
    tokens: [{"old":"/api/v1/warehouses/:id","type":0,"val":"api","end":""},{"old":"/api/v1/warehouses/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouses/:id","type":0,"val":"warehouses","end":""},{"old":"/api/v1/warehouses/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['warehouses.update']['types'],
  },
  'warehouses.archive_many': {
    methods: ["POST"],
    pattern: '/api/v1/warehouses/archive',
    tokens: [{"old":"/api/v1/warehouses/archive","type":0,"val":"api","end":""},{"old":"/api/v1/warehouses/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouses/archive","type":0,"val":"warehouses","end":""},{"old":"/api/v1/warehouses/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['warehouses.archive_many']['types'],
  },
  'warehouses.archive': {
    methods: ["POST"],
    pattern: '/api/v1/warehouses/:id/archive',
    tokens: [{"old":"/api/v1/warehouses/:id/archive","type":0,"val":"api","end":""},{"old":"/api/v1/warehouses/:id/archive","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouses/:id/archive","type":0,"val":"warehouses","end":""},{"old":"/api/v1/warehouses/:id/archive","type":1,"val":"id","end":""},{"old":"/api/v1/warehouses/:id/archive","type":0,"val":"archive","end":""}],
    types: placeholder as Registry['warehouses.archive']['types'],
  },
  'warehouses.reactivate_many': {
    methods: ["POST"],
    pattern: '/api/v1/warehouses/reactivate',
    tokens: [{"old":"/api/v1/warehouses/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/warehouses/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouses/reactivate","type":0,"val":"warehouses","end":""},{"old":"/api/v1/warehouses/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['warehouses.reactivate_many']['types'],
  },
  'warehouses.reactivate': {
    methods: ["POST"],
    pattern: '/api/v1/warehouses/:id/reactivate',
    tokens: [{"old":"/api/v1/warehouses/:id/reactivate","type":0,"val":"api","end":""},{"old":"/api/v1/warehouses/:id/reactivate","type":0,"val":"v1","end":""},{"old":"/api/v1/warehouses/:id/reactivate","type":0,"val":"warehouses","end":""},{"old":"/api/v1/warehouses/:id/reactivate","type":1,"val":"id","end":""},{"old":"/api/v1/warehouses/:id/reactivate","type":0,"val":"reactivate","end":""}],
    types: placeholder as Registry['warehouses.reactivate']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
