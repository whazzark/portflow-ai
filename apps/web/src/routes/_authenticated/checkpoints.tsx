import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { CheckpointsError } from '@/features/checkpoints/ui/checkpoints-error'
import { CheckpointsPage } from '@/features/checkpoints/ui/checkpoints-page'
import { CheckpointsPending } from '@/features/checkpoints/ui/checkpoints-pending'
import { dockQueries } from '@/features/docks/queries/dock-queries'

const checkpointSearchSchema = z.object({
  checkpointId: z.string().optional().catch(undefined),
  /**
   * What `checkpointId` was called before it was aligned on the `<resource>Id` convention every
   * other route follows. Accepted so links already in circulation keep opening what they name;
   * `beforeLoad` below rewrites them, so the old name never survives a navigation.
   */
  checkpoint: z.string().optional().catch(undefined),
  create: z.enum(['dock', 'weighing-area']).optional().catch(undefined),
  edit: z.enum(['dock', 'weighing-area']).optional().catch(undefined),
  kinds: z.enum(['dock', 'weighing-area']).optional().catch(undefined),
  search: z.string().catch(''),
  selecting: z.enum(['docks', 'weighing-areas']).optional().catch(undefined),
  status: z.enum(['all', 'available', 'archived']).catch('available'),
})

export const Route = createFileRoute('/_authenticated/checkpoints')({
  staticData: { breadcrumb: 'Checkpoints' },
  validateSearch: checkpointSearchSchema,
  // A legacy link is rewritten rather than merely honoured, so the old name never propagates back
  // out of the address bar into whatever the user copies next. `replace` keeps it out of history
  // too: going back should return where the user came from, not to the URL they just left.
  beforeLoad: ({ search }) => {
    if (search.checkpoint === undefined) {
      return
    }

    throw redirect({
      to: '/checkpoints',
      replace: true,
      // The current name wins where a link somehow carries both, so a URL already rewritten is
      // never dragged back to whatever the legacy parameter still held.
      search: {
        ...search,
        checkpoint: undefined,
        checkpointId: search.checkpointId ?? search.checkpoint,
      },
    })
  },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(dockQueries.list()),
  pendingComponent: CheckpointsPending,
  errorComponent: CheckpointsError,
  component: CheckpointsPage,
})
