import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/src/config';

export interface AuthRequest extends Request {
  userId?: string;
  tenantId?: string;
  userRole?: string;
}

interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authentication token' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.userId = payload.userId;
    req.tenantId = payload.tenantId;
    req.userRole = payload.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      req.userId = payload.userId;
      req.tenantId = payload.tenantId;
      req.userRole = payload.role;
    } catch { /* ignore — still proceed */ }
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
