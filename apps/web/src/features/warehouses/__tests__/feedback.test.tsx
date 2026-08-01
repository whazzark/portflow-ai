import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { WarehouseLegend } from '@/features/warehouses/map/warehouse-legend'
import { WarehouseTooltip } from '@/features/warehouses/map/warehouse-tooltip'
import { WarehousesError } from '@/features/warehouses/ui/warehouses-error'

const warehouse = {
  id: 'warehouse-1',
  name: 'North Shed',
  status: 'AVAILABLE' as const,
  footprint: {
    points: [
      { latitude: 1, longitude: 2 },
      { latitude: 1, longitude: 3 },
      { latitude: 2, longitude: 2 },
    ],
  },
  isSearchMatch: true,
}

describe('warehouse feedback and map semantics', () => {
  test('distinguishes lifecycle states in the legend', () => {
    render(<WarehouseLegend />)
    expect(screen.getByRole('region', { name: 'Warehouse legend' })).toHaveTextContent('Status')
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByText('Archived')).toBeInTheDocument()
    expect(screen.getByTestId('warehouse-legend-status-available')).toHaveClass(
      'border-background',
      'bg-primary',
    )
  })

  test('exposes name and status in the tooltip', () => {
    render(<WarehouseTooltip warehouse={warehouse} />)
    expect(screen.getByText('North Shed')).toBeInTheDocument()
    expect(screen.getByText('Warehouse')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByText('·')).toHaveAttribute('aria-hidden', 'true')
  })

  test('separates a loading failure from empty content', () => {
    render(<WarehousesError onRetry={() => undefined} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load warehouses')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
