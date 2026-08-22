import { useState } from 'react'
import {
  CHECKPOINT_KIND_LABELS,
  CHECKPOINT_STATUS_LABELS,
  type PresentedCheckpoint,
} from '@/features/checkpoints/types'

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
        aria-label={`View ${CHECKPOINT_KIND_LABELS[checkpoint.kind].toLowerCase()} ${checkpoint.name} (${CHECKPOINT_STATUS_LABELS[checkpoint.status]})`}
        data-checkpoint-kind={checkpoint.kind}
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

type MockLatLng = { latitude: number; longitude: number }

type MockPlacement = {
  armed: boolean
  pending: MockLatLng | null
  onPlace: (point: MockLatLng) => void
  onMove: (point: MockLatLng) => void
}

type MockCreateAction = {
  key: string
  label: string
  onSelect: () => void
}

export function CheckpointMap({
  checkpoints,
  onSelect,
  placement,
  createActions = [],
}: {
  checkpoints: PresentedCheckpoint[]
  onSelect: (checkpoint: PresentedCheckpoint) => void
  placement?: MockPlacement
  createActions?: MockCreateAction[]
}) {
  const isArmed = placement?.armed ?? false

  return (
    <section aria-label="Checkpoint map">
      {createActions.map((action) => (
        <button key={action.key} onClick={action.onSelect} type="button">
          {action.label}
        </button>
      ))}
      {checkpoints.map((checkpoint) => (
        <MockMarker
          checkpoint={checkpoint}
          key={`${checkpoint.kind}:${checkpoint.id}`}
          onSelect={isArmed ? () => {} : onSelect}
        />
      ))}
      {isArmed && (
        <button
          onClick={() => placement?.onPlace({ latitude: 10.5, longitude: 20.5 })}
          type="button"
        >
          Simulate map click to place dock
        </button>
      )}
      {placement?.pending && (
        <>
          <div data-testid="pending-dock-marker">
            Pending dock at {placement.pending.latitude}, {placement.pending.longitude}
          </div>
          <button
            onClick={() => {
              const current = placement.pending as MockLatLng
              placement.onMove({ latitude: current.latitude + 1, longitude: current.longitude + 1 })
            }}
            type="button"
          >
            Simulate dragging pending marker
          </button>
        </>
      )}
    </section>
  )
}
