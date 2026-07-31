import { describe, expect, test } from 'vitest'

import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { transportCompanyMatchesSearch } from './transport-company-search'

const company = {
  id: 'company-1',
  name: 'Société Côtière',
  status: 'AVAILABLE',
  archiveComment: 'This field is not searchable',
} as TransportCompanyDto

describe('transportCompanyMatchesSearch', () => {
  test.each([' société ', 'SOCIETE', 'cotiere', ''])(
    'matches normalized name search %j',
    (search) => {
      expect(transportCompanyMatchesSearch(company, search)).toBe(true)
    },
  )

  test('treats whitespace-only input as no search', () => {
    expect(transportCompanyMatchesSearch(company, '   ')).toBe(true)
  })

  test('does not search lifecycle context or identity', () => {
    expect(transportCompanyMatchesSearch(company, 'not searchable')).toBe(false)
    expect(transportCompanyMatchesSearch(company, 'company-1')).toBe(false)
  })
})
