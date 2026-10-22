import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResourceRowActions } from '../resource-row-actions'

describe('ResourceRowActions items', () => {
  it('offers its items to a row with no lifecycle action or edit', async () => {
    const user = userEvent.setup()
    const onShow = vi.fn()
    render(
      <ResourceRowActions
        actions={[]}
        items={[{ key: 'show', label: 'Show on map', onSelect: onShow }]}
        name="Porte Est"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Actions for Porte Est' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Show on map' }))

    expect(onShow).toHaveBeenCalledTimes(1)
  })

  it('lists Edit first, then its items, then the lifecycle actions', async () => {
    const user = userEvent.setup()
    render(
      <ResourceRowActions
        actions={['archive']}
        editable
        items={[
          { key: 'show', label: 'Show on map', onSelect: vi.fn() },
          { key: 'copy', label: 'Copy coordinates', onSelect: vi.fn() },
        ]}
        name="Porte Est"
        onEdit={vi.fn()}
        renderDialog={() => null}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Actions for Porte Est' }))

    expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).toEqual([
      'Edit',
      'Show on map',
      'Copy coordinates',
      'Archive',
    ])
  })
})
