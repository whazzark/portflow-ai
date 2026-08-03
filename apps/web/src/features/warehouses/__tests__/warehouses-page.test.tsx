import { render } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { WarehousesPage } from '@/features/warehouses/ui/warehouses-page'
import { WAREHOUSES } from './support/fixtures'

const { isMobileMock, navigateMock } = vi.hoisted(() => ({
  isMobileMock: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { data: WAREHOUSES }, isError: false }),
}))

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({
    useNavigate: () => navigateMock,
    useSearch: () => ({
      doorId: undefined,
      doorStatus: undefined,
      search: '',
      status: 'available',
      warehouseId: WAREHOUSES[0].id,
    }),
  }),
}))

vi.mock('@/features/warehouses/map/warehouse-map', () => ({
  WarehouseMap: ({ detailsPanelSide }: { detailsPanelSide?: string }) => (
    <div data-panel-side={detailsPanelSide} data-testid="warehouse-map" />
  ),
}))

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => isMobileMock() }))

describe('warehouse details sheet', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    isMobileMock.mockReset()
  })

  test('uses a bottom sheet on mobile and a right sheet on desktop', () => {
    isMobileMock.mockReturnValue(true)
    const { rerender } = render(<WarehousesPage />)

    expect(document.querySelector('[data-slot="sheet-content"]')).toHaveAttribute(
      'data-side',
      'bottom',
    )
    expect(document.querySelector('[data-testid="warehouse-map"]')).toHaveAttribute(
      'data-panel-side',
      'bottom',
    )

    isMobileMock.mockReturnValue(false)
    rerender(<WarehousesPage />)

    expect(document.querySelector('[data-slot="sheet-content"]')).toHaveAttribute(
      'data-side',
      'right',
    )
    expect(document.querySelector('[data-testid="warehouse-map"]')).toHaveAttribute(
      'data-panel-side',
      'right',
    )
  })
})
