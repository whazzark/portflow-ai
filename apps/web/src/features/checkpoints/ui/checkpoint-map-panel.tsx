import { type ReactNode, useState } from 'react'
import { hasConfiguredMapStyles } from '@/config/map'
import { CheckpointMap } from '@/features/checkpoints/map/checkpoint-map'
import { CheckpointLegend } from '@/features/checkpoints/map/checkpoint-marker'
import type { PresentedCheckpoint } from '@/features/checkpoints/types'

export function CheckpointMapPanel({
  checkpoints,
  controls,
  emptyMessage,
  onSelect,
}: {
  checkpoints: PresentedCheckpoint[]
  controls: ReactNode
  emptyMessage?: string
  onSelect: (checkpoint: PresentedCheckpoint) => void
}) {
  const [hasMapError, setHasMapError] = useState(false)

  return (
    <section aria-label="Checkpoint locations" className="relative min-h-0 flex-1 overflow-hidden">
      {hasConfiguredMapStyles || hasMapError ? (
        <CheckpointMap
          checkpoints={checkpoints}
          onError={() => setHasMapError(true)}
          onSelect={onSelect}
        />
      ) : (
        <div
          aria-label="Checkpoint map unavailable"
          className="grid h-full place-items-center bg-muted/30 p-6 text-center text-muted-foreground text-sm"
          role="status"
        >
          The map background is currently unavailable.
        </div>
      )}
      {hasMapError && (
        <div
          aria-label="Checkpoint map unavailable"
          className="absolute top-3 right-3 z-10 max-w-sm rounded-lg border bg-background/95 px-3 py-2 text-center text-muted-foreground text-sm shadow-md backdrop-blur"
          role="status"
        >
          The map background is currently unavailable. Checkpoint markers remain selectable.
        </div>
      )}
      <div className="absolute top-4 left-4 z-10 max-w-[calc(100%-2rem)] md:top-6 md:left-6 md:max-w-[calc(100%-3rem)]">
        {controls}
      </div>
      {(emptyMessage || hasConfiguredMapStyles) && (
        <div className="absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col gap-2">
          {emptyMessage && (
            <div
              className="rounded-lg border bg-background/95 px-3 py-2 text-muted-foreground text-sm shadow-md backdrop-blur"
              role="status"
            >
              {emptyMessage}
            </div>
          )}
          {hasConfiguredMapStyles && !hasMapError && <CheckpointLegend />}
        </div>
      )}
    </section>
  )
}
