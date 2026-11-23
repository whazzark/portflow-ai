import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  HighlightedMatch,
  ResourceMapSearch,
} from '@/components/resource-map/resource-map-search-field'

type Item = { id: string; name: string; kindLabel: string }

const ITEMS: Item[] = [
  { id: 'dock:1', name: 'Quai Chef de Baie 1', kindLabel: 'Dock' },
  { id: 'weighing-area:2', name: 'Pont-bascule Chef de Baie', kindLabel: 'Weighing area' },
]

function Harness({
  onSelect = vi.fn(),
  onSubmitAll = vi.fn(),
}: {
  onSelect?: (item: Item) => void
  onSubmitAll?: () => void
}) {
  const [value, setValue] = useState('')
  const items = value ? ITEMS.filter((item) => item.name.toLowerCase().includes(value)) : []

  return (
    <ResourceMapSearch<Item>
      footer={`${items.length} of 12 available · Enter to zoom to all matches`}
      getItemKey={(item) => item.id}
      groups={[{ label: 'Checkpoints', items }]}
      id="search"
      label="Search checkpoints"
      listLabel="Matching checkpoints"
      onSelect={onSelect}
      onSubmitAll={onSubmitAll}
      onValueChange={setValue}
      renderItem={(item) => (
        <>
          <HighlightedMatch search={value} text={item.name} />
          <span>{item.kindLabel}</span>
        </>
      )}
      value={value}
    />
  )
}

describe('ResourceMapSearch', () => {
  it('lists matches under the field with the summary footer', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByRole('combobox', { name: 'Search checkpoints' }), 'chef')

    expect(await screen.findByRole('listbox', { name: 'Matching checkpoints' })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getByRole('option', { name: /Quai Chef de Baie 1/ })).toHaveTextContent('Dock')
    expect(screen.getByText('2 of 12 available · Enter to zoom to all matches')).toBeInTheDocument()
  })

  it('picks a match with the pointer without rewriting the search', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    const input = screen.getByRole('combobox', { name: 'Search checkpoints' })

    await user.type(input, 'chef')
    await user.click(await screen.findByRole('option', { name: /Pont-bascule/ }))

    expect(onSelect).toHaveBeenCalledWith(ITEMS[1])
    expect(input).toHaveValue('chef')
  })

  it('picks the highlighted match from the keyboard', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onSubmitAll = vi.fn()
    render(<Harness onSelect={onSelect} onSubmitAll={onSubmitAll} />)

    await user.type(screen.getByRole('combobox', { name: 'Search checkpoints' }), 'chef')
    await screen.findByRole('listbox')
    // biome-ignore lint/security/noSecrets: keyboard sequence, not a secret
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onSelect).toHaveBeenCalledWith(ITEMS[0])
    expect(onSubmitAll).not.toHaveBeenCalled()
  })

  it('asks to frame all matches on Enter without a highlighted match', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onSubmitAll = vi.fn()
    render(<Harness onSelect={onSelect} onSubmitAll={onSubmitAll} />)

    await user.type(screen.getByRole('combobox', { name: 'Search checkpoints' }), 'chef{Enter}')

    expect(onSubmitAll).toHaveBeenCalledOnce()
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('HighlightedMatch', () => {
  it('marks a match whatever its case and accents, in the text’s own spelling', () => {
    const { container } = render(<HighlightedMatch search="BETA" text="Bêta Dock" />)

    expect(container.querySelector('mark')).toHaveTextContent('Bêta')
    expect(container).toHaveTextContent('Bêta Dock')
  })
})
