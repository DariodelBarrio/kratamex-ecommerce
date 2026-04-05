import type { PoolClient } from 'pg';
import { pool } from './db/index';

export type AppSessionData = {
  id: number;
  username: string;
  role: string;
  avatar: string | null;
  createdAt: number;
  twoFactorVerified?: boolean;
};

export type SocSessionData = {
  id: number;
  username: string;
  createdAt: number;
};

export type LoginRateLimitRecord = {
  count: number;
  blockedUntil: number | null;
  lastAttempt?: number;
};

type WindowCounter = {
  count: number;
  windowStart: number;
};

const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');

export const SESSION_TTL = 8 * 60 * 60 * 1000;
export const SOC_SESSION_TTL = 8 * 60 * 60 * 1000;
const LOGIN_RETENTION_MS = 5 * 60 * 1000;

const appSessions = new Map<string, AppSessionData>();
const socSessions = new Map<string, SocSessionData>();
const loginAttempts = new Map<string, LoginRateLimitRecord>();
const windowCounters = new Map<string, WindowCounter>();

let lastCleanupAt = 0;

function toIso(ts: number) {
  return new Date(ts).toISOString();
}

function fromDate(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  return new Date(String(value)).getTime();
}

function maybeCleanupMemory(now = Date.now()) {
  for (const [token, session] of appSessions.entries()) {
    if (now - session.createdAt > SESSION_TTL) appSessions.delete(token);
  }
  for (const [token, session] of socSessions.entries()) {
    if (now - session.createdAt > SOC_SESSION_TTL) socSessions.delete(token);
  }
  for (const [key, rec] of loginAttempts.entries()) {
    if (rec.blockedUntil) {
      if (now > rec.blockedUntil + LOGIN_RETENTION_MS) loginAttempts.delete(key);
      continue;
    }
    if (now - (rec.lastAttempt ?? 0) > LOGIN_RETENTION_MS) loginAttempts.delete(key);
  }
  for (const [key, rec] of windowCounters.entries()) {
    if (now - rec.windowStart > LOGIN_RETENTION_MS) windowCounters.delete(key);
  }
}

async function maybeCleanupPersistent(now = Date.now()) {
  if (isTestEnv || now - lastCleanupAt < 60_000) return;
  lastCleanupAt = now;
  try {
    await pool.query(`
      DELETE FROM auth_sessions
      WHERE expires_at <= NOW()
    `);
    await pool.query(`
      DELETE FROM rate_limit_counters
      WHERE
        (blocked_until IS NOT NULL AND blocked_until < NOW() - INTERVAL '5 minutes')
        OR
        (blocked_until IS NULL AND updated_at < NOW() - INTERVAL '5 minutes')
    `);
  } catch (err) {
    console.error('[securityState.cleanup]', err);
  }
}

function windowKey(scope: string, key: string) {
  return `${scope}:${key}`;
}

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getSessionRow(token: string, scope: 'app' | 'soc') {
  const { rows } = await pool.query(
    `SELECT token, user_id, username, role, avatar, two_factor_verified, created_at, expires_at
     FROM auth_sessions
     WHERE token = $1 AND scope = $2
     LIMIT 1`,
    [token, scope],
  );
  return rows[0] ?? null;
}

export const securityState = {
  async createAppSession(token: string, session: Omit<AppSessionData, 'createdAt'> & { createdAt?: number }, ttlMs = SESSION_TTL) {
    const createdAt = session.createdAt ?? Date.now();
    const payload: AppSessionData = { ...session, createdAt };
    if (isTestEnv) {
      appSessions.set(token, payload);
      return payload;
    }
    await maybeCleanupPersistent(createdAt);
    await pool.query(
      `INSERT INTO auth_sessions
        (token, scope, user_id, username, role, avatar, two_factor_verified, created_at, expires_at)
       VALUES ($1, 'app', $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (token) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           username = EXCLUDED.username,
           role = EXCLUDED.role,
           avatar = EXCLUDED.avatar,
           two_factor_verified = EXCLUDED.two_factor_verified,
           created_at = EXCLUDED.created_at,
           expires_at = EXCLUDED.expires_at`,
      [
        token,
        payload.id,
        payload.username,
        payload.role,
        payload.avatar,
        payload.twoFactorVerified ?? false,
        toIso(createdAt),
        toIso(createdAt + ttlMs),
      ],
    );
    return payload;
  },

  async getAppSession(token: string) {
    if (isTestEnv) {
      maybeCleanupMemory();
      return appSessions.get(token) ?? null;
    }
    await maybeCleanupPersistent();
    const row = await getSessionRow(token, 'app');
    if (!row) return null;
    if (fromDate(row.expires_at) <= Date.now()) {
      await this.deleteAppSession(token);
      return null;
    }
    return {
      id: Number(row.user_id),
      username: String(row.username),
      role: String(row.role),
      avatar: row.avatar ? String(row.avatar) : null,
      createdAt: fromDate(row.created_at),
      twoFactorVerified: Boolean(row.two_factor_verified),
    } satisfies AppSessionData;
  },

  async updateAppSession(token: string, patch: Partial<Omit<AppSessionData, 'id' | 'username' | 'role' | 'createdAt'>>) {
    if (isTestEnv) {
      const current = appSessions.get(token);
      if (current) appSessions.set(token, { ...current, ...patch });
      return;
    }
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.avatar !== undefined) {
      values.push(patch.avatar);
      fields.push(`avatar = $${values.length}`);
    }
    if (patch.twoFactorVerified !== undefined) {
      values.push(patch.twoFactorVerified);
      fields.push(`two_factor_verified = $${values.length}`);
    }
    if (!fields.length) return;
    values.push(token);
    await pool.query(
      `UPDATE auth_sessions
       SET ${fields.join(', ')}
       WHERE token = $${values.length} AND scope = 'app'`,
      values,
    );
  },

  async deleteAppSession(token: string) {
    if (isTestEnv) {
      appSessions.delete(token);
      return;
    }
    await pool.query(`DELETE FROM auth_sessions WHERE token = $1 AND scope = 'app'`, [token]);
  },

  async deleteSocSession(token: string) {
    if (isTestEnv) {
      socSessions.delete(token);
      return;
    }
    await pool.query(`DELETE FROM auth_sessions WHERE token = $1 AND scope = 'soc'`, [token]);
  },

  async deleteAnySession(token: string) {
    if (isTestEnv) {
      appSessions.delete(token);
      socSessions.delete(token);
      return;
    }
    await pool.query(`DELETE FROM auth_sessions WHERE token = $1`, [token]);
  },

  async deleteOtherAppSessions(userId: number, currentToken?: string | null) {
    if (isTestEnv) {
      for (const [token, session] of appSessions.entries()) {
        if (session.id === userId && token !== currentToken) appSessions.delete(token);
      }
      return;
    }
    if (currentToken) {
      await pool.query(
        `DELETE FROM auth_sessions
         WHERE scope = 'app' AND user_id = $1 AND token <> $2`,
        [userId, currentToken],
      );
      return;
    }
    await pool.query(
      `DELETE FROM auth_sessions
       WHERE scope = 'app' AND user_id = $1`,
      [userId],
    );
  },

  async createSocSession(token: string, session: Omit<SocSessionData, 'createdAt'> & { createdAt?: number }, ttlMs = SOC_SESSION_TTL) {
    const createdAt = session.createdAt ?? Date.now();
    const payload: SocSessionData = { ...session, createdAt };
    if (isTestEnv) {
      socSessions.set(token, payload);
      return payload;
    }
    await maybeCleanupPersistent(createdAt);
    await pool.query(
      `INSERT INTO auth_sessions
        (token, scope, user_id, username, role, avatar, two_factor_verified, created_at, expires_at)
       VALUES ($1, 'soc', $2, $3, 'soc_admin', NULL, TRUE, $4, $5)
       ON CONFLICT (token) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           username = EXCLUDED.username,
           role = EXCLUDED.role,
           two_factor_verified = EXCLUDED.two_factor_verified,
           created_at = EXCLUDED.created_at,
           expires_at = EXCLUDED.expires_at`,
      [token, payload.id, payload.username, toIso(createdAt), toIso(createdAt + ttlMs)],
    );
    return payload;
  },

  async getSocSession(token: string) {
    if (isTestEnv) {
      maybeCleanupMemory();
      return socSessions.get(token) ?? null;
    }
    await maybeCleanupPersistent();
    const row = await getSessionRow(token, 'soc');
    if (!row) return null;
    if (fromDate(row.expires_at) <= Date.now()) {
      await this.deleteSocSession(token);
      return null;
    }
    return {
      id: Number(row.user_id),
      username: String(row.username),
      createdAt: fromDate(row.created_at),
    } satisfies SocSessionData;
  },

  async countActiveSocSessions() {
    if (isTestEnv) {
      maybeCleanupMemory();
      return socSessions.size;
    }
    await maybeCleanupPersistent();
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM auth_sessions
       WHERE scope = 'soc' AND expires_at > NOW()`,
    );
    return Number(rows[0]?.count ?? 0);
  },

  async consumeWindowCounter(scope: 'general' | 'checkout' | 'comments', key: string, windowMs: number) {
    const now = Date.now();
    if (isTestEnv) {
      maybeCleanupMemory(now);
      const compositeKey = windowKey(scope, key);
      const current = windowCounters.get(compositeKey);
      if (!current || now - current.windowStart > windowMs) {
        const next = { count: 1, windowStart: now };
        windowCounters.set(compositeKey, next);
        return next;
      }
      current.count += 1;
      windowCounters.set(compositeKey, current);
      return current;
    }
    await maybeCleanupPersistent(now);
    return withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, count, window_started_at
         FROM rate_limit_counters
         WHERE scope = $1 AND key = $2
         FOR UPDATE`,
        [scope, key],
      );
      const current = rows[0];
      if (!current) {
        const { rows: inserted } = await client.query(
          `INSERT INTO rate_limit_counters (scope, key, count, window_started_at, updated_at)
           VALUES ($1, $2, 1, $3, $3)
           RETURNING count, window_started_at`,
          [scope, key, toIso(now)],
        );
        return {
          count: Number(inserted[0].count),
          windowStart: fromDate(inserted[0].window_started_at),
        } satisfies WindowCounter;
      }
      const windowStart = fromDate(current.window_started_at);
      if (now - windowStart > windowMs) {
        const { rows: updated } = await client.query(
          `UPDATE rate_limit_counters
           SET count = 1, window_started_at = $3, blocked_until = NULL, updated_at = $3
           WHERE scope = $1 AND key = $2
           RETURNING count, window_started_at`,
          [scope, key, toIso(now)],
        );
        return {
          count: Number(updated[0].count),
          windowStart: fromDate(updated[0].window_started_at),
        } satisfies WindowCounter;
      }
      const { rows: updated } = await client.query(
        `UPDATE rate_limit_counters
         SET count = count + 1, updated_at = $3
         WHERE scope = $1 AND key = $2
         RETURNING count, window_started_at`,
        [scope, key, toIso(now)],
      );
      return {
        count: Number(updated[0].count),
        windowStart: fromDate(updated[0].window_started_at),
      } satisfies WindowCounter;
    });
  },

  async getLoginAttempt(key: string) {
    const now = Date.now();
    if (isTestEnv) {
      maybeCleanupMemory(now);
      return loginAttempts.get(key) ?? null;
    }
    await maybeCleanupPersistent(now);
    const { rows } = await pool.query(
      `SELECT count, blocked_until, updated_at
       FROM rate_limit_counters
       WHERE scope = 'login' AND key = $1
       LIMIT 1`,
      [key],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      count: Number(row.count),
      blockedUntil: row.blocked_until ? fromDate(row.blocked_until) : null,
      lastAttempt: fromDate(row.updated_at),
    } satisfies LoginRateLimitRecord;
  },

  async recordLoginFailure(key: string, maxAttempts: number, blockDurationMs: number) {
    const now = Date.now();
    if (isTestEnv) {
      maybeCleanupMemory(now);
      const current = loginAttempts.get(key);
      const expired = !current || (current.blockedUntil
        ? now > current.blockedUntil + LOGIN_RETENTION_MS
        : now - (current.lastAttempt ?? 0) > LOGIN_RETENTION_MS);
      const next: LoginRateLimitRecord = expired
        ? { count: 1, blockedUntil: null, lastAttempt: now }
        : {
            count: current.count + 1,
            blockedUntil: current.blockedUntil,
            lastAttempt: now,
          };
      if (next.count >= maxAttempts) next.blockedUntil = now + blockDurationMs;
      loginAttempts.set(key, next);
      return next;
    }
    await maybeCleanupPersistent(now);
    return withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT count, blocked_until, updated_at
         FROM rate_limit_counters
         WHERE scope = 'login' AND key = $1
         FOR UPDATE`,
        [key],
      );
      const current = rows[0];
      const expired = !current || (current.blocked_until
        ? now > fromDate(current.blocked_until) + LOGIN_RETENTION_MS
        : now - fromDate(current.updated_at) > LOGIN_RETENTION_MS);
      const count = expired ? 1 : Number(current.count) + 1;
      const blockedUntil = count >= maxAttempts ? now + blockDurationMs : null;
      if (!current) {
        await client.query(
          `INSERT INTO rate_limit_counters (scope, key, count, window_started_at, blocked_until, updated_at)
           VALUES ('login', $1, $2, $3, $4, $3)`,
          [key, count, toIso(now), blockedUntil ? toIso(blockedUntil) : null],
        );
      } else {
        await client.query(
          `UPDATE rate_limit_counters
           SET count = $2, window_started_at = $3, blocked_until = $4, updated_at = $3
           WHERE scope = 'login' AND key = $1`,
          [key, count, toIso(now), blockedUntil ? toIso(blockedUntil) : null],
        );
      }
      return {
        count,
        blockedUntil,
        lastAttempt: now,
      } satisfies LoginRateLimitRecord;
    });
  },

  async clearLoginAttempt(key: string) {
    if (isTestEnv) {
      loginAttempts.delete(key);
      return;
    }
    await pool.query(`DELETE FROM rate_limit_counters WHERE scope = 'login' AND key = $1`, [key]);
  },
};
