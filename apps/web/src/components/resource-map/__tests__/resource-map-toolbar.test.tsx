import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResourceMapToggleGroup } from '@/components/resource-map/resource-map-toolbar'

function items(pressed: { available: boolean; archived: boolean }) {
  return [
    { value: 'available' as const, label: 'Available', count: 12, pressed: pressed.available },
    { value: 'archived' as const, label: 'Archived', count: 3, pressed: pressed.archived },
  ]
}

describe('ResourceMapToggleGroup', () => {
  it('renders a named group of pressed-state toggles with their counts', () => {
    render(
      <ResourceMapToggleGroup
        countNoun="checkpoints"
        items={items({ available: true, archived: false })}
        label="Filter by checkpoint status"
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByRole('group', { name: 'Filter by checkpoint status' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Available, 12 checkpoints' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Archived, 3 checkpoints' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('reports the toggled value', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(
      <ResourceMapToggleGroup
        items={items({ available: true, archived: false })}
        label="Status"
        onToggle={onToggle}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Archived, 3' }))
    expect(onToggle).toHaveBeenCalledWith('archived')
  })

  it('disables the last pressed toggle so a filter is never empty', () => {
    render(
      <ResourceMapToggleGroup
        items={items({ available: false, archived: true })}
        label="Status"
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Archived, 3' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Available, 12' })).toBeEnabled()
  })
})
