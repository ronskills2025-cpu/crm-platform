import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { z } from 'zod';
import { createLogger } from '../../../packages/utils/src/logger';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';

const log = createLogger('ctrl:auth');

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional(),
  tenantName: z.string().optional(),
  tenantSlug: z.string().regex(/^[a-z0-9-]+$/).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const InviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().optional(),
  role: z.enum(['admin', 'member']).default('member'),
});

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const data = RegisterSchema.parse(req.body);
      const result = await AuthService.register(data);
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      if ((err as Error).message.includes('already registered') || (err as Error).message.includes('unique')) {
        res.status(409).json({ error: (err as Error).message }); return;
      }
      log.error('register failed', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = LoginSchema.parse(req.body);
      const result = await AuthService.login(email, password);
      res.json({ success: true, ...result });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      if ((err as Error).message === 'Invalid credentials') {
        res.status(401).json({ error: 'Invalid credentials' }); return;
      }
      log.error('login failed', err);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  static async me(req: AuthRequest, res: Response) {
    try {
      const user = await AuthService.getUserById(req.userId!);
      if (!user) { res.status(404).json({ error: 'User not found' }); return; }
      res.json({ success: true, user });
    } catch (err) {
      log.error('me failed', err);
      res.status(500).json({ error: 'Failed to get user' });
    }
  }

  static async changePassword(req: AuthRequest, res: Response) {
    try {
      const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);
      await AuthService.changePassword(req.userId!, currentPassword, newPassword);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      if ((err as Error).message.includes('incorrect')) { res.status(401).json({ error: (err as Error).message }); return; }
      log.error('changePassword failed', err);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }

  static async listUsers(req: AuthRequest, res: Response) {
    try {
      const tenantId = req.userRole === 'superadmin' ? undefined : req.tenantId;
      const users = await AuthService.listUsers(
        tenantId,
        parseInt(req.query.limit as string) || 50,
        parseInt(req.query.offset as string) || 0
      );
      res.json({ success: true, users });
    } catch (err) {
      log.error('listUsers failed', err);
      res.status(500).json({ error: 'Failed to list users' });
    }
  }

  static async inviteUser(req: AuthRequest, res: Response) {
    try {
      const data = InviteSchema.parse(req.body);
      const result = await AuthService.inviteUser({ ...data, tenantId: req.tenantId! });
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('inviteUser failed', err);
      res.status(500).json({ error: 'Failed to invite user' });
    }
  }
}
