import type { ReactNode } from 'react'

export function MockWarehouseMap({ children }: { children?: ReactNode }) {
  return (
    <div role="img" aria-label="Warehouse map mock">
      {children}
    </div>
  )
}
