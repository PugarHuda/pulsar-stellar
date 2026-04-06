/**
 * auth/middleware.ts
 * 
 * Express middleware for JWT authentication.
 */

import { Request, Response, NextFunction } from 'express'
import { verifyToken } from './jwt.js'

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        publicKey: string
      }
    }
  }
}

/**
 * Authentication middleware.
 * Verifies JWT token from Authorization header.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        action: 'Please provide a valid authentication token',
      },
    })
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    const payload = verifyToken(token)
    req.user = { publicKey: payload.publicKey }
    next()
  } catch (err) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
        action: 'Please login again',
      },
    })
  }
}

/**
 * Optional authentication middleware.
 * Adds user to request if token is valid, but doesn't require it.
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    try {
      const payload = verifyToken(token)
      req.user = { publicKey: payload.publicKey }
    } catch {
      // Invalid token, but we don't fail - just continue without user
    }
  }

  next()
}
