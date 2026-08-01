import type { CheckpointKind } from '@/features/checkpoints/types'

export type CheckpointSelection = {
  id: string
  kind: CheckpointKind
}

const checkpointKindBySegment = {
  dock: 'DOCK',
  'weighing-area': 'WEIGHING_AREA',
} as const satisfies Record<string, CheckpointKind>

const checkpointSegmentByKind: Record<CheckpointKind, keyof typeof checkpointKindBySegment> = {
  DOCK: 'dock',
  WEIGHING_AREA: 'weighing-area',
}

export function parseCheckpointSelection(value?: string): CheckpointSelection | undefined {
  if (!value) {
    return undefined
  }

  const segments = value.split(':')
  if (segments.length !== 2) {
    return undefined
  }

  const [kindSegment, id] = segments
  const kind = checkpointKindBySegment[kindSegment as keyof typeof checkpointKindBySegment]
  return kind && id ? { id, kind } : undefined
}

export function serializeCheckpointSelection(selection: CheckpointSelection) {
  return `${checkpointSegmentByKind[selection.kind]}:${selection.id}`
}
