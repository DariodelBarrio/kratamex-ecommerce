import { generateSecret, generateURI, verify } from 'otplib'
import QRCode from 'qrcode'
import { db } from './db/index'
import { usuarios } from './db/schema'
import { eq } from 'drizzle-orm'

const APP_NAME = 'Kratamex'

export function generateTwoFactorSecret(_username: string): string {
  return generateSecret()
}

export function generateTwoFactorQR(username: string, secret: string): Promise<string> {
  const otpauth = generateURI({
    secret,
    issuer: APP_NAME,
    label: username,
  })
  return QRCode.toDataURL(otpauth)
}

export function verifyTwoFactorCode(secret: string, code: string): boolean {
  const result = verify({ secret, token: code })
  return 'valid' in result && result.valid === true
}

export async function enableTwoFactor(userId: number, secret: string, code: string): Promise<{ success: boolean; error?: string }> {
  if (!verifyTwoFactorCode(secret, code)) {
    return { success: false, error: 'Código inválido' }
  }

  await db.update(usuarios)
    .set({ twoFactorSecret: secret, twoFactorEnabled: true })
    .where(eq(usuarios.id, userId))

  return { success: true }
}

export async function disableTwoFactor(userId: number): Promise<void> {
  await db.update(usuarios)
    .set({ twoFactorSecret: null, twoFactorEnabled: false })
    .where(eq(usuarios.id, userId))
}

export async function verifyTwoFactor(userId: number, code: string): Promise<boolean> {
  const [user] = await db.select({
    twoFactorSecret: usuarios.twoFactorSecret,
    twoFactorEnabled: usuarios.twoFactorEnabled,
  }).from(usuarios).where(eq(usuarios.id, userId))

  if (!user?.twoFactorEnabled || !user?.twoFactorSecret) {
    return false
  }

  return verifyTwoFactorCode(user.twoFactorSecret, code)
}
