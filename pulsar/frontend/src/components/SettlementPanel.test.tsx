/**
 * SettlementPanel.test.tsx
 *
 * Unit tests for SettlementPanel component.
 * Validates Requirements 6.4 (settle channel UI) and 7.4 (tx hash explorer link).
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettlementPanel } from './SettlementPanel'

const CHANNEL_ID = 'chan-test-456'

const MOCK_SETTLEMENT = {
  txHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
  amountPaidUsdc: 0.05,
  refundUsdc: 9.95,
  explorerUrl: 'https://stellar.expert/explorer/testnet/tx/abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
}

function mockFetchSuccess() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => MOCK_SETTLEMENT,
  }))
}

function mockFetchError(message: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: message }),
  }))
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('SettlementPanel — button render (Req 6.4)', () => {
  it('renders the "Settle Channel" button', () => {
    render(
      <SettlementPanel
        channelId={CHANNEL_ID}
        totalCostUsdc={0.05}
        remainingBudgetUsdc={9.95}
        taskComplete={true}
      />
    )
    expect(screen.getByRole('button', { name: /settle channel/i })).toBeInTheDocument()
  })

  it('button is disabled when channelId is null', () => {
    render(
      <SettlementPanel
        channelId={null}
        totalCostUsdc={0}
        remainingBudgetUsdc={10}
        taskComplete={true}
      />
    )
    expect(screen.getByRole('button', { name: /settle channel/i })).toBeDisabled()
  })

  it('button is disabled when task is not complete', () => {
    render(
      <SettlementPanel
        channelId={CHANNEL_ID}
        totalCostUsdc={0}
        remainingBudgetUsdc={10}
        taskComplete={false}
      />
    )
    expect(screen.getByRole('button', { name: /settle channel/i })).toBeDisabled()
  })
})

describe('SettlementPanel — after settlement (Req 6.4, 7.4)', () => {
  it('renders tx hash as a link to Stellar Testnet explorer after settlement', async () => {
    mockFetchSuccess()

    render(
      <SettlementPanel
        channelId={CHANNEL_ID}
        totalCostUsdc={0.05}
        remainingBudgetUsdc={9.95}
        taskComplete={true}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /settle channel/i }))

    const explorerLink = await screen.findByRole('link', { name: /view on stellar explorer/i })
    expect(explorerLink).toBeInTheDocument()
    expect(explorerLink).toHaveAttribute(
      'href',
      `https://stellar.expert/explorer/testnet/tx/${MOCK_SETTLEMENT.txHash}`
    )
    expect(explorerLink).toHaveAttribute('target', '_blank')
  })

  it('shows final cost after settlement', async () => {
    mockFetchSuccess()

    render(
      <SettlementPanel
        channelId={CHANNEL_ID}
        totalCostUsdc={0.05}
        remainingBudgetUsdc={9.95}
        taskComplete={true}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /settle channel/i }))

    await waitFor(() => {
      expect(screen.getByText('0.0500 USDC')).toBeInTheDocument()
    })
  })

  it('shows refund amount after settlement', async () => {
    mockFetchSuccess()

    render(
      <SettlementPanel
        channelId={CHANNEL_ID}
        totalCostUsdc={0.05}
        remainingBudgetUsdc={9.95}
        taskComplete={true}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /settle channel/i }))

    await waitFor(() => {
      expect(screen.getByText('9.9500 USDC')).toBeInTheDocument()
    })
  })

  it('shows the tx hash in the settlement details', async () => {
    mockFetchSuccess()

    render(
      <SettlementPanel
        channelId={CHANNEL_ID}
        totalCostUsdc={0.05}
        remainingBudgetUsdc={9.95}
        taskComplete={true}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /settle channel/i }))

    await screen.findByText(MOCK_SETTLEMENT.txHash)
  })
})

describe('SettlementPanel — error handling (Req 6.4)', () => {
  it('shows error message when settlement fails', async () => {
    mockFetchError('Insufficient balance')

    render(
      <SettlementPanel
        channelId={CHANNEL_ID}
        totalCostUsdc={0.05}
        remainingBudgetUsdc={9.95}
        taskComplete={true}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /settle channel/i }))

    await screen.findByText('Insufficient balance')
  })
})
