import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { CheckpointLayerVisibility } from '@/features/checkpoints/types'
import { CheckpointMapControls } from '@/features/checkpoints/ui/checkpoint-map-controls'

const ALL_LAYERS: CheckpointLayerVisibility = { DOCK: true, WEIGHING_AREA: true }

function renderControls() {
  return render(
    <CheckpointMapControls
      hasMatches
      layerVisibility={ALL_LAYERS}
      onLayerVisibilityChange={vi.fn()}
      onSearchChange={vi.fn()}
      onStatusChange={vi.fn()}
      search=""
      status="all"
    />,
  )
}

test('shows the active status filter on the map controls', () => {
  renderControls()

  expect(screen.getByText('Showing: All')).toBeInTheDocument()
})

test('supports keyboard navigation and escape in the status menu', async () => {
  const user = userEvent.setup()
  renderControls()

  const trigger = screen.getByRole('button', { name: /Filter checkpoints: All/ })
  await user.click(trigger)
  expect(screen.getByRole('menu')).toHaveFocus()

  await user.keyboard('{ArrowDown}')
  expect(screen.getByRole('menuitemradio', { name: 'All, 0 checkpoints' })).toHaveFocus()
  await user.keyboard('{ArrowDown}')
  expect(screen.getByRole('menuitemradio', { name: 'Available, 0 checkpoints' })).toHaveFocus()

  await user.keyboard('{Escape}')
  expect(
    screen.queryByRole('menuitemradio', { name: 'Available, 0 checkpoints' }),
  ).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

test('exposes a clear action for a non-empty checkpoint search', async () => {
  const user = userEvent.setup()
  const onSearchChange = vi.fn()

  render(
    <CheckpointMapControls
      hasMatches
      layerVisibility={ALL_LAYERS}
      onLayerVisibilityChange={vi.fn()}
      onSearchChange={onSearchChange}
      onStatusChange={vi.fn()}
      search="quai"
      status="all"
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Clear search checkpoints input' }))
  expect(onSearchChange).toHaveBeenCalledWith('')
})

test('keeps the filter menu open while toggling checkpoint layers', async () => {
  const user = userEvent.setup()
  const onLayerVisibilityChange = vi.fn()

  render(
    <CheckpointMapControls
      hasMatches
      layerVisibility={ALL_LAYERS}
      onLayerVisibilityChange={onLayerVisibilityChange}
      onSearchChange={vi.fn()}
      onStatusChange={vi.fn()}
      search=""
      status="all"
    />,
  )

  const trigger = screen.getByRole('button', { name: /Filter checkpoints: All/ })
  await user.click(trigger)
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Docks' }))

  expect(screen.getByRole('menu')).toBeInTheDocument()
  expect(onLayerVisibilityChange).toHaveBeenCalledWith({ DOCK: false, WEIGHING_AREA: true })
})

test('shows the same type markers as the map in the layer filter', async () => {
  const user = userEvent.setup()
  renderControls()

  await user.click(screen.getByRole('button', { name: /Filter checkpoints: All/ }))

  const menu = screen.getByRole('menu')
  expect(menu.querySelector('[data-checkpoint-kind-icon="DOCK"]')).toHaveClass(
    'text-muted-foreground',
  )
  expect(menu.querySelector('[data-checkpoint-kind-icon="WEIGHING_AREA"]')).toHaveClass(
    'text-muted-foreground',
  )
  expect(menu.querySelectorAll('[data-checkpoint-status]')).toHaveLength(0)
})

test('does not allow hiding the last visible checkpoint layer', async () => {
  const user = userEvent.setup()

  render(
    <CheckpointMapControls
      hasMatches
      layerVisibility={{ DOCK: true, WEIGHING_AREA: false }}
      onLayerVisibilityChange={vi.fn()}
      onSearchChange={vi.fn()}
      onStatusChange={vi.fn()}
      search=""
      status="all"
    />,
  )

  await user.click(screen.getByRole('button', { name: /Filter checkpoints: All/ }))
  expect(screen.getByRole('menuitemcheckbox', { name: 'Docks' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
})
