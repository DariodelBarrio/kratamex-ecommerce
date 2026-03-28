import { db } from './db/index'
import { securityEvents, blockedIps } from './db/schema'
import { sql, eq, and, gte } from 'drizzle-orm'

interface IpAnomalyConfig {
  maxFailedAttempts: number
  maxRequestsPerMinute: number
  windowMinutes: number
  newIpThreshold: number
}

const DEFAULT_CONFIG: IpAnomalyConfig = {
  maxFailedAttempts: 5,
  maxRequestsPerMinute: 60,
  windowMinutes: 15,
  newIpThreshold: 3,
}

export class IpAnomalyDetector {
  private readonly config: IpAnomalyConfig

  constructor(config: Partial<IpAnomalyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  getClientIp(c: { req: { header: (h: string) => string | null } }): string {
    const forwarded = c.req.header('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0].trim()
    return c.req.header('x-real-ip') || 'unknown'
  }

  async isIpBlocked(ip: string): Promise<boolean> {
    const [blocked] = await db.select()
      .from(blockedIps)
      .where(eq(blockedIps.ip, ip))

    if (!blocked) return false
    if (!blocked.bloqueadoHasta) return true

    return new Date(blocked.bloqueadoHasta) > new Date()
  }

  async checkFailedLoginAttempts(ip: string): Promise<number> {
    const windowAgo = new Date(Date.now() - this.config.windowMinutes * 60 * 1000)

    const result = await db.select()
      .from(securityEvents)
      .where(
        and(
          eq(securityEvents.tipo, 'login_fail'),
          eq(securityEvents.ip, ip),
          gte(securityEvents.fecha, windowAgo)
        )
      )

    return result.length
  }

  async checkRequestRate(ip: string): Promise<number> {
    const windowAgo = new Date(Date.now() - 60 * 1000)

    const result = await db.select({ count: sql<number>`count(*)` })
      .from(securityEvents)
      .where(
        and(
          sql`${securityEvents.ip} = ${ip}`,
          gte(securityEvents.fecha, windowAgo)
        )
      )

    return Number(result[0]?.count || 0)
  }

  async checkNewIpActivity(userId: number, ip: string): Promise<boolean> {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const recentIps = await db.select({ ip: securityEvents.ip })
      .from(securityEvents)
      .where(
        and(
          eq(securityEvents.tipo, 'login_ok'),
          eq(securityEvents.username, sql`(SELECT username FROM usuarios WHERE id = ${userId})`),
          gte(securityEvents.fecha, threshold)
        )
      )

    const uniqueIps = new Set(recentIps.map(r => r.ip))
    return uniqueIps.size >= this.config.newIpThreshold && !uniqueIps.has(ip)
  }

  async logSecurityEvent(
    ip: string,
    tipo: string,
    username?: string,
    detalles?: string
  ): Promise<void> {
    await db.insert(securityEvents).values({
      ip,
      tipo,
      username,
      detalles,
      endpoint: '',
      metodo: '',
      userAgent: '',
    })
  }

  async analyzeIp(ip: string): Promise<{
    blocked: boolean
    reason?: string
    severity: 'low' | 'medium' | 'high' | 'critical'
  }> {
    if (await this.isIpBlocked(ip)) {
      return { blocked: true, reason: 'IP bloqueada manualmente', severity: 'critical' }
    }

    const failedAttempts = await this.checkFailedLoginAttempts(ip)
    if (failedAttempts >= this.config.maxFailedAttempts) {
      await this.blockIp(ip, 'Demasiados intentos de login fallidos')
      return { blocked: true, reason: 'Demasiados intentos fallidos', severity: 'high' }
    }

    const requestRate = await this.checkRequestRate(ip)
    if (requestRate >= this.config.maxRequestsPerMinute) {
      return { blocked: false, reason: 'Alta tasa de requests', severity: 'medium' }
    }

    if (failedAttempts >= 3) {
      return { blocked: false, reason: 'Múltiples intentos fallidos', severity: 'low' }
    }

    return { blocked: false, severity: 'low' }
  }

  async blockIp(ip: string, motivo: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

    await db.insert(blockedIps)
      .values({ ip, motivo, bloqueadoHasta: expiresAt })
      .onConflictDoUpdate({
        target: blockedIps.ip,
        set: { motivo, bloqueadoHasta: expiresAt },
      })

    await this.logSecurityEvent(ip, 'blocked', undefined, motivo)
  }

  async unblockIp(ip: string): Promise<void> {
    await db.delete(blockedIps).where(eq(blockedIps.ip, ip))
  }
}

export const anomalyDetector = new IpAnomalyDetector()
