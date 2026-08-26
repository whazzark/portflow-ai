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

  // Asserted on the class rather than on a click, because the behaviour it stands for is browser
  // hit-testing that jsdom does not perform: a `disabled` button alone would swallow the click and
  // leave a hole in the map exactly where a new door is placed, while `pointer-events-none` lets
  // it through to the canvas underneath.
  test('takes no pointer event while a door is being placed', () => {
    const door = WAREHOUSES[0].doors?.[0]
    if (!door) {
      throw new Error('fixture door missing')
    }

    render(<WarehouseDoorMarker door={door} doors={[door]} />)

    expect(
      screen.getByRole('button', { name: 'View warehouse door North Door (Available)' }),
    ).toHaveClass('pointer-events-none')
  })
})
