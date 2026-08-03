import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { WarehouseDoorsPanel } from '@/features/warehouse-doors/ui/warehouse-doors-panel'
import { WAREHOUSES } from '@/features/warehouses/__tests__/support/fixtures'

describe('warehouse door feedback', () => {
  test('distinguishes a successful lifecycle empty state', () => {
    render(
      <WarehouseDoorsPanel
        warehouse={WAREHOUSES[1]}
        status="available"
        onStatusChange={vi.fn()}
        onDoorSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('No available warehouse doors in this warehouse.')).toBeInTheDocument()
  })

  test('does not present a failed snapshot as a successful empty collection', () => {
    render(
      <WarehouseDoorsPanel
        warehouse={WAREHOUSES[0]}
        status="available"
        onStatusChange={vi.fn()}
        onDoorSelect={vi.fn()}
      />,
    )

    expect(screen.getByText('North Door')).toBeInTheDocument()
    expect(screen.queryByText(/No .*warehouse doors/)).not.toBeInTheDocument()
  })
})
