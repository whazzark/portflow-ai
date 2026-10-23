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
  mapUnavailableActions,
  toolbar,
  banner,
  card,
  overlay,
}: {
  resourceLabel: string
  map: (onMapError: () => void) => ReactNode
  controls?: ReactNode
  legend?: ReactNode
  emptyMessage?: string
  sourceMessage?: string
  sourceError?: boolean
  onRetrySource?: () => void
  /**
   * Actions that normally live in the map's own control cluster. Rendered next to the
   * "map unavailable" notice so they stay reachable in an environment with no basemap
   * configured, where the map — and the cluster with it — never renders at all.
   */
  mapUnavailableActions?: ReactNode
  /** The floating toolbar, top-left. Takes `controls`' place when given. */
  toolbar?: ReactNode
  /** A mode banner, shown instead of the toolbar while the map is in a mode. */
  banner?: ReactNode
  /** A `ResourceMapCard`, positioned against this section. */
  card?: ReactNode
  /** A centred notice over the map, such as a search with no match. */
  overlay?: ReactNode
}) {
  const [hasMapError, setHasMapError] = useState(false)
  const singularResourceLabel = resourceLabel.replace(/s$/, '')
  const hasToolbar = Boolean(toolbar || banner)
  const notices =
    hasMapError || sourceMessage ? (
      <>
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
      </>
    ) : null

  return (
    <section
      aria-label={`${resourceLabel} locations`}
      className="relative h-full min-h-0 flex-1 overflow-hidden"
    >
      {hasConfiguredMapStyles || hasMapError ? (
        map(() => setHasMapError(true))
      ) : (
        <div className="grid h-full place-items-center bg-muted/30 p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <p
              aria-label={`${singularResourceLabel} map unavailable`}
              className="text-muted-foreground text-sm"
              role="status"
            >
              The map background is currently unavailable.
            </p>
            {mapUnavailableActions}
          </div>
        </div>
      )}
      <div className="absolute top-4 left-4 z-10 max-w-[calc(100%-2rem)] md:top-6 md:left-6 md:max-w-[calc(100%-3rem)]">
        {banner ?? toolbar ?? controls}
        {/* A floating toolbar can span the map's whole width and wraps on a narrow map, so its notices
            stack under it rather than in the top-right corner. */}
        {notices && hasToolbar && (
          <div className="mt-2 flex max-w-sm flex-col gap-2">{notices}</div>
        )}
      </div>
      {overlay && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-6">
          <div className="pointer-events-auto">{overlay}</div>
        </div>
      )}
      {card}
      {notices && !hasToolbar && (
        <div className="absolute top-3 right-3 z-10 flex max-w-sm flex-col gap-2">{notices}</div>
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
