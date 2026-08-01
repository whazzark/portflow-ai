import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import {
  CheckpointLegend,
  CheckpointMarkerSymbol,
  CheckpointMarkerTooltipContent,
} from '@/features/checkpoints/map/checkpoint-marker'

test('uses a solid marker for available docks and a dashed archived marker with a badge', () => {
  const { container, rerender } = render(<CheckpointMarkerSymbol kind="DOCK" status="AVAILABLE" />)

  const availableMarker = container.querySelector('[data-checkpoint-status]')
  expect(availableMarker).toHaveAttribute('data-checkpoint-status', 'AVAILABLE')
  expect(availableMarker).toHaveClass('bg-primary')
  expect(container.querySelector('[data-archive-badge]')).not.toBeInTheDocument()

  rerender(<CheckpointMarkerSymbol kind="DOCK" status="ARCHIVED" />)

  const archivedMarker = container.querySelector('[data-checkpoint-status]')
  expect(archivedMarker).toHaveAttribute('data-checkpoint-status', 'ARCHIVED')
  expect(archivedMarker).toHaveClass('border-dashed')
  expect(container.querySelector('[data-archive-badge]')).toBeInTheDocument()
})

test('explains both marker variants in a compact legend', () => {
  render(<CheckpointLegend />)

  const legend = screen.getByRole('region', { name: 'Checkpoint legend' })
  expect(legend).toHaveTextContent('Available')
  expect(legend).toHaveTextContent('Archived')
})

test('shows the dock name and status in tooltip content', () => {
  render(<CheckpointMarkerTooltipContent kind="DOCK" name="North Dock" status="AVAILABLE" />)

  expect(screen.getByText('North Dock')).toBeInTheDocument()
  expect(screen.getByText('Available')).toBeInTheDocument()
})

test('supports weighing area markers through the generic map contract', () => {
  const { container } = render(
    <>
      <CheckpointMarkerSymbol kind="WEIGHING_AREA" status="AVAILABLE" />
      <CheckpointMarkerTooltipContent kind="WEIGHING_AREA" name="Scale A" status="AVAILABLE" />
      <CheckpointLegend kinds={['DOCK', 'WEIGHING_AREA']} />
    </>,
  )

  expect(container.querySelector('[data-checkpoint-kind]')).toHaveAttribute(
    'data-checkpoint-kind',
    'WEIGHING_AREA',
  )
  expect(screen.getByText('Scale A')).toBeInTheDocument()
  expect(screen.getByText('Weighing area')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Checkpoint legend' })).toHaveTextContent(
    'Weighing area',
  )
})
