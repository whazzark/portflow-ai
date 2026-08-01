import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CheckpointsError } from '@/features/checkpoints/ui/checkpoints-error'
import { CheckpointsPage } from '@/features/checkpoints/ui/checkpoints-page'
import { CheckpointsPending } from '@/features/checkpoints/ui/checkpoints-pending'
import { dockQueries } from '@/features/docks/queries/dock-queries'

const checkpointSearchSchema = z.object({
  checkpoint: z.string().optional().catch(undefined),
  kinds: z.enum(['dock', 'weighing-area']).optional().catch(undefined),
  search: z.string().catch(''),
  status: z.enum(['all', 'available', 'archived']).catch('all'),
})

export const Route = createFileRoute('/_authenticated/checkpoints')({
  staticData: { breadcrumb: 'Checkpoints' },
  validateSearch: checkpointSearchSchema,
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(dockQueries.list()),
  pendingComponent: CheckpointsPending,
  errorComponent: CheckpointsError,
  component: CheckpointsPage,
})
