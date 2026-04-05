/**
 * ChannelPanel.test.tsx
 *
 * Unit tests for ChannelPanel component.
 * Validates Requirements 6.1 (budget input form) and 6.5 (error state display).
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChannelPanel } from './ChannelPanel'

const noop = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
})

describe('ChannelPanel — form render (Req 6.1)', () => {
  it('renders the budget input with default value', () => {
    render(<ChannelPanel onChannelOpened={noop} />)
    const input = screen.getByRole('spinbutton') // type="number"
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue(10)
  })

  it('renders the Stellar public key input', () => {
    render(<ChannelPanel onChannelOpened={noop} />)
    expect(screen.getByPlaceholderText('GABC...XYZ')).toBeInTheDocument()
  })

  it('renders the "Open Channel" button', () => {
    render(<ChannelPanel onChannelOpened={noop} />)
    expect(screen.getByRole('button', { name: /open channel/i })).toBeInTheDocument()
  })

  it('button is disabled when inputs are empty', () => {
    render(<ChannelPanel onChannelOpened={noop} />)
    // Clear the budget field so both fields are effectively empty/invalid
    const button = screen.getByRole('button', { name: /open channel/i })
    // userPublicKey starts empty → button should be disabled
    expect(button).toBeDisabled()
  })
})

describe('ChannelPanel — error state display (Req 6.5)', () => {
  it('shows error message when the API returns an error', async () => {
    // Mock fetch to return an error response
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Insufficient funds' }),
    } as Response))

    const { getByPlaceholderText, getByRole, findByText } = render(
      <ChannelPanel onChannelOpened={noop} />
    )

    // Fill in required fields so the button becomes enabled
    const budgetInput = getByPlaceholderText('10.00')
    const keyInput = getByPlaceholderText('GABC...XYZ')
    const button = getByRole('button', { name: /open channel/i })

    // Use fireEvent to set values
    fireEvent.change(budgetInput, { target: { value: '5' } })
    fireEvent.change(keyInput, { target: { value: 'GABC123' } })
    fireEvent.click(button)

    const errorMsg = await findByText('Insufficient funds')
    expect(errorMsg).toBeInTheDocument()
  })

  it('shows generic error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

    const { getByPlaceholderText, getByRole, findByText } = render(
      <ChannelPanel onChannelOpened={noop} />
    )

    fireEvent.change(getByPlaceholderText('10.00'), { target: { value: '5' } })
    fireEvent.change(getByPlaceholderText('GABC...XYZ'), { target: { value: 'GABC123' } })
    fireEvent.click(getByRole('button', { name: /open channel/i }))

    expect(await findByText('Network failure')).toBeInTheDocument()
  })
})
