/**
 * auth/sep10.ts
 * 
 * SEP-10 Stellar Web Authentication implementation.
 * Challenge-response authentication using Stellar account signatures.
 * 
 * Spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md
 */

import {
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  Transaction,
  Account,
  BASE_FEE,
} from '@stellar/stellar-sdk'
import { generateToken } from './jwt.js'

const SERVER_KEYPAIR = process.env.SERVER_SECRET_KEY
  ? Keypair.fromSecret(process.env.SERVER_SECRET_KEY)
  : Keypair.random()

const NETWORK_PASSPHRASE = Networks.TESTNET
const CHALLENGE_EXPIRY_SECONDS = 300 // 5 minutes

export interface Sep10Challenge {
  transaction: string // XDR-encoded transaction
  networkPassphrase: string
}

export interface Sep10Token {
  token: string
  publicKey: string
}

/**
 * Generate a SEP-10 challenge transaction for a client.
 * 
 * The client must sign this transaction with their Stellar account
 * and return it to complete authentication.
 */
export function generateChallenge(clientPublicKey: string): Sep10Challenge {
  // Validate public key format
  if (!clientPublicKey.match(/^G[A-Z2-7]{55}$/)) {
    throw new Error('Invalid Stellar public key')
  }

  const serverAccount = new Account(SERVER_KEYPAIR.publicKey(), '-1')
  const now = Math.floor(Date.now() / 1000)
  const minTime = now
  const maxTime = now + CHALLENGE_EXPIRY_SECONDS

  // Build challenge transaction with manage_data operation
  const transaction = new TransactionBuilder(serverAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
    timebounds: {
      minTime,
      maxTime,
    },
  })
    .addOperation(
      Operation.manageData({
        name: 'Pulsar auth',
        value: Buffer.from(crypto.getRandomValues(new Uint8Array(64))),
        source: clientPublicKey,
      })
    )
    .build()

  // Server signs the transaction
  transaction.sign(SERVER_KEYPAIR)

  return {
    transaction: transaction.toXDR(),
    networkPassphrase: NETWORK_PASSPHRASE,
  }
}

/**
 * Verify a signed SEP-10 challenge transaction and issue JWT token.
 * 
 * Validates:
 * - Transaction is properly signed by both server and client
 * - Transaction has not expired
 * - Transaction structure matches expected format
 */
export function verifyChallenge(signedTransactionXdr: string): Sep10Token {
  let transaction: Transaction

  try {
    transaction = new Transaction(signedTransactionXdr, NETWORK_PASSPHRASE)
  } catch (err) {
    throw new Error('Invalid transaction XDR')
  }

  // Verify transaction has not expired
  const now = Math.floor(Date.now() / 1000)
  if (transaction.timeBounds) {
    if (now < Number(transaction.timeBounds.minTime)) {
      throw new Error('Challenge transaction not yet valid')
    }
    if (now > Number(transaction.timeBounds.maxTime)) {
      throw new Error('Challenge transaction has expired')
    }
  } else {
    throw new Error('Challenge transaction missing timebounds')
  }

  // Verify transaction structure
  if (transaction.operations.length !== 1) {
    throw new Error('Challenge transaction must have exactly one operation')
  }

  const operation = transaction.operations[0]
  if (operation.type !== 'manageData') {
    throw new Error('Challenge operation must be manageData')
  }

  const clientPublicKey = operation.source
  if (!clientPublicKey) {
    throw new Error('Challenge operation missing source account')
  }

  // Verify server signature
  const serverSigned = transaction.signatures.some((sig) => {
    try {
      return SERVER_KEYPAIR.verify(transaction.hash(), sig.signature())
    } catch {
      return false
    }
  })

  if (!serverSigned) {
    throw new Error('Challenge transaction not signed by server')
  }

  // Verify client signature
  const clientKeypair = Keypair.fromPublicKey(clientPublicKey)
  const clientSigned = transaction.signatures.some((sig) => {
    try {
      return clientKeypair.verify(transaction.hash(), sig.signature())
    } catch {
      return false
    }
  })

  if (!clientSigned) {
    throw new Error('Challenge transaction not signed by client')
  }

  // Issue JWT token
  const token = generateToken(clientPublicKey)

  return {
    token,
    publicKey: clientPublicKey,
  }
}
