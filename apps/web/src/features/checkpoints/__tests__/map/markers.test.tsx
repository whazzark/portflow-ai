import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

beforeEach(() => {
  mockDocks()
})

test('exposes both marker statuses in accessible labels and the map legend', async () => {
  renderCheckpoints()

  expect(
    await screen.findByRole('button', { name: 'View dock North Dock (Available)' }),
  ).toHaveAttribute('data-status', 'AVAILABLE')
  expect(screen.getByRole('button', { name: 'View dock Retired Dock (Archived)' })).toHaveAttribute(
    'data-status',
    'ARCHIVED',
  )
  expect(
    await screen.findByRole('button', { name: 'View weighing area Alpha Scale (Available)' }),
  ).toHaveAttribute('data-checkpoint-kind', 'WEIGHING_AREA')
  expect(
    await screen.findByRole('button', { name: 'View weighing area Retired Scale (Archived)' }),
  ).toHaveAttribute('data-status', 'ARCHIVED')

  const legend = screen.getByRole('region', { name: 'Checkpoint legend' })
  expect(legend).toHaveTextContent('Available')
  expect(legend).toHaveTextContent('Archived')
  expect(legend).toHaveTextContent('Dock')
  expect(legend).toHaveTextContent('Weighing area')
})

test('exposes a dock-name tooltip on marker hover and focus', async () => {
  renderCheckpoints()
  const marker = await screen.findByRole('button', {
    name: 'View dock North Dock (Available)',
  })

  fireEvent.mouseEnter(marker)
  expect(screen.getByRole('tooltip')).toHaveTextContent('North Dock')
  expect(screen.getByRole('tooltip')).toHaveTextContent('Available')
  fireEvent.mouseLeave(marker)
  fireEvent.focus(marker)
  expect(screen.getByRole('tooltip')).toHaveTextContent('North Dock')
})

test('activates a marker from the keyboard', async () => {
  renderCheckpoints()
  const marker = await screen.findByRole('button', {
    name: 'View dock North Dock (Available)',
  })

  fireEvent.keyDown(marker, { key: 'Enter' })
  expect(await screen.findByRole('heading', { name: 'North Dock' })).toBeInTheDocument()
})
