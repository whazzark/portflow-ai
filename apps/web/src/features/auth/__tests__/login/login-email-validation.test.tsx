import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { renderLogin } from './login-test-helpers'

test('validates email when focus leaves an invalid field', async () => {
  const user = userEvent.setup()
  await renderLogin()
  await user.click(screen.getByLabelText(/^Email address/))
  await user.tab()
  expect(screen.getByLabelText(/^Email address/)).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Password/)).toHaveAttribute('aria-invalid', 'false')
})
