import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CheckpointsPage } from '@/features/checkpoints/ui/checkpoints-page'

const checkpointsSearchSchema = z
  .object({
    resource: z.enum(['docks', 'weighing-areas']).catch('docks'),
    status: z.enum(['available', 'archived']).catch('available'),
    q: z
      .string()
      .catch('')
      .transform((value) => value.trim()),
    sort: z.enum(['asc', 'desc']).catch('asc'),
    detail: z.string().min(1).optional().catch(undefined),
    mode: z.enum(['create', 'edit', 'view']).optional().catch(undefined),
  })
  .transform((search) => {
    if (search.mode === 'edit' && search.status === 'archived') {
      return { ...search, detail: undefined, mode: undefined }
    }

    if ((search.mode === 'edit' || search.mode === 'view') && !search.detail) {
      return { ...search, mode: undefined }
    }

    return search
  })

export const Route = createFileRoute('/_authenticated/checkpoints')({
  staticData: { breadcrumb: 'Checkpoints' },
  validateSearch: checkpointsSearchSchema,
  component: CheckpointsPage,
})
