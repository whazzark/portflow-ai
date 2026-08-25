import { type MouseEvent, useState } from 'react'
import {
  CHECKPOINT_KIND_LABELS,
  CHECKPOINT_KIND_PLURAL_LABELS,
  CHECKPOINT_STATUS_LABELS,
  type CheckpointKind,
  type PresentedCheckpoint,
} from '@/features/checkpoints/types'

function MockMarker({
  checkpoint,
  muted = false,
  onSelect,
  checked,
}: {
  checkpoint: PresentedCheckpoint
  muted?: boolean
  onSelect: (checkpoint: PresentedCheckpoint, event: MouseEvent<HTMLButtonElement>) => void
  checked?: boolean
}) {
  const [showsTooltip, setShowsTooltip] = useState(false)
  const isSelecting = checked !== undefined
  const kindLabel = CHECKPOINT_KIND_LABELS[checkpoint.kind].toLowerCase()

  return (
    <>
      <button
        aria-label={
          isSelecting
            ? `${checked ? 'Deselect' : 'Select'} ${kindLabel} ${checkpoint.name}`
            : `View ${kindLabel} ${checkpoint.name} (${CHECKPOINT_STATUS_LABELS[checkpoint.status]})`
        }
        aria-pressed={isSelecting ? checked : undefined}
        data-checked={isSelecting ? checked : undefined}
        data-checkpoint-kind={checkpoint.kind}
        data-search-match={checkpoint.isSearchMatch}
        data-status={checkpoint.status}
        disabled={muted}
        onBlur={() => setShowsTooltip(false)}
        onClick={(event) => onSelect(checkpoint, event)}
        onFocus={() => setShowsTooltip(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            onSelect(checkpoint, event as unknown as MouseEvent<HTMLButtonElement>)
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
  label?: string
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
  selectMode,
  checkedIds,
  checkableIds,
  onToggleChecked,
  selectableKinds = [],
  onToggleSelectMode,
  onShiftSelect,
}: {
  checkpoints: PresentedCheckpoint[]
  onSelect: (checkpoint: PresentedCheckpoint) => void
  placement?: MockPlacement
  createActions?: MockCreateAction[]
  selectMode?: CheckpointKind
  checkedIds?: Set<string>
  checkableIds?: Set<string>
  onToggleChecked?: (id: string) => void
  selectableKinds?: CheckpointKind[]
  onToggleSelectMode?: (kind: CheckpointKind) => void
  onShiftSelect?: (kind: CheckpointKind, id: string) => void
}) {
  const isArmed = placement?.armed ?? false

  return (
    <section aria-label="Checkpoint map">
      {onToggleSelectMode &&
        selectableKinds.map((kind) => (
          <button
            aria-pressed={selectMode === kind}
            key={kind}
            onClick={() => onToggleSelectMode(kind)}
            type="button"
          >
            {selectMode === kind
              ? `Stop selecting ${CHECKPOINT_KIND_PLURAL_LABELS[kind]}`
              : `Select ${CHECKPOINT_KIND_PLURAL_LABELS[kind]}`}
          </button>
        ))}
      {createActions.map((action) => (
        <button key={action.key} onClick={action.onSelect} type="button">
          {action.label}
        </button>
      ))}
      {checkpoints.map((checkpoint) => {
        const isCheckable =
          selectableKinds.includes(checkpoint.kind) && (checkableIds?.has(checkpoint.id) ?? false)
        const isSelectableNow = selectMode === checkpoint.kind && isCheckable

        return (
          <MockMarker
            checked={isSelectableNow ? (checkedIds?.has(checkpoint.id) ?? false) : undefined}
            checkpoint={checkpoint}
            key={`${checkpoint.kind}:${checkpoint.id}`}
            muted={isArmed}
            onSelect={(selectedCheckpoint, event) => {
              if (isCheckable && event.shiftKey && onShiftSelect) {
                onShiftSelect(checkpoint.kind, checkpoint.id)
                return
              }
              if (isSelectableNow) {
                onToggleChecked?.(checkpoint.id)
                return
              }
              onSelect(selectedCheckpoint)
            }}
          />
        )
      })}
      {isArmed && (
        <button
          onClick={() => placement?.onPlace({ latitude: 10.5, longitude: 20.5 })}
          type="button"
        >
          Simulate map click to place checkpoint
        </button>
      )}
      {placement?.pending && (
        <>
          <div data-testid="pending-checkpoint-marker">
            {placement.label ?? 'Pending checkpoint'} at {placement.pending.latitude},{' '}
            {placement.pending.longitude}
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
