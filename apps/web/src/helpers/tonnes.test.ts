import { expect, test } from 'vitest'

import { formatTonnes } from '@/helpers/tonnes'

test('groups the whole tonnes and keeps the three decimals verbatim', () => {
  expect(formatTonnes('1234.500')).toBe('1,234.500 t')
  expect(formatTonnes('999999999.999')).toBe('999,999,999.999 t')
  expect(formatTonnes('0.000')).toBe('0.000 t')
})
