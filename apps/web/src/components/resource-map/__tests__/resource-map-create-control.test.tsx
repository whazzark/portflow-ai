import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResourceMapCreateControl } from '../resource-map-create-control'

describe('ResourceMapCreateControl', () => {
  it('renders nothing when there are no actions', () => {
    const { container } = render(<ResourceMapCreateControl actions={[]} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders a single labeled button and calls onSelect when there is one action', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ResourceMapCreateControl actions={[{ key: 'DOCK', label: 'New dock', onSelect }]} />)

    const button = screen.getByRole('button', { name: 'New dock' })
    await user.click(button)

    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('renders a menu trigger with one item per action when there are several', async () => {
    const user = userEvent.setup()
    const onSelectDock = vi.fn()
    const onSelectWeighingArea = vi.fn()
    render(
      <ResourceMapCreateControl
        actions={[
          { key: 'DOCK', label: 'New dock', onSelect: onSelectDock },
          { key: 'WEIGHING_AREA', label: 'New weighing area', onSelect: onSelectWeighingArea },
        ]}
      />,
    )

    expect(screen.queryByRole('button', { name: 'New dock' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create' }))

    const dockItem = await screen.findByRole('menuitem', { name: 'New dock' })
    await user.click(dockItem)

    expect(onSelectDock).toHaveBeenCalledTimes(1)
    expect(onSelectWeighingArea).not.toHaveBeenCalled()
  })
})
