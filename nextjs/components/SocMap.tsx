'use client'

import { useEffect, useState, useCallback } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { RefreshCw, Globe, AlertTriangle, Flame, Shield } from 'lucide-react'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

interface AttackMarker {
  ip: string
  lat: number
  lon: number
  count: number
  country: string
  countryCode: string
  tipo: string
}

interface SecurityEvent {
  ip: string | null
  tipo: string
  fecha: string
  username: string | null
  detalles: string | null
}

interface GeoResult {
  query: string
  status: string
  country?: string
  countryCode?: string
  lat?: number
  lon?: number
}

interface Tooltip {
  text: string
  x: number
  y: number
}

function getToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('kratamex_token') ?? ''
}

const ATTACK_TYPES = ['login_fail', 'brute_force', 'blocked_request', 'auth_invalid', 'honeypot']

const MARKER_COLORS: Record<string, string> = {
  brute_force:      '#ef4444',
  blocked_request:  '#8b5cf6',
  honeypot:         '#f97316',
  auth_invalid:     '#f59e0b',
  login_fail:       '#fbbf24',
}

function markerColor(tipo: string): string {
  return MARKER_COLORS[tipo] ?? '#fbbf24'
}

function markerRadius(count: number): number {
  return Math.max(4, Math.min(16, 4 + Math.log2(count + 1) * 2.5))
}

async function fetchSecurityEvents(): Promise<SecurityEvent[]> {
  const res = await fetch('/api/security/events?limit=1000', {
    headers: { Authorization: getToken() },
  })
  if (res.status === 401) throw new Error('No autenticado')
  if (res.status === 403) throw new Error('Acceso denegado — se requiere admin')
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

async function batchGeolocate(ips: string[]): Promise<Map<string, GeoResult>> {
  const res = await fetch('/api/geoip', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getToken(),
    },
    body: JSON.stringify({ ips }),
  })
  if (!res.ok) return new Map()
  const data: GeoResult[] = await res.json()
  return new Map(data.filter(d => d.status === 'success').map(d => [d.query, d]))
}

export function SocMap() {
  const [markers, setMarkers] = useState<AttackMarker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [stats, setStats] = useState({
    total: 0, uniqueIPs: 0, topCountry: '—', topTipo: '—',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const events = await fetchSecurityEvents()

      // Agrupa por IP → count + tipo más grave
      const severity = ['brute_force', 'honeypot', 'blocked_request', 'auth_invalid', 'login_fail']
      const ipMap = new Map<string, { count: number; tipo: string }>()

      for (const ev of events) {
        if (!ev.ip || ['127.0.0.1', '::1', 'localhost'].includes(ev.ip)) continue
        if (!ATTACK_TYPES.includes(ev.tipo)) continue

        const existing = ipMap.get(ev.ip)
        if (!existing) {
          ipMap.set(ev.ip, { count: 1, tipo: ev.tipo })
        } else {
          existing.count++
          if (severity.indexOf(ev.tipo) < severity.indexOf(existing.tipo)) {
            existing.tipo = ev.tipo // escala al tipo más grave
          }
        }
      }

      const uniqueIPs = Array.from(ipMap.keys())
      const geoMap = await batchGeolocate(uniqueIPs)

      const result: AttackMarker[] = []
      const countryCounts = new Map<string, number>()
      const tipoCounts   = new Map<string, number>()

      for (const [ip, { count, tipo }] of ipMap) {
        const geo = geoMap.get(ip)
        if (!geo?.lat || !geo?.lon) continue
        result.push({
          ip,
          lat: geo.lat,
          lon: geo.lon,
          count,
          country: geo.country ?? 'Desconocido',
          countryCode: geo.countryCode ?? '??',
          tipo,
        })
        countryCounts.set(geo.country ?? '??', (countryCounts.get(geo.country ?? '??') ?? 0) + count)
        tipoCounts.set(tipo, (tipoCounts.get(tipo) ?? 0) + count)
      }

      const topCountry = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
      const topTipo    = [...tipoCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

      setMarkers(result)
      setStats({
        total: events.filter(e => ATTACK_TYPES.includes(e.tipo)).length,
        uniqueIPs: uniqueIPs.length,
        topCountry,
        topTipo,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ height: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
        <div style={{ width: 36, height: 36, border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'socSpin 0.7s linear infinite' }} />
        <p style={{ fontSize: '0.875rem' }}>Geolocalizando amenazas...</p>
        <style>{`@keyframes socSpin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <AlertTriangle size={36} style={{ color: 'var(--error)', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--error)', fontWeight: 600, marginBottom: 6 }}>{error}</p>
        <button
          onClick={load}
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 16px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={13} /> Reintentar
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Eventos', value: stats.total,      icon: <Flame size={14} />, color: '#ef4444' },
          { label: 'IPs únicas', value: stats.uniqueIPs, icon: <Globe size={14} />,  color: '#f59e0b' },
          { label: 'País top',   value: stats.topCountry, icon: <Shield size={14} />, color: '#6366f1' },
          { label: 'Ataque top', value: stats.topTipo.replace('_', ' '), icon: <AlertTriangle size={14} />, color: '#f97316' },
        ].map(s => (
          <div
            key={s.label}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.025)',
              border: '0.5px solid rgba(255,255,255,0.07)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: s.color, marginBottom: 4 }}>
              {s.icon}
              <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
            </div>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Map ── */}
      <div
        style={{
          background: 'linear-gradient(180deg, #020c1b 0%, #030f22 100%)',
          borderRadius: 14,
          border: '0.5px solid rgba(5,150,105,0.18)',
          overflow: 'hidden',
          position: 'relative',
        }}
        onMouseMove={e => {
          if (tooltip) setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Scanline glow */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(5,150,105,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(5,150,105,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none', zIndex: 1 }} />

        <ComposableMap
          projectionConfig={{ rotate: [-10, 0, 0], scale: 150 }}
          style={{ width: '100%', height: 'auto', position: 'relative', zIndex: 2 }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#0a1929"
                  stroke="#1a3a5c"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: 'none' },
                    hover:   { fill: '#112233', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {markers.map((m, i) => (
            <Marker
              key={`${m.ip}-${i}`}
              coordinates={[m.lon, m.lat]}
              onMouseEnter={(e: React.MouseEvent) =>
                setTooltip({ text: `${m.ip} · ${m.country} · ${m.count} eventos`, x: e.clientX, y: e.clientY })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Aro pulsante */}
              <circle
                r={markerRadius(m.count) + 5}
                fill={markerColor(m.tipo)}
                opacity={0.15}
                style={{ animation: `socPulse ${1.5 + (i % 3) * 0.4}s ease-in-out infinite` }}
              />
              {/* Núcleo */}
              <circle
                r={markerRadius(m.count)}
                fill={markerColor(m.tipo)}
                opacity={0.88}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={0.6}
              />
            </Marker>
          ))}
        </ComposableMap>

        {markers.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
            <p style={{ color: 'rgba(100,130,160,0.7)', fontSize: '0.875rem' }}>Sin datos de ataque registrados</p>
          </div>
        )}
      </div>

      {/* ── Leyenda ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', marginTop: 12 }}>
        {Object.entries(MARKER_COLORS).map(([tipo, color]) => (
          <span key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
            {tipo.replace('_', ' ')}
          </span>
        ))}
        <button
          onClick={load}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontFamily: 'inherit' }}
        >
          <RefreshCw size={11} /> Actualizar
        </button>
      </div>

      {/* ── Tooltip global ── */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 14,
            top: tooltip.y - 14,
            background: 'rgba(2,6,23,0.95)',
            border: '0.5px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            padding: '6px 11px',
            fontSize: '0.75rem',
            color: 'var(--text)',
            pointerEvents: 'none',
            zIndex: 9999,
            backdropFilter: 'blur(12px)',
            maxWidth: 240,
            whiteSpace: 'nowrap',
          }}
        >
          {tooltip.text}
        </div>
      )}

      <style>{`
        @keyframes socPulse {
          0%, 100% { transform: scale(1);   opacity: 0.15; }
          50%       { transform: scale(1.6); opacity: 0.04; }
        }
      `}</style>
    </div>
  )
}
