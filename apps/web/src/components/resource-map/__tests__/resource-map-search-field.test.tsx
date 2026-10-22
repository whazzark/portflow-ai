import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  ResourceMapSearch,
  type ResourceMapSearchItem,
} from '@/components/resource-map/resource-map-search-field'

const ITEMS: ResourceMapSearchItem[] = [
  { id: 'dock:1', name: 'Quai Chef de Baie 1', kindLabel: 'Dock' },
  { id: 'weighing-area:2', name: 'Pont-bascule Chef de Baie', kindLabel: 'Weighing area' },
]

function Harness({
  onPick = vi.fn(),
  onSubmitAll = vi.fn(),
}: {
  onPick?: (id: string) => void
  onSubmitAll?: () => void
}) {
  const [value, setValue] = useState('')
  const items = value ? ITEMS.filter((item) => item.name.toLowerCase().includes(value)) : []

  return (
    <ResourceMapSearch
      footer={`${items.length} of 12 available · Enter to zoom to all matches`}
      items={items}
      label="Search checkpoints"
      listLabel="Matching checkpoints"
      onPick={onPick}
      onSubmitAll={onSubmitAll}
      onValueChange={setValue}
      value={value}
    />
  )
}

describe('ResourceMapSearch', () => {
  it('lists matches under the field with their kind and the summary footer', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByRole('combobox', { name: 'Search checkpoints' }), 'chef')

    const list = await screen.findByRole('listbox', { name: 'Matching checkpoints' })
    expect(list).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getByRole('option', { name: /Quai Chef de Baie 1/ })).toHaveTextContent('Dock')
    expect(screen.getByText('2 of 12 available · Enter to zoom to all matches')).toBeInTheDocument()
    expect(document.querySelector('mark')).toHaveTextContent(/chef/i)
  })

  it('picks a match with the pointer without rewriting the search', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<Harness onPick={onPick} />)
    const input = screen.getByRole('combobox', { name: 'Search checkpoints' })

    await user.type(input, 'chef')
    await user.click(await screen.findByRole('option', { name: /Pont-bascule/ }))

    expect(onPick).toHaveBeenCalledWith('weighing-area:2')
    expect(input).toHaveValue('chef')
  })

  it('picks the highlighted match from the keyboard', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const onSubmitAll = vi.fn()
    render(<Harness onPick={onPick} onSubmitAll={onSubmitAll} />)

    await user.type(screen.getByRole('combobox', { name: 'Search checkpoints' }), 'chef')
    await screen.findByRole('listbox')
    // biome-ignore lint/security/noSecrets: keyboard sequence, not a secret
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onPick).toHaveBeenCalledWith('dock:1')
    expect(onSubmitAll).not.toHaveBeenCalled()
  })

  it('asks to zoom to all matches on Enter without a highlighted match', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const onSubmitAll = vi.fn()
    render(<Harness onPick={onPick} onSubmitAll={onSubmitAll} />)

    await user.type(screen.getByRole('combobox', { name: 'Search checkpoints' }), 'chef{Enter}')

    expect(onSubmitAll).toHaveBeenCalledOnce()
    expect(onPick).not.toHaveBeenCalled()
  })
})
