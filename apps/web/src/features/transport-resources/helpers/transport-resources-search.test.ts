import { describe, expect, test } from 'vitest'

import {
  fromLegacyTransportCompanySearch,
  transportResourcesSearchSchema,
} from './transport-resources-search'

const parse = (search: Record<string, unknown>) => transportResourcesSearchSchema.parse(search)

describe('defaults and fallbacks', () => {
  test('opens the default view on an empty address', () => {
    expect(parse({})).toEqual({
      status: ['available', 'suspended'],
      search: '',
      transportCompanyId: undefined,
      sort: 'registration',
      order: 'asc',
      truckId: undefined,
      truckMode: 'view',
      truckCompanyId: undefined,
      companyDetailsId: undefined,
      companyDetailsMode: 'view',
    })
  })

  test('falls back to defaults on malformed values', () => {
    expect(
      parse({ status: 'nonsense', sort: 'weight', order: 'up', truckMode: 'delete' }),
    ).toMatchObject({
      status: ['available', 'suspended'],
      sort: 'registration',
      order: 'asc',
      truckMode: 'view',
    })
  })

  test('keeps a de-duplicated, non-empty status selection in a stable order', () => {
    expect(parse({ status: ['archived', 'archived', 'suspended'] }).status).toEqual([
      'suspended',
      'archived',
    ])
    expect(parse({ status: [] }).status).toEqual(['available', 'suspended'])
  })
})

describe('legacy parameters', () => {
  test('rewrites the former truck status and search', () => {
    expect(parse({ truckStatus: 'suspended', truckSearch: 'EF-789' })).toMatchObject({
      status: ['suspended'],
      search: 'EF-789',
    })
  })

  test('rewrites the former company status and search when no truck one is given', () => {
    expect(parse({ companyStatus: 'archived', companySearch: 'Morvan' })).toMatchObject({
      status: ['archived'],
      search: 'Morvan',
    })
  })

  test('lets the current names win over the legacy ones', () => {
    expect(
      parse({ status: ['available'], search: 'AB', truckStatus: 'archived', truckSearch: 'ZZ' }),
    ).toMatchObject({ status: ['available'], search: 'AB' })
  })

  test('never writes a legacy parameter back', () => {
    const parsed = parse({ truckStatus: 'suspended', companySearch: 'Morvan' })

    expect(parsed).not.toHaveProperty('truckStatus')
    expect(parsed).not.toHaveProperty('companySearch')
  })
})

describe('invariants', () => {
  test('a truck creation clears the open truck', () => {
    expect(parse({ truckMode: 'create', truckId: 't1' })).toMatchObject({
      truckMode: 'create',
      truckId: undefined,
    })
  })

  test('a company creation clears the open company', () => {
    expect(parse({ companyDetailsMode: 'create', companyDetailsId: 'c1' })).toMatchObject({
      companyDetailsMode: 'create',
      companyDetailsId: undefined,
    })
  })

  test('only one form is open at a time, the truck one winning', () => {
    expect(parse({ truckMode: 'edit', truckId: 't1', companyDetailsMode: 'create' })).toMatchObject(
      { truckMode: 'edit', companyDetailsMode: 'view' },
    )
  })

  test('only one detail is open at a time, the truck one winning', () => {
    expect(parse({ truckId: 't1', companyDetailsId: 'c1' })).toMatchObject({
      truckId: 't1',
      companyDetailsId: undefined,
    })
  })

  test('keeps the fixed company of a new truck only while creating one', () => {
    expect(parse({ truckMode: 'create', truckCompanyId: 'c1' }).truckCompanyId).toBe('c1')
    expect(parse({ truckMode: 'view', truckCompanyId: 'c1' }).truckCompanyId).toBeUndefined()
  })
})

describe('the former Transport companies address', () => {
  test('maps its archived status, search and company', () => {
    expect(
      fromLegacyTransportCompanySearch({
        status: 'archived',
        search: 'Morvan',
        transportCompanyId: 'c4',
      }),
    ).toEqual({ status: ['archived'], search: 'Morvan', transportCompanyId: 'c4' })
  })

  test('maps its available status to the default selection', () => {
    expect(
      fromLegacyTransportCompanySearch({
        status: 'available',
        search: '',
        transportCompanyId: undefined,
      }),
    ).toEqual({ status: ['available', 'suspended'], search: '', transportCompanyId: undefined })
  })
})
