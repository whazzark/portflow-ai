import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import {
  CoordinateField,
  useCoordinateFields,
} from '@/components/resource-map/resource-placement-fields'

function Harness({ initialPending = null }: { initialPending?: LatLng | null }) {
  const [pending, setPending] = useState<LatLng | null>(initialPending)
  const fields = useCoordinateFields(pending, setPending)

  return (
    <div>
      <CoordinateField
        axis="latitude"
        error={fields.latitude.error}
        idPrefix="test"
        onChange={fields.latitude.onChange}
        text={fields.latitude.text}
      />
      <CoordinateField
        axis="longitude"
        error={fields.longitude.error}
        idPrefix="test"
        onChange={fields.longitude.onChange}
        text={fields.longitude.text}
      />
      <button onClick={() => setPending({ latitude: 10, longitude: 20 })} type="button">
        simulate external placement
      </button>
      <span data-testid="pending">{pending ? `${pending.latitude},${pending.longitude}` : ''}</span>
    </div>
  )
}

describe('resource placement fields', () => {
  it('renders both fields with unique, prefixed ids', () => {
    render(<Harness />)

    expect(screen.getByLabelText('Latitude')).toHaveAttribute('id', 'test-latitude')
    expect(screen.getByLabelText('Longitude')).toHaveAttribute('id', 'test-longitude')
  })

  it('does not show an error before a field has been touched', () => {
    render(<Harness />)

    expect(screen.queryByText('Latitude is required.')).not.toBeInTheDocument()
    expect(screen.queryByText('Longitude is required.')).not.toBeInTheDocument()
  })

  it('shows a required message once a field is touched and left blank', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Latitude'), '1')
    await user.clear(screen.getByLabelText('Latitude'))

    expect(screen.getByText('Latitude is required.')).toBeInTheDocument()
  })

  it('rejects a non-numeric coordinate with a clear message', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Latitude'), 'abc')

    expect(screen.getByText('Latitude must be a number.')).toBeInTheDocument()
  })

  it('rejects an out-of-range coordinate with a clear, range-specific message', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Latitude'), '91')

    expect(screen.getByText('Latitude must be between -90 and 90.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Longitude'))
    await user.type(screen.getByLabelText('Longitude'), '-181')

    expect(screen.getByText('Longitude must be between -180 and 180.')).toBeInTheDocument()
  })

  it('accepts the exact boundary coordinates', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Latitude'), '90')
    await user.type(screen.getByLabelText('Longitude'), '-180')

    expect(screen.queryByText(/must be between/)).not.toBeInTheDocument()
    expect(screen.getByTestId('pending')).toHaveTextContent('90,-180')
  })

  it('commits to the pending placement only once both axes parse successfully', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Latitude'), '48.1')
    expect(screen.getByTestId('pending')).toBeEmptyDOMElement()

    await user.type(screen.getByLabelText('Longitude'), '2.3')
    expect(screen.getByTestId('pending')).toHaveTextContent('48.1,2.3')
  })

  it('syncs both fields when the pending placement changes externally (e.g. a map click or drag)', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'simulate external placement' }))

    expect(screen.getByLabelText('Latitude')).toHaveValue('10')
    expect(screen.getByLabelText('Longitude')).toHaveValue('20')
  })

  it('does not reset a decimal being typed character by character', async () => {
    const user = userEvent.setup()
    render(<Harness initialPending={{ latitude: 48, longitude: 2 }} />)

    const latitudeInput = screen.getByLabelText('Latitude')
    await user.clear(latitudeInput)
    await user.type(latitudeInput, '48.10')

    expect(latitudeInput).toHaveValue('48.10')
  })
})
