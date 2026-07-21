import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { LogOutConfirmation } from '@/features/auth/ui/log-out-confirmation'

test('requires confirmation before logging out', () => {
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()

  render(
    <LogOutConfirmation
      isPending={false}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open
    />,
  )

  const confirmation = screen.getByRole('alertdialog')

  expect(within(confirmation).getByRole('heading', { name: 'Log out?' })).toBeInTheDocument()
  expect(confirmation).toHaveTextContent('You’ll need to log in again to access Portflow.')

  fireEvent.click(within(confirmation).getByRole('button', { name: 'Log out' }))

  expect(onConfirm).toHaveBeenCalledOnce()
  expect(onOpenChange).not.toHaveBeenCalled()
})

test('allows the user to cancel logging out', () => {
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()

  render(
    <LogOutConfirmation
      isPending={false}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
  expect(onConfirm).not.toHaveBeenCalled()
})

test('prevents duplicate actions while logging out', () => {
  render(<LogOutConfirmation isPending onConfirm={vi.fn()} onOpenChange={vi.fn()} open />)

  expect(screen.getByRole('button', { name: 'Logging out…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
})
