import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResourceMapModeBanner } from '@/components/resource-map/resource-map-mode-banner'

describe('ResourceMapModeBanner', () => {
  it('announces the mode and offers its single action', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(
      <ResourceMapModeBanner actionLabel="Cancel" onAction={onAction}>
        Placing a new dock · click the map where trucks are loaded
      </ResourceMapModeBanner>,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Placing a new dock · click the map where trucks are loaded',
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onAction).toHaveBeenCalledOnce()
  })
})
