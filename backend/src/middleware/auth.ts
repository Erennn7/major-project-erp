import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'aquaflow_distributor_secret_key_2026';

export interface AuthUser {
  userId: string;
  email: string;
  role: 'ADMIN' | 'DISPATCHER' | 'SALES' | 'ACCOUNTANT';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Validates the JWT Bearer token from the Authorization header.
 * Attaches the decoded user to req.user.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Missing Bearer token.',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session token. Please log in again.',
    });
  }
}

/**
 * Role-Based Access Control middleware.
 * Verifies that the authenticated user possesses one of the allowed roles.
 */
export function requireRoles(...allowedRoles: ('ADMIN' | 'DISPATCHER' | 'SALES' | 'ACCOUNTANT')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access Denied: Role '${req.user.role}' is not authorized for this resource. Required roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}
