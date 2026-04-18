import { Request, Response, NextFunction } from 'express';
import { getRateLimit } from '../../db/src/redis';

export function rateLimiter(maxRequests: number, windowSec: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `ratelimit:${ip}:${req.path}`;

    const allowed = await getRateLimit(key, maxRequests, windowSec);
    if (!allowed) {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }
    next();
  };
}

export function channelRateLimiter(channel: string, ratePerSec: number) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    const key = `channel:rate:${channel}:${Math.floor(Date.now() / 1000)}`;
    const allowed = await getRateLimit(key, ratePerSec, 2);
    if (!allowed) {
      res.status(429).json({ error: `${channel} rate limit exceeded. Max ${ratePerSec}/sec.` });
      return;
    }
    next();
  };
}
