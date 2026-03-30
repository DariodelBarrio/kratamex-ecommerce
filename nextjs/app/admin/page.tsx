'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useStore } from '@/lib/store-context'
import { Shield, MapPin, ExternalLink, AlertTriangle, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'

// SSR: false — react-simple-maps usa APIs del navegador
const SocMap = dynamic(
  () => import('@/components/SocMap').then(m => ({ default: m.SocMap })),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Cargando mapa...
      </div>
    ),
  }
)

export default function AdminPage() {
  const router = useRouter()
  const { authUser } = useStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Espera a que el store se hidrate
    if (authUser === undefined) return
    if (!authUser) { router.replace('/login'); return }
    if ((authUser as any).role !== 'admin') { router.replace('/'); return }
    setReady(true)
  }, [authUser, router])

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', padding: '28px 24px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>

        {/* ── Header ── */}
        <motion.div
          style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'rgba(239,68,68,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ef4444', border: '0.5px solid rgba(239,68,68,0.2)',
          }}>
            <Shield size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px', lineHeight: 1.2 }}>
              Centro de Operaciones de Seguridad
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Mapa global de amenazas · Kratamex SOC
            </p>
          </div>

          {/* Live badge */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, background: 'rgba(16,185,129,0.08)', border: '0.5px solid rgba(16,185,129,0.25)', fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'socLivePulse 2s ease-in-out infinite' }} />
            EN VIVO
          </div>
        </motion.div>

        {/* ── SOC Map card ── */}
        <motion.div
          style={{
            background: 'rgba(15,23,42,0.7)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '0.5px solid rgba(255,255,255,0.07)',
            borderRadius: 20,
            padding: 24,
            marginBottom: 20,
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <MapPin size={15} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
              Mapa de Ataques Globales
            </h2>
          </div>
          <SocMap />
        </motion.div>

        {/* ── Quick links ── */}
        <motion.div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          {[
            {
              icon: <AlertTriangle size={16} />,
              label: 'Panel de seguridad avanzado',
              sub: 'Eventos, IPs bloqueadas, audit log',
              href: 'http://localhost/panel',
              color: '#f59e0b',
              external: true,
            },
            {
              icon: <Shield size={16} />,
              label: 'Admin completo (React)',
              sub: 'Gestión de productos, pedidos y usuarios',
              href: 'http://localhost/admin',
              color: '#6366f1',
              external: true,
            },
          ].map(item => (
            <a
              key={item.label}
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.025)',
                border: '0.5px solid rgba(255,255,255,0.07)',
                borderRadius: 14,
                textDecoration: 'none',
                transition: 'border-color 0.15s',
              }}
            >
              <span style={{ width: 36, height: 36, borderRadius: 10, background: `${item.color}18`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {item.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 1 }}>{item.label}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</p>
              </div>
              <ExternalLink size={13} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
            </a>
          ))}
        </motion.div>
      </div>

      <style>{`
        @keyframes socLivePulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
