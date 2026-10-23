import { describe, expect, test } from 'vitest'
import {
  filterFromStatusSelection,
  statusSelectionFromFilter,
  toggleStatusSelection,
} from '@/features/warehouses/status-selection'

describe('status selection', () => {
  test('reads each status filter as the pills it presses', () => {
    expect(statusSelectionFromFilter('available')).toEqual({ available: true, archived: false })
    expect(statusSelectionFromFilter('archived')).toEqual({ available: false, archived: true })
    expect(statusSelectionFromFilter('all')).toEqual({ available: true, archived: true })
  })

  test('writes pressed pills back as a status filter', () => {
    expect(filterFromStatusSelection({ available: true, archived: false })).toBe('available')
    expect(filterFromStatusSelection({ available: false, archived: true })).toBe('archived')
    expect(filterFromStatusSelection({ available: true, archived: true })).toBe('all')
  })

  test('toggles one pill', () => {
    expect(toggleStatusSelection('available', 'archived')).toBe('all')
    expect(toggleStatusSelection('all', 'available')).toBe('archived')
    expect(toggleStatusSelection('all', 'archived')).toBe('available')
  })

  test('never releases the last pressed pill', () => {
    expect(toggleStatusSelection('available', 'available')).toBe('available')
    expect(toggleStatusSelection('archived', 'archived')).toBe('archived')
  })
})
