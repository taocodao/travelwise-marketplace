/**
 * Privy Auth Middleware
 * 
 * Verifies Privy JWT tokens for API route protection.
 * Extracts user ID and wallet address from the token.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// JWKS client for Privy public keys
const client = jwksClient({
  jwksUri: 'https://auth.privy.io/.well-known/jwks.json',
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
});

interface PrivyUser {
  userId: string;
  walletAddress?: string;
  email?: string;
  phone?: string;
  linkedAccounts: any[];
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      privyUser?: PrivyUser;
    }
  }
}

/**
 * Get signing key from JWKS
 */
function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verify Privy JWT token
 */
async function verifyPrivyToken(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const appId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    
    if (!appId) {
      reject(new Error('PRIVY_APP_ID not configured'));
      return;
    }

    jwt.verify(
      token,
      getKey,
      {
        algorithms: ['ES256'],
        issuer: 'privy.io',
        audience: appId,
      },
      (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      }
    );
  });
}

/**
 * Privy auth middleware - requires authentication
 */
export function requirePrivyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'NO_AUTH_TOKEN',
    });
  }

  const token = authHeader.slice(7);

  verifyPrivyToken(token)
    .then((decoded: any) => {
      req.privyUser = {
        userId: decoded.sub,
        walletAddress: decoded.wallet?.address,
        email: decoded.email?.address,
        phone: decoded.phone?.number,
        linkedAccounts: decoded.linked_accounts || [],
      };
      next();
    })
    .catch((err) => {
      console.error('Privy auth failed:', err.message);
      res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    });
}

/**
 * Privy auth middleware - optional (doesn't fail if no token)
 */
export function optionalPrivyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(); // Continue without auth
  }

  const token = authHeader.slice(7);

  verifyPrivyToken(token)
    .then((decoded: any) => {
      req.privyUser = {
        userId: decoded.sub,
        walletAddress: decoded.wallet?.address,
        email: decoded.email?.address,
        phone: decoded.phone?.number,
        linkedAccounts: decoded.linked_accounts || [],
      };
      next();
    })
    .catch(() => {
      next(); // Continue without auth on error
    });
}

/**
 * Get user ID from request
 */
export function getUserId(req: Request): string | null {
  return req.privyUser?.userId || null;
}

/**
 * Get wallet address from request
 */
export function getWalletAddress(req: Request): string | null {
  return req.privyUser?.walletAddress || null;
}
