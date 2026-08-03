import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { WarehouseDoorMarker } from '@/features/warehouse-doors/map/warehouse-door-marker'
import { WAREHOUSES } from '@/features/warehouses/__tests__/support/fixtures'

vi.mock('@/components/ui/map', () => ({
  MapMarker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MarkerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MarkerTooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('warehouse door markers', () => {
  test('exposes door name and lifecycle in the accessible marker', () => {
    const door = WAREHOUSES[0].doors?.[0]
    if (!door) {
      throw new Error('fixture door missing')
    }
    render(<WarehouseDoorMarker door={door} doors={[door]} onSelect={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'View warehouse door North Door (Available)' }),
    ).toBeInTheDocument()
  })

  test('does not propagate marker activation to the footprint below it', async () => {
    const user = userEvent.setup()
    const door = WAREHOUSES[0].doors?.[0]
    const onMapClick = vi.fn()
    const onSelect = vi.fn()
    if (!door) {
      throw new Error('fixture door missing')
    }

    render(
      <div onClick={onMapClick} onKeyDown={() => undefined} role="application">
        <WarehouseDoorMarker door={door} doors={[door]} onSelect={onSelect} />
      </div>,
    )

    await user.click(
      screen.getByRole('button', { name: 'View warehouse door North Door (Available)' }),
    )

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onMapClick).not.toHaveBeenCalled()
  })
})
