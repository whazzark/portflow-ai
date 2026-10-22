import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResourceMapToggleGroup } from '@/components/resource-map/resource-map-toolbar'

const items = [
  { value: 'available', label: 'Available', count: 12 },
  { value: 'archived', label: 'Archived', count: 3 },
] as const

describe('ResourceMapToggleGroup', () => {
  it('renders a named group of pressed-state toggles with their counts', () => {
    render(
      <ResourceMapToggleGroup
        items={items}
        label="Filter by checkpoint status"
        onChange={vi.fn()}
        pressed={['available']}
      />,
    )

    expect(screen.getByRole('group', { name: 'Filter by checkpoint status' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Available 12' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Archived 3' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('reports the next pressed set when a toggle changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <ResourceMapToggleGroup
        items={items}
        label="Status"
        onChange={onChange}
        pressed={['available']}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Archived 3' }))
    expect(onChange).toHaveBeenCalledWith(['available', 'archived'])
  })

  it('disables the last pressed toggle so a group is never empty', () => {
    render(
      <ResourceMapToggleGroup
        items={items}
        label="Status"
        onChange={vi.fn()}
        pressed={['archived']}
      />,
    )

    expect(screen.getByRole('button', { name: 'Archived 3' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Available 12' })).toBeEnabled()
  })
})
