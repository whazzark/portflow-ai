import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { CheckpointMapControls } from '@/features/checkpoints/ui/checkpoint-map-controls'

function renderControls() {
  return render(
    <CheckpointMapControls
      hasMatches
      onSearchChange={vi.fn()}
      onStatusChange={vi.fn()}
      search=""
      status="all"
    />,
  )
}

test('supports keyboard navigation and escape in the status menu', async () => {
  const user = userEvent.setup()
  renderControls()

  const trigger = screen.getByRole('button', { name: 'Filter checkpoints: All' })
  await user.click(trigger)
  expect(screen.getByRole('menu')).toHaveFocus()

  await user.keyboard('{ArrowDown}')
  expect(screen.getByRole('menuitemradio', { name: 'All' })).toHaveFocus()
  await user.keyboard('{ArrowDown}')
  expect(screen.getByRole('menuitemradio', { name: 'Available' })).toHaveFocus()

  await user.keyboard('{Escape}')
  expect(screen.queryByRole('menuitemradio', { name: 'Available' })).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

test('exposes a clear action for a non-empty checkpoint search', async () => {
  const user = userEvent.setup()
  const onSearchChange = vi.fn()

  render(
    <CheckpointMapControls
      hasMatches
      onSearchChange={onSearchChange}
      onStatusChange={vi.fn()}
      search="quai"
      status="all"
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Clear search checkpoints input' }))
  expect(onSearchChange).toHaveBeenCalledWith('')
})
