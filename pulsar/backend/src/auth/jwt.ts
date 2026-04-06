/**
 * auth/jwt.ts
 * 
 * JWT token generation and verification for user authentication.
 */

import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'pulsar-dev-secret-change-in-production'
const JWT_EXPIRY = '24h'

export interface TokenPayload {
  publicKey: string
  iat?: number
  exp?: number
}

/**
 * Generate JWT token for authenticated user.
 */
export function generateToken(publicKey: string): string {
  return jwt.sign({ publicKey }, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

/**
 * Verify and decode JWT token.
 * Throws if token is invalid or expired.
 */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload
}

/**
 * Decode token without verification (for debugging).
 */
export function decodeToken(token: string): TokenPayload | null {
  return jwt.decode(token) as TokenPayload | null
}
