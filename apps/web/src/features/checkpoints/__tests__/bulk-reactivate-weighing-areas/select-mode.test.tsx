import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { WEIGHING_AREAS } from '@/features/weighing-areas/__tests__/support/fixtures'
import { weighingAreasSequenceHandler } from '@/features/weighing-areas/__tests__/support/handlers'
import { weighingAreaQueries } from '@/features/weighing-areas/queries/weighing-area-queries'
import { server } from '@/test/msw/server'
import { mockDocks, renderCheckpoints } from '../support/test-helpers'

vi.mock(
  '@/features/checkpoints/map/checkpoint-map',
  async () => import('@/features/checkpoints/__tests__/support/mock-checkpoint-map'),
)

const ALPHA_SCALE = WEIGHING_AREAS[0]
const RETIRED_SCALE = WEIGHING_AREAS[1]
const GAMMA_SCALE = WEIGHING_AREAS[3]

test('offers both available and archived weighing areas as checkable while nothing is checked', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?status=all')

  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))

  expect(
    screen.getByRole('button', { name: `Select weighing area ${ALPHA_SCALE.name}` }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: `Select weighing area ${RETIRED_SCALE.name}` }),
  ).toBeInTheDocument()
})

test('checking an archived weighing area fixes the intent to reactivation and excludes available ones', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?status=all')

  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))
  await user.click(
    screen.getByRole('button', { name: `Select weighing area ${RETIRED_SCALE.name}` }),
  )

  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()
  // The selection is homogeneous by construction: available markers stop being checkable.
  expect(
    screen.queryByRole('button', { name: `Select weighing area ${ALPHA_SCALE.name}` }),
  ).not.toBeInTheDocument()
  // A second archived weighing area is still checkable.
  expect(
    screen.getByRole('button', { name: `Select weighing area ${GAMMA_SCALE.name}` }),
  ).toBeInTheDocument()
})

test('checking an available weighing area fixes the intent to archival and excludes archived ones', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?status=all')

  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))
  await user.click(screen.getByRole('button', { name: `Select weighing area ${ALPHA_SCALE.name}` }))

  expect(screen.getByRole('button', { name: 'Archive selected' })).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: `Select weighing area ${RETIRED_SCALE.name}` }),
  ).not.toBeInTheDocument()
})

test('clearing the selection makes both statuses checkable again', async () => {
  mockDocks()
  const user = userEvent.setup()
  renderCheckpoints('/checkpoints?status=all')

  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))
  await user.click(
    screen.getByRole('button', { name: `Select weighing area ${RETIRED_SCALE.name}` }),
  )
  await user.click(screen.getByRole('button', { name: 'Clear selection' }))

  expect(
    screen.getByRole('button', { name: `Select weighing area ${ALPHA_SCALE.name}` }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: `Select weighing area ${RETIRED_SCALE.name}` }),
  ).toBeInTheDocument()
})

test('selects several archived weighing areas together', async () => {
  mockDocks()
  const user = userEvent.setup()
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderCheckpoints('/checkpoints?status=archived')

  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))
  await user.click(
    screen.getByRole('button', { name: `Select weighing area ${RETIRED_SCALE.name}` }),
  )
  await user.click(screen.getByRole('button', { name: `Select weighing area ${GAMMA_SCALE.name}` }))

  expect(screen.getByText('2 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()
})

test('drops a checked weighing area a failed refresh removes rather than flipping to archival', async () => {
  mockDocks()
  server.use(weighingAreasSequenceHandler([{ areas: WEIGHING_AREAS }, { errorStatus: 503 }]))
  const user = userEvent.setup()
  const { queryClient } = renderCheckpoints('/checkpoints?status=all')

  await user.click(await screen.findByRole('button', { name: 'Select weighing areas' }))
  await user.click(
    screen.getByRole('button', { name: `Select weighing area ${RETIRED_SCALE.name}` }),
  )
  expect(screen.getByRole('button', { name: 'Reactivate selected' })).toBeInTheDocument()

  await queryClient.invalidateQueries({ queryKey: weighingAreaQueries.list().queryKey })

  // The failed refresh leaves no weighing area to resolve the checked id against. The selection
  // goes with them: keeping it would fall back to an archival intent and offer — then send — the
  // opposite bulk action over ids that are archived already.
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Reactivate selected' })).not.toBeInTheDocument(),
  )
  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})
