import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { query } from '../../../packages/db/src/connection';
import { config } from '../../../packages/config/src/config';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:auth');
const SALT_ROUNDS = 12;

export interface AuthUser {
  id: string;
  tenant_id: string | null;
  email: string;
  full_name: string | null;
  role: string;
}

function signToken(userId: string, tenantId: string, role: string): string {
  return jwt.sign(
    { userId, tenantId, role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
  );
}

export class AuthService {
  /** Register a new user (and optionally bootstrap a tenant) */
  static async register(data: {
    email: string;
    password: string;
    fullName?: string;
    tenantName?: string;
    tenantSlug?: string;
    role?: string;
  }): Promise<{ token: string; user: AuthUser; tenantId: string }> {
    const existing = await query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) throw new Error('Email already registered');

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const role = data.role ?? 'admin';

    // Create tenant if name is provided
    let tenantId: string;
    if (data.tenantName && data.tenantSlug) {
      const tenantRes = await query<{ id: string }>(
        `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
        [data.tenantName, data.tenantSlug]
      );
      tenantId = tenantRes.rows[0].id;
    } else {
      // Use or create a default "agency" tenant
      const existing = await query<{ id: string }>(
        `SELECT id FROM tenants WHERE slug = 'agency' LIMIT 1`
      );
      if (existing.rows.length > 0) {
        tenantId = existing.rows[0].id;
      } else {
        const created = await query<{ id: string }>(
          `INSERT INTO tenants (name, slug) VALUES ('Agency', 'agency') RETURNING id`
        );
        tenantId = created.rows[0].id;
      }
    }

    const userRes = await query<AuthUser>(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tenant_id, email, full_name, role`,
      [tenantId, data.email, passwordHash, data.fullName ?? null, role]
    );

    const user = userRes.rows[0];
    const token = signToken(user.id, tenantId, role);
    return { token, user, tenantId };
  }

  /** Login and return JWT */
  static async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const res = await query<AuthUser & { password_hash: string }>(
      `SELECT id, tenant_id, email, full_name, role, password_hash
       FROM users WHERE email = $1 AND is_active = true`,
      [email]
    );
    if (res.rows.length === 0) throw new Error('Invalid credentials');

    const user = res.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new Error('Invalid credentials');

    await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

    const token = signToken(user.id, user.tenant_id ?? '', user.role);
    const { password_hash: _ph, ...safeUser } = user;
    return { token, user: safeUser as AuthUser };
  }

  /** Get user by id */
  static async getUserById(id: string): Promise<AuthUser | null> {
    const res = await query<AuthUser>(
      `SELECT id, tenant_id, email, full_name, role FROM users WHERE id = $1 AND is_active = true`,
      [id]
    );
    return res.rows[0] ?? null;
  }

  /** Change password */
  static async changePassword(userId: string, currentPw: string, newPw: string): Promise<void> {
    const res = await query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [userId]
    );
    if (!res.rows[0]) throw new Error('User not found');
    const valid = await bcrypt.compare(currentPw, res.rows[0].password_hash);
    if (!valid) throw new Error('Current password incorrect');
    const newHash = await bcrypt.hash(newPw, SALT_ROUNDS);
    await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [newHash, userId]);
  }

  /** List users (admin) */
  static async listUsers(tenantId?: string, limit = 50, offset = 0) {
    if (tenantId) {
      const res = await query(
        `SELECT id, tenant_id, email, full_name, role, is_active, last_login_at, created_at
         FROM users WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset]
      );
      return res.rows;
    }
    const res = await query(
      `SELECT id, tenant_id, email, full_name, role, is_active, last_login_at, created_at
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.rows;
  }

  /** Invite a member to a tenant */
  static async inviteUser(data: {
    email: string;
    fullName?: string;
    role: string;
    tenantId: string;
  }): Promise<{ id: string; tempPassword: string }> {
    const tempPassword = uuid().replace(/-/g, '').slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
    const res = await query<{ id: string }>(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [data.tenantId, data.email, passwordHash, data.fullName ?? null, data.role]
    );
    return { id: res.rows[0].id, tempPassword };
  }
}
