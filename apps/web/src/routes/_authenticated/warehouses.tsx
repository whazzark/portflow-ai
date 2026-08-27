import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { warehouseQueries } from '@/features/warehouses/queries/warehouse-queries'
import { WarehousesError } from '@/features/warehouses/ui/warehouses-error'
import { WarehousesPage } from '@/features/warehouses/ui/warehouses-page'
import { WarehousesPending } from '@/features/warehouses/ui/warehouses-pending'

const warehouseSearchSchema = z.object({
  // `door` is honoured only alongside a `warehouseId` naming an available warehouse: door creation
  // is scoped to one warehouse, not to the page. One param holding one value is also what keeps the
  // two creation modes from ever being armed together.
  create: z.enum(['warehouse', 'door']).optional().catch(undefined),
  doorId: z.string().optional().catch(undefined),
  doorStatus: z.enum(['available', 'archived']).optional().catch(undefined),
  // `door` is honoured only alongside a `warehouseId` naming an available warehouse and a `doorId`
  // naming an available door of it: a door update is scoped to one door, not to the page. One param
  // holding one value is also what keeps the two update modes from ever being armed together.
  edit: z.enum(['warehouse', 'door']).optional().catch(undefined),
  warehouseId: z.string().optional().catch(undefined),
  search: z.string().catch(''),
  // Mirrors the Checkpoints `selecting` param. Honoured only for administrators; for anyone else
  // it resolves to no select mode and no bulk affordance renders.
  //
  // Doors carry no equivalent value: their selection is not a mode at all. Checking one is offered
  // as soon as an administrator opens an available warehouse's Available doors, so there is nothing
  // to enter, nothing to leave, and nothing to deep-link.
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
