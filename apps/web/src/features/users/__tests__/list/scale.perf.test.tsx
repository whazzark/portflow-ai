import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { UserDto } from '@/features/users/types'
import { USERS } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'

test('SC-003: presents the selected view and its count for a 200-user collection', async () => {
  const collection: UserDto[] = Array.from({ length: 200 }, (_, index) => ({
    ...USERS[index % USERS.length],
    id: `scale-${index}`,
    email: `user${index}@portflow.test`,
    accessStatus: index % 4 === 0 ? 'PENDING' : 'ACTIVE',
  })) as UserDto[]
  const activeCount = collection.filter((entry) => entry.accessStatus === 'ACTIVE').length

  mockUsers(undefined, collection)

  const started = performance.now()
  renderUsers()
  const table = await screen.findByRole('table', { name: 'Active users' })
  await screen.findByRole('tab', { name: new RegExp(`Active \\(${activeCount}\\)`) })
  const elapsed = performance.now() - started

  expect(within(table).getAllByRole('row').length).toBeGreaterThan(1)
  expect(elapsed).toBeLessThan(2000)
})
