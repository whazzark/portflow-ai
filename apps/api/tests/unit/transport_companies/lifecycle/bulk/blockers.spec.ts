import { test } from '@japa/runner'

import {
  findBulkArchiveBlockers,
  indexCompaniesById,
} from '#transport_companies/shared/transport_company_lifecycle_blockers'

// biome-ignore lint/security/noSecrets: test group name, not a secret
test.group('findBulkArchiveBlockers', () => {
  test('classifies an unknown id as NOT_FOUND without a name', ({ assert }) => {
    const companiesById = indexCompaniesById([])

    const blockers = findBulkArchiveBlockers(['unknown-id'], companiesById, new Set())

    assert.deepEqual(blockers, [{ id: 'unknown-id', reason: 'NOT_FOUND' }])
  })

  test('classifies an archived company as ALREADY_ARCHIVED', ({ assert }) => {
    const companiesById = indexCompaniesById([
      { id: 'a', name: 'Loire Vrac Transport', status: 'ARCHIVED' as const },
    ])

    const blockers = findBulkArchiveBlockers(['a'], companiesById, new Set())

    assert.deepEqual(blockers, [
      { id: 'a', name: 'Loire Vrac Transport', reason: 'ALREADY_ARCHIVED' },
    ])
  })

  test('classifies a company providing an available truck as HAS_AVAILABLE_TRUCKS', ({
    assert,
  }) => {
    const companiesById = indexCompaniesById([
      { id: 'a', name: 'Atlantique Transport Routier', status: 'AVAILABLE' as const },
    ])

    const blockers = findBulkArchiveBlockers(['a'], companiesById, new Set(['a']))

    assert.deepEqual(blockers, [
      { id: 'a', name: 'Atlantique Transport Routier', reason: 'HAS_AVAILABLE_TRUCKS' },
    ])
  })

  test('returns no blocker for an eligible company', ({ assert }) => {
    const companiesById = indexCompaniesById([
      { id: 'a', name: 'Grand Ouest Camions', status: 'AVAILABLE' as const },
    ])

    const blockers = findBulkArchiveBlockers(['a'], companiesById, new Set())

    assert.deepEqual(blockers, [])
  })

  test('reports at most one reason per company, in the documented order', ({ assert }) => {
    // Already archived AND (hypothetically) flagged with an available truck: ALREADY_ARCHIVED wins.
    const companiesById = indexCompaniesById([
      { id: 'a', name: 'Loire Vrac Transport', status: 'ARCHIVED' as const },
    ])

    const blockers = findBulkArchiveBlockers(['a'], companiesById, new Set(['a']))

    assert.equal(blockers.length, 1)
    assert.equal(blockers[0].reason, 'ALREADY_ARCHIVED')
  })

  test('preserves the requested order across mixed outcomes', ({ assert }) => {
    const companiesById = indexCompaniesById([
      { id: 'eligible', name: 'Grand Ouest Camions', status: 'AVAILABLE' as const },
      { id: 'blocked-truck', name: 'Atlantique Transport Routier', status: 'AVAILABLE' as const },
      { id: 'blocked-archived', name: 'Loire Vrac Transport', status: 'ARCHIVED' as const },
    ])

    const blockers = findBulkArchiveBlockers(
      ['blocked-archived', 'unknown', 'blocked-truck', 'eligible'],
      companiesById,
      new Set(['blocked-truck']),
    )

    assert.deepEqual(
      blockers.map((blocker) => blocker.id),
      ['blocked-archived', 'unknown', 'blocked-truck'],
    )
  })

  test('returns nothing for a fully eligible selection', ({ assert }) => {
    const companiesById = indexCompaniesById([
      { id: 'a', name: 'Grand Ouest Camions', status: 'AVAILABLE' as const },
      { id: 'b', name: 'Armor Fret Services', status: 'AVAILABLE' as const },
    ])

    const blockers = findBulkArchiveBlockers(['a', 'b'], companiesById, new Set())

    assert.deepEqual(blockers, [])
  })
})
