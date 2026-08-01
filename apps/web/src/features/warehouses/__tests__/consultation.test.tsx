import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { WarehouseDetails } from '@/features/warehouses/ui/warehouse-details'
import { WarehouseMapControls } from '@/features/warehouses/ui/warehouse-map-controls'
import { WAREHOUSES } from './support/fixtures'

describe('warehouse consultation controls', () => {
  test('exposes searchable, filterable map controls', () => {
    render(
      <WarehouseMapControls
        hasMatches
        onSearchChange={vi.fn()}
        onStatusChange={vi.fn()}
        search=""
        status="available"
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Search warehouses' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter warehouses: Available' })).toBeInTheDocument()
  })

  test('opens the warehouse status filters', async () => {
    const user = userEvent.setup()

    render(
      <WarehouseMapControls
        hasMatches
        onSearchChange={vi.fn()}
        onStatusChange={vi.fn()}
        search=""
        status="available"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Filter warehouses: Available' }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Available, 0 warehouses' })).toBeChecked()
  })

  test('shows the complete read-only archived footprint', () => {
    render(
      <Sheet open>
        <SheetContent>
          <WarehouseDetails warehouse={WAREHOUSES[1]} />
        </SheetContent>
      </Sheet>,
    )

    expect(screen.getByRole('heading', { name: 'Retired Shed' })).toBeInTheDocument()
    expect(
      screen.getByText('Archived warehouses are read-only historical references.'),
    ).toBeInTheDocument()
    expect(screen.getByText('3 GPS boundary points')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})
