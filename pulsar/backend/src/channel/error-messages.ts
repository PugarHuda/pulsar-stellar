/**
 * error-messages.ts
 *
 * User-friendly error messages with actionable guidance.
 * Maps technical error codes to helpful explanations.
 */

import { PulsarErrorCode } from './types.js'

export interface ErrorMessage {
  technical: string
  userFriendly: string
  action?: string
  actionUrl?: string
}

export const ERROR_MESSAGES: Record<PulsarErrorCode, ErrorMessage> = {
  [PulsarErrorCode.CHANNEL_NOT_FOUND]: {
    technical: 'Channel not found',
    userFriendly: 'This payment channel doesn\'t exist or has expired.',
    action: 'Please open a new channel to continue.',
  },

  [PulsarErrorCode.CHANNEL_ALREADY_CLOSED]: {
    technical: 'Channel already closed',
    userFriendly: 'This payment channel has already been settled.',
    action: 'Open a new channel to run another task.',
  },

  [PulsarErrorCode.CHANNEL_NOT_OPEN]: {
    technical: 'Channel not open',
    userFriendly: 'This payment channel is not ready for use.',
    action: 'Please wait for the channel to open, or create a new one.',
  },

  [PulsarErrorCode.CHANNEL_OPEN_FAILED]: {
    technical: 'Failed to open channel',
    userFriendly: 'We couldn\'t create your payment channel.',
    action: 'Check your USDC balance and try again. Make sure you have at least 1 USDC.',
    actionUrl: 'https://faucet.circle.com',
  },

  [PulsarErrorCode.INSUFFICIENT_USDC_BALANCE]: {
    technical: 'Insufficient USDC balance',
    userFriendly: 'You don\'t have enough USDC for this budget.',
    action: 'Get testnet USDC from Circle faucet (free for testing).',
    actionUrl: 'https://faucet.circle.com',
  },

  [PulsarErrorCode.COMMITMENT_SIGN_FAILED]: {
    technical: 'Failed to sign commitment',
    userFriendly: 'We couldn\'t create a payment commitment for this step.',
    action: 'This might be a temporary issue. Please try again.',
  },

  [PulsarErrorCode.BUDGET_EXHAUSTED]: {
    technical: 'Budget exhausted',
    userFriendly: 'Your channel budget has been fully used.',
    action: 'Settle this channel and open a new one with a higher budget.',
  },

  [PulsarErrorCode.SETTLEMENT_FAILED]: {
    technical: 'Settlement transaction failed',
    userFriendly: 'We couldn\'t complete the settlement on Stellar.',
    action: 'This might be a network issue. We\'ll retry automatically.',
  },

  [PulsarErrorCode.SETTLEMENT_RETRY_EXCEEDED]: {
    technical: 'Settlement retry limit exceeded',
    userFriendly: 'Settlement failed after multiple attempts.',
    action: 'Please check Stellar network status and try again later.',
    actionUrl: 'https://status.stellar.org',
  },

  [PulsarErrorCode.AGENT_EXECUTION_FAILED]: {
    technical: 'Agent execution failed',
    userFriendly: 'The AI agent encountered an error while running your task.',
    action: 'Try simplifying your task description or try again.',
  },

  [PulsarErrorCode.INVALID_REQUEST]: {
    technical: 'Invalid request',
    userFriendly: 'The request data is invalid or incomplete.',
    action: 'Please check your input and try again.',
  },

  [PulsarErrorCode.INTERNAL_ERROR]: {
    technical: 'Internal server error',
    userFriendly: 'Something went wrong on our end.',
    action: 'Please try again in a moment. If the problem persists, contact support.',
  },
}

/**
 * Get user-friendly error message for a given error code.
 */
export function getUserFriendlyError(code: PulsarErrorCode): ErrorMessage {
  return ERROR_MESSAGES[code] || {
    technical: 'Unknown error',
    userFriendly: 'An unexpected error occurred.',
    action: 'Please try again or contact support.',
  }
}

/**
 * Format error for API response.
 */
export function formatErrorResponse(code: PulsarErrorCode, technicalDetails?: string) {
  const message = getUserFriendlyError(code)
  return {
    error: {
      code,
      message: message.userFriendly,
      technical: technicalDetails || message.technical,
      action: message.action,
      actionUrl: message.actionUrl,
    },
  }
}
