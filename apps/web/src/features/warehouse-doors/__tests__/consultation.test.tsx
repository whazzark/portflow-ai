import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { WarehouseDoorLegend } from '@/features/warehouse-doors/map/warehouse-door-legend'
import { WarehouseDoorsPanel } from '@/features/warehouse-doors/ui/warehouse-doors-panel'
import {
  countWarehouseDoors,
  defaultDoorStatus,
  filterWarehouseDoors,
  toggleDoorSelection,
} from '@/features/warehouse-doors/warehouse-door-presentation'
import { doorLifecycle, WAREHOUSES } from '@/features/warehouses/__tests__/support/fixtures'

describe('warehouse door consultation', () => {
  test('renders the compact type and status legend', () => {
    render(<WarehouseDoorLegend />)

    expect(screen.getByRole('region', { name: 'Warehouse door legend' })).toHaveTextContent('Type')
    expect(screen.getByRole('group', { name: 'Warehouse door types' })).toHaveTextContent(
      'Warehouse door',
    )
    expect(screen.getByRole('group', { name: 'Warehouse door statuses' })).toHaveTextContent(
      'Available',
    )
    expect(screen.getByRole('group', { name: 'Warehouse door statuses' })).toHaveTextContent(
      'Archived',
    )
    expect(document.querySelectorAll('[data-warehouse-door-legend-status]')).toHaveLength(2)
  })

  test('derives contextual defaults and lifecycle counts from embedded doors', () => {
    expect(defaultDoorStatus('AVAILABLE')).toBe('available')
    expect(defaultDoorStatus('ARCHIVED')).toBe('archived')
    expect(countWarehouseDoors(WAREHOUSES[0])).toEqual({ available: 1, archived: 1 })
    expect(filterWarehouseDoors(WAREHOUSES[0], 'available')).toHaveLength(1)
    expect(filterWarehouseDoors(WAREHOUSES[0], 'archived')).toHaveLength(1)
  })

  test('clears the selection when the selected door is clicked again', () => {
    expect(toggleDoorSelection(undefined, 'door-1')).toBe('door-1')
    expect(toggleDoorSelection('door-1', 'door-1')).toBeUndefined()
    expect(toggleDoorSelection('door-1', 'door-2')).toBe('door-2')
  })

  test('scopes the panel to the selected warehouse and switches lifecycle views', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()
    render(
      <WarehouseDoorsPanel
        warehouse={WAREHOUSES[0]}
        status="available"
        onStatusChange={onStatusChange}
        onDoorSelect={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Doors' })).toBeInTheDocument()
    expect(screen.getByText('North Door')).toBeInTheDocument()
    expect(screen.queryByText('Old Door')).not.toBeInTheDocument()
    // Parenthesised, as the customers, trucks, and transport-company tab lists already write it.
    expect(screen.getByRole('tab', { name: 'Available (1)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Archived (1)' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Archived/ }))
    expect(onStatusChange).toHaveBeenCalledWith('archived')
  })

  test('marks the exact door as selected in the list', async () => {
    const user = userEvent.setup()
    const onDoorSelect = vi.fn()
    render(
      <WarehouseDoorsPanel
        warehouse={WAREHOUSES[0]}
        status="available"
        onStatusChange={vi.fn()}
        onDoorSelect={onDoorSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: /North Door/ }))
    expect(onDoorSelect).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')
  })

  test('exposes the selected door state without replacing the list', () => {
    render(
      <WarehouseDoorsPanel
        warehouse={WAREHOUSES[0]}
        status="available"
        selectedDoorId="11111111-1111-4111-8111-111111111111"
        onStatusChange={vi.fn()}
        onDoorSelect={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /North Door/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('heading', { name: 'Doors' })).toBeInTheDocument()
  })

  test('names how each archived door was archived', () => {
    render(
      <WarehouseDoorsPanel
        warehouse={WAREHOUSES[1]}
        status="archived"
        onStatusChange={vi.fn()}
        onDoorSelect={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Retired Door/ })).toHaveTextContent(
      'Archived with this warehouse',
    )

    render(
      <WarehouseDoorsPanel
        warehouse={WAREHOUSES[0]}
        status="archived"
        onStatusChange={vi.fn()}
        onDoorSelect={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Old Door/ })).toHaveTextContent(
      'Archived on its own',
    )
  })

  // Reactivation leaves `archivedAt` populated, so an available door still carries the timestamps
  // of the archival it came back from. Reading the status is what keeps it from claiming them.
  test('drops the archive provenance once a door is available again', () => {
    render(
      <WarehouseDoorsPanel
        warehouse={{
          ...WAREHOUSES[0],
          doors: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              name: 'North Door',
              status: 'AVAILABLE',
              latitude: 48.855,
              longitude: 2.345,
              ...doorLifecycle({
                archivedAt: '2026-05-01T09:00:00.000Z',
                archiveComment: 'Roof works',
                reactivatedAt: '2026-07-01T09:00:00.000Z',
              }),
            },
          ],
        }}
        status="available"
        onStatusChange={vi.fn()}
        onDoorSelect={vi.fn()}
      />,
    )

    const door = screen.getByRole('button', { name: /North Door/ })

    // The row no longer restates the status the lifecycle tab already names; what matters here is
    // that an available door claims none of the archival it came back from.
    expect(door).not.toHaveTextContent('Archived on its own')
    expect(door).not.toHaveTextContent('Roof works')
  })
})
