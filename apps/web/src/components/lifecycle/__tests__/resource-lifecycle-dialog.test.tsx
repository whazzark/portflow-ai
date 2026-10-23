import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type ResourceLifecycleConfig,
  ResourceLifecycleDialog,
} from '../resource-lifecycle-actions'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const baseConfig = (
  overrides: Partial<ResourceLifecycleConfig<{ doors: number }>> = {},
): ResourceLifecycleConfig<{ doors: number }> => ({
  singular: 'dock',
  name: 'North Dock',
  submit: vi.fn().mockResolvedValue({ doors: 2 }),
  refresh: vi.fn(),
  isPending: false,
  ...overrides,
})

describe('ResourceLifecycleDialog', () => {
  afterEach(() => vi.clearAllMocks())

  it('keeps the canonical title and toast for a resource that opts into nothing', async () => {
    const user = userEvent.setup()
    render(<ResourceLifecycleDialog action="archive" config={baseConfig()} onClose={vi.fn()} />)

    expect(screen.getByRole('alertdialog', { name: 'Archive dock?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Archive' }))

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('North Dock'), undefined)
  })

  it('uses the title, toast detail and toast action a resource supplies', async () => {
    const user = userEvent.setup()
    const onView = vi.fn()
    render(
      <ResourceLifecycleDialog
        action="archive"
        config={baseConfig({
          describeTitle: () => 'Archive North Dock?',
          describeSuccessDetail: (_action, result) => `${result.doors} doors archived with it.`,
          successAction: () => ({ label: 'View', onClick: onView }),
        })}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('alertdialog', { name: 'Archive North Dock?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Archive' }))

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('North Dock'), {
      description: '2 doors archived with it.',
      action: { label: 'View', onClick: onView },
    })
  })
})
