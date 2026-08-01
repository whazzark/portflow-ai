import { useState } from 'react'
import { CHECKPOINT_STATUS_LABELS, type PresentedCheckpoint } from '@/features/checkpoints/types'

function MockMarker({
  checkpoint,
  onSelect,
}: {
  checkpoint: PresentedCheckpoint
  onSelect: (checkpoint: PresentedCheckpoint) => void
}) {
  const [showsTooltip, setShowsTooltip] = useState(false)

  return (
    <>
      <button
        aria-label={`View dock ${checkpoint.name} (${CHECKPOINT_STATUS_LABELS[checkpoint.status]})`}
        data-search-match={checkpoint.isSearchMatch}
        data-status={checkpoint.status}
        onBlur={() => setShowsTooltip(false)}
        onClick={() => onSelect(checkpoint)}
        onFocus={() => setShowsTooltip(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            onSelect(checkpoint)
          }
        }}
        onMouseEnter={() => setShowsTooltip(true)}
        onMouseLeave={() => setShowsTooltip(false)}
        type="button"
      >
        {checkpoint.name} marker
      </button>
      {showsTooltip && (
        <span role="tooltip">
          <span>{checkpoint.name}</span>
          <span>{CHECKPOINT_STATUS_LABELS[checkpoint.status]}</span>
        </span>
      )}
    </>
  )
}

export function CheckpointMap({
  checkpoints,
  onSelect,
}: {
  checkpoints: PresentedCheckpoint[]
  onSelect: (checkpoint: PresentedCheckpoint) => void
}) {
  return (
    <section aria-label="Checkpoint map">
      {checkpoints.map((checkpoint) => (
        <MockMarker
          checkpoint={checkpoint}
          key={`${checkpoint.kind}:${checkpoint.id}`}
          onSelect={onSelect}
        />
      ))}
    </section>
  )
}
