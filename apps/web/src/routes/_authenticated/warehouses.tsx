import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { warehouseQueries } from '@/features/warehouses/queries/warehouse-queries'
import { WarehousesError } from '@/features/warehouses/ui/warehouses-error'
import { WarehousesPage } from '@/features/warehouses/ui/warehouses-page'
import { WarehousesPending } from '@/features/warehouses/ui/warehouses-pending'

const warehouseSearchSchema = z.object({
  create: z.literal('warehouse').optional().catch(undefined),
  doorId: z.string().optional().catch(undefined),
  doorStatus: z.enum(['available', 'archived']).optional().catch(undefined),
  warehouseId: z.string().optional().catch(undefined),
  search: z.string().catch(''),
  // Mirrors the Checkpoints `selecting` param. Honoured only for administrators; for anyone else
  // it resolves to no select mode and no bulk affordance renders.
  selecting: z.enum(['warehouses']).optional().catch(undefined),
  status: z.enum(['all', 'available', 'archived']).catch('available'),
})

export const Route = createFileRoute('/_authenticated/warehouses')({
  staticData: { breadcrumb: 'Warehouses' },
  validateSearch: warehouseSearchSchema,
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(warehouseQueries.list()),
  pendingComponent: WarehousesPending,
  errorComponent: ({ reset }) => <WarehousesError onRetry={reset} />,
  component: WarehousesPage,
})
