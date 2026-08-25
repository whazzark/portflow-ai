import { render } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { WarehousesPage } from '@/features/warehouses/ui/warehouses-page'
import { WAREHOUSES } from './support/fixtures'

const { isMobileMock, navigateMock } = vi.hoisted(() => ({
  isMobileMock: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  // The page now owns lifecycle mutations, which reach for the client and the mutation hook.
  useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useQuery: () => ({ data: { data: WAREHOUSES }, isError: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('@/features/auth/context/use-authenticated-user', () => ({
  useAuthenticatedUser: () => ({ role: 'OPERATIONS_ADMIN' }),
}))

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({
    useNavigate: () => navigateMock,
    useSearch: () => ({
      create: undefined,
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

// The page reads the signed-in user to decide whether to offer archival; this suite renders it
// outside the router's SessionProvider, so the hook is stubbed with an administrator.
vi.mock('@/features/auth/context/use-authenticated-user', () => ({
  useAuthenticatedUser: () => ({ id: 1, role: 'OPERATIONS_ADMIN', accessStatus: 'ACTIVE' }),
}))

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
