import { toast } from 'sonner'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { copyText } from '@/helpers/copy-text'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const stubClipboard = (writeText?: (text: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  })

describe('copyText', () => {
  afterEach(() => vi.clearAllMocks())

  test('copies the text and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)

    await expect(copyText('46.1557, -1.2270', 'Coordinates')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('46.1557, -1.2270')
    expect(toast.success).toHaveBeenCalledWith('Coordinates copied')
  })

  test('reports a refused clipboard instead of claiming success', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')))

    await expect(copyText('x', 'Coordinates')).resolves.toBe(false)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Coordinates could not be copied')
  })

  test('reports a missing clipboard', async () => {
    stubClipboard()

    await expect(copyText('x', 'Coordinates')).resolves.toBe(false)
    expect(toast.error).toHaveBeenCalledWith('Coordinates could not be copied')
  })
})
