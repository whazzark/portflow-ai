import type { ReactNode } from 'react'
import { useState } from 'react'
import { hasConfiguredMapStyles } from '@/config/map'

export function ResourceMapWorkspace({
  resourceLabel,
  map,
  controls,
  legend,
  emptyMessage,
  sourceMessage,
  sourceError = false,
  onRetrySource,
}: {
  resourceLabel: string
  map: (onMapError: () => void) => ReactNode
  controls: ReactNode
  legend?: ReactNode
  emptyMessage?: string
  sourceMessage?: string
  sourceError?: boolean
  onRetrySource?: () => void
}) {
  const [hasMapError, setHasMapError] = useState(false)
  const singularResourceLabel = resourceLabel.replace(/s$/, '')

  return (
    <section
      aria-label={`${resourceLabel} locations`}
      className="relative h-full min-h-0 flex-1 overflow-hidden"
    >
      {hasConfiguredMapStyles || hasMapError ? (
        map(() => setHasMapError(true))
      ) : (
        <div
          aria-label={`${singularResourceLabel} map unavailable`}
          className="grid h-full place-items-center bg-muted/30 p-6 text-center text-muted-foreground text-sm"
          role="status"
        >
          The map background is currently unavailable.
        </div>
      )}
      <div className="absolute top-4 left-4 z-10 max-w-[calc(100%-2rem)] md:top-6 md:left-6 md:max-w-[calc(100%-3rem)]">
        {controls}
      </div>
      {(hasMapError || sourceMessage) && (
        <div className="absolute top-3 right-3 z-10 flex max-w-sm flex-col gap-2">
          {hasMapError && (
            <div
              aria-label={`${singularResourceLabel} map unavailable`}
              className="rounded-lg border bg-background/95 px-3 py-2 text-center text-muted-foreground text-sm shadow-md backdrop-blur"
              role="status"
            >
              The map background is currently unavailable. {resourceLabel} remain selectable.
            </div>
          )}
          {sourceMessage && (
            <div
              className="rounded-lg border bg-background/95 px-3 py-2 text-muted-foreground text-sm shadow-md backdrop-blur"
              role={sourceError ? 'alert' : 'status'}
            >
              <div>{sourceMessage}</div>
              {sourceError && onRetrySource && (
                <button className="mt-2 underline" onClick={onRetrySource} type="button">
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {(emptyMessage || legend) && (
        <div className="absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col gap-2">
          {emptyMessage && (
            <div
              className="rounded-lg border bg-background/95 px-3 py-2 text-muted-foreground text-sm shadow-md backdrop-blur"
              role="status"
            >
              {emptyMessage}
            </div>
          )}
          {legend}
        </div>
      )}
    </section>
  )
}
