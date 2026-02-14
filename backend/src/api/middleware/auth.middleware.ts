import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();

/**
 * API Bearer Token Authentication Middleware
 * Protects API endpoints from unauthorized access
 *
 * Setup:
 * 1. Add API_BEARER_TOKEN="your_secure_token" to .env
 * 2. Include header in requests: Authorization: Bearer <token>
 *
 * Example:
 * ```
 * fetch('http://localhost:3001/api/stats/123', {
 *   headers: {
 *     'Authorization': 'Bearer your_secure_token'
 *   }
 * })
 * ```
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get bearer token from environment
  const validToken = process.env.API_BEARER_TOKEN;

  // If no token configured, allow all (development mode)
  if (!validToken || validToken.trim() === '') {
    console.warn('⚠️  WARNING: No API_BEARER_TOKEN configured. API is accessible to everyone!');
    return next();
  }

  // Get authorization header
  const authHeader = req.headers.authorization;

  // Check if authorization header exists
  if (!authHeader) {
    console.warn(`🚫 API access denied: No authorization header [${req.method} ${req.path}]`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing authorization header',
    });
  }

  // Check if it's a Bearer token
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.warn(`🚫 API access denied: Invalid auth format [${req.method} ${req.path}]`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authorization format. Use: Bearer <token>',
    });
  }

  const token = parts[1];

  // Validate token
  if (token !== validToken) {
    console.warn(`🚫 API access denied: Invalid token [${req.method} ${req.path}]`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid bearer token',
    });
  }

  // Token is valid, continue
  console.log(`✅ API access granted [${req.method} ${req.path}]`);
  next();
}

/**
 * Optional authentication middleware
 * Allows both authenticated and unauthenticated requests
 * But adds `req.isAuthenticated` flag
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const validToken = process.env.API_BEARER_TOKEN;
  const authHeader = req.headers.authorization;

  // Add custom property to request
  (req as any).isAuthenticated = false;

  if (validToken && authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer' && parts[1] === validToken) {
      (req as any).isAuthenticated = true;
    }
  }

  next();
}

/**
 * Check if API authentication is enabled
 */
export function isAuthEnabled(): boolean {
  const token = process.env.API_BEARER_TOKEN;
  return !!(token && token.trim() !== '');
}
