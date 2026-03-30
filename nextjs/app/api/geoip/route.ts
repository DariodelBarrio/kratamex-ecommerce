import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface IpApiResult {
  query: string
  status: string
  country?: string
  countryCode?: string
  lat?: number
  lon?: number
}

/**
 * POST /api/geoip
 * Proxy hacia ip-api.com/batch para evitar CORS.
 * Body: { ips: string[] }
 * Returns: IpApiResult[]
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.headers.get('authorization')
    if (!token) return NextResponse.json([], { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { ips } = body as { ips?: unknown }

    if (!Array.isArray(ips) || ips.length === 0) {
      return NextResponse.json([])
    }

    // Filtra IPs privadas / localhost antes de enviar
    const publicIPs = (ips as string[])
      .filter(ip => typeof ip === 'string' && ip.length > 0)
      .filter(ip => !ip.startsWith('127.') && !ip.startsWith('10.') &&
                    !ip.startsWith('192.168.') && ip !== '::1' && ip !== 'localhost')
      .slice(0, 100) // ip-api.com permite máx 100 por batch

    if (publicIPs.length === 0) return NextResponse.json([])

    const payload = publicIPs.map(q => ({
      query: q,
      fields: 'query,status,country,countryCode,lat,lon',
    }))

    const geoRes = await fetch('http://ip-api.com/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })

    if (!geoRes.ok) return NextResponse.json([])

    const data: IpApiResult[] = await geoRes.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([])
  }
}
