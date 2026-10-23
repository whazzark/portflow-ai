import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { describe, expect, it, vi } from 'vitest'
import { ResourceMapCard } from '@/components/resource-map/resource-map-card'

describe('ResourceMapCard', () => {
  it('is a complementary region named by its heading, with its subtitle and body', () => {
    render(
      <ResourceMapCard anchor={null} subtitle="Dock · Available" title="North Dock">
        <p>GPS location</p>
      </ResourceMapCard>,
    )

    const card = screen.getByRole('complementary', { name: 'North Dock' })
    expect(card).toHaveTextContent('Dock · Available')
    expect(card).toHaveTextContent('GPS location')
    expect(screen.getByRole('heading', { level: 2, name: 'North Dock' })).toBeInTheDocument()
  })

  it('moves focus to its heading when it opens', () => {
    render(<ResourceMapCard anchor={null} title="North Dock" />)

    expect(screen.getByRole('heading', { name: 'North Dock' })).toHaveFocus()
  })

  it('leaves focus alone when asked to', () => {
    render(<ResourceMapCard anchor={null} autoFocusHeading={false} title="North Dock" />)

    expect(screen.getByRole('heading', { name: 'North Dock' })).not.toHaveFocus()
  })

  it('closes from its Close button and from Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ResourceMapCard anchor={null} onClose={onClose} title="North Dock" />)

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('offers no Close button when it cannot be dismissed', () => {
    render(<ResourceMapCard anchor={null} title="New dock" />)

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })

  it('renders its footer after the body', () => {
    render(
      <ResourceMapCard anchor={null} footer={<button type="button">Edit</button>} title="Dock">
        <p>Body</p>
      </ResourceMapCard>,
    )

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })
})

describe('ResourceMapCard focus and portals', () => {
  it('leaves Escape from a dialog portaled out of the card to that dialog', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <ResourceMapCard anchor={null} onClose={onClose} title="North Dock">
        {createPortal(<input aria-label="Comment" />, document.body)}
      </ResourceMapCard>,
    )

    await user.click(screen.getByRole('textbox', { name: 'Comment' }))
    await user.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
  })

  it('hands focus back to what opened it when it closes', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)} type="button">
            Open
          </button>
          {open && <ResourceMapCard anchor={null} onClose={() => setOpen(false)} title="Dock" />}
        </>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('heading', { name: 'Dock' })).toHaveFocus()
    await user.keyboard('{Escape}')

    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
  })
})
