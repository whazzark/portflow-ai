import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { TRANSPORT_COMPANIES } from '../support/fixtures'
import { mockTransportCompanies, renderTransportCompanies } from '../support/test-helpers'

test('searches only the selected lifecycle by normalized current name', async () => {
  const user = userEvent.setup()
  mockTransportCompanies()

  renderTransportCompanies()
  const list = await screen.findByRole('list', { name: 'Available transport companies' })
  await user.type(screen.getByRole('textbox', { name: 'Search transport companies' }), '  BETA  ')

  expect(within(list).getByRole('button', { name: /Bêta Logistique/ })).toBeInTheDocument()
  expect(within(list).getByText('Bêta', { selector: 'mark' })).toBeInTheDocument()
  expect(within(list).queryByText('Atlantic Transport')).not.toBeInTheDocument()
})

test('uses stable default ordering without rendering a list header or ordering control', async () => {
  const user = userEvent.setup()
  mockTransportCompanies()

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })

  expect(screen.queryByText('Company name')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Sort company names/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: /Archived \(1\)/ }))
  await screen.findByRole('list', { name: 'Archived transport companies' })
  expect(screen.queryByRole('button', { name: /Sort company names/ })).not.toBeInTheDocument()
})

test('uses ascending UUID order to keep equal names stable', async () => {
  mockTransportCompanies([
    ...TRANSPORT_COMPANIES,
    {
      ...TRANSPORT_COMPANIES[0],
      id: '00000000-0000-4000-8000-000000000000',
    },
  ])

  renderTransportCompanies()
  const list = await screen.findByRole('list', { name: 'Available transport companies' })
  const atlanticItems = within(list)
    .getAllByText('Atlantic Transport')
    .map((name) => name.closest('li'))

  expect(atlanticItems).toHaveLength(2)
  expect(atlanticItems[0]).toHaveTextContent('00000000-0000-4000-8000-000000000000')
  expect(atlanticItems[1]).toHaveTextContent('00000000-0000-4000-8000-000000000001')
})
