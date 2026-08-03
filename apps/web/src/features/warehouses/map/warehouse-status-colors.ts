import type { PresentedWarehouse } from '@/features/warehouses/types'

/**
 * MapLibre cannot resolve Tailwind's `bg-primary`/`bg-background` classes, so
 * these values mirror the colors used by the warehouse status legend.
 */
export const WAREHOUSE_STATUS_COLORS: Record<
  PresentedWarehouse['status'],
  { fill: string; line: string }
> = {
  AVAILABLE: { fill: '#0f6e8c', line: '#0b4f63' },
  ARCHIVED: { fill: '#f5f7f8', line: '#5b6b7a' },
}
