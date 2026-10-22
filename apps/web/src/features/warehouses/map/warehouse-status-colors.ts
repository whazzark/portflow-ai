import type { PresentedWarehouse } from '@/features/warehouses/types'

/**
 * MapLibre cannot resolve Tailwind's `bg-primary`/`bg-background` classes, so
 * these values mirror the colors used by the warehouse status legend.
 */
export const WAREHOUSE_STATUS_COLORS: Record<
  PresentedWarehouse['status'],
  { fill: string; line: string }
> = {
  AVAILABLE: { fill: '#1f6f8b', line: '#164f63' },
  ARCHIVED: { fill: '#f2f4f5', line: '#56646f' },
}
