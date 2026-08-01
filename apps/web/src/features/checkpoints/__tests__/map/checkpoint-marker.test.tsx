import { render, screen, within } from '@testing-library/react'
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

test('separates checkpoint types and statuses in a compact legend', () => {
  const { container } = render(<CheckpointLegend />)

  const legend = screen.getByRole('region', { name: 'Checkpoint legend' })
  const types = within(screen.getByRole('group', { name: 'Checkpoint types' }))
  const statuses = within(screen.getByRole('group', { name: 'Checkpoint statuses' }))

  expect(legend).toHaveTextContent('Type')
  expect(legend).toHaveTextContent('Status')
  expect(types.getByText('Dock')).toBeInTheDocument()
  expect(types.getByText('Weighing area')).toBeInTheDocument()
  expect(statuses.getByText('Available')).toBeInTheDocument()
  expect(statuses.getByText('Archived')).toBeInTheDocument()
  expect(container.querySelectorAll('[data-checkpoint-legend-kind]')).toHaveLength(2)
  expect(container.querySelectorAll('[data-checkpoint-legend-status]')).toHaveLength(2)
  expect(container.querySelector('[data-checkpoint-legend-kind="DOCK"]')).toHaveClass('bg-primary')
  expect(container.querySelector('[data-checkpoint-legend-kind="WEIGHING_AREA"]')).toHaveClass(
    'bg-background/95',
    'border-primary',
    'rounded-full',
  )
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
  expect(screen.getByRole('region', { name: 'Checkpoint legend' })).toHaveTextContent(
    'Weighing area',
  )
  expect(container.querySelector('[data-checkpoint-kind="WEIGHING_AREA"] svg')).not.toEqual(
    container.querySelector('[data-checkpoint-kind="DOCK"] svg'),
  )
})

test('uses a distinct color and silhouette for each available checkpoint type', () => {
  const { container } = render(
    <>
      <CheckpointMarkerSymbol kind="DOCK" status="AVAILABLE" />
      <CheckpointMarkerSymbol kind="WEIGHING_AREA" status="AVAILABLE" />
    </>,
  )

  const dock = container.querySelector('[data-checkpoint-kind="DOCK"]')
  const weighingArea = container.querySelector('[data-checkpoint-kind="WEIGHING_AREA"]')

  expect(dock).toHaveClass('rounded-full', 'bg-primary')
  expect(weighingArea).toHaveClass('rounded-full', 'bg-background/95', 'border-primary')
})

test('uses a shared neutral treatment for archived checkpoint markers', () => {
  const { container } = render(
    <>
      <CheckpointMarkerSymbol kind="DOCK" status="ARCHIVED" />
      <CheckpointMarkerSymbol kind="WEIGHING_AREA" status="ARCHIVED" />
    </>,
  )

  for (const kind of ['DOCK', 'WEIGHING_AREA']) {
    expect(container.querySelector(`[data-checkpoint-kind="${kind}"]`)).toHaveClass(
      'border-muted-foreground',
      'bg-background/95',
      'text-muted-foreground',
      'border-dashed',
    )
  }
  expect(container.querySelectorAll('[data-archive-badge]')).toHaveLength(2)
})

test('limits the type group to the provided checkpoint kinds', () => {
  const { container } = render(<CheckpointLegend kinds={['DOCK']} />)

  expect(container.querySelector('[data-checkpoint-legend-kind="DOCK"]')).toBeInTheDocument()
  expect(
    container.querySelector('[data-checkpoint-legend-kind="WEIGHING_AREA"]'),
  ).not.toBeInTheDocument()
  expect(container.querySelectorAll('[data-checkpoint-legend-status]')).toHaveLength(2)
})
