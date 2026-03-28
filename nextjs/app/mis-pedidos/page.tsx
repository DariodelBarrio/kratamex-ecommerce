'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useStore } from '@/lib/store-context'
import { getMisPedidos } from '@/lib/api'
import type { Pedido, PedidoItem } from '@/lib/types'

const statusColors: Record<string, { bg: string; text: string }> = {
  pendiente:  { bg: '#fef3c7', text: '#92400e' },
  confirmado: { bg: '#dbeafe', text: '#1e40af' },
  enviado:    { bg: '#ede9fe', text: '#6b21a8' },
  entregado:  { bg: '#d1fae5', text: '#065f46' },
  cancelado:  { bg: '#fee2e2', text: '#991b1b' },
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', confirmado: 'Confirmado',
  enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado',
}

function OrderSkeleton() {
  return (
    <>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="skeleton-line" style={{ width: 120, height: 20 }} />
            <div className="skeleton-line" style={{ width: 80, height: 24, borderRadius: 12 }} />
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div className="skeleton-line" style={{ width: 140, height: 16 }} />
            <div className="skeleton-line" style={{ width: 100, height: 16 }} />
          </div>
        </div>
      ))}
    </>
  )
}

function OrderCard({ pedido }: { pedido: Pedido }) {
  const [expanded, setExpanded] = useState(false)
  const items: PedidoItem[] = pedido.items || []
  const colors = statusColors[pedido.estado] || statusColors.pendiente

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 16 }}>Pedido #{pedido.id}</span>
        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: colors.bg, color: colors.text, textTransform: 'capitalize' }}>
          {STATUS_LABELS[pedido.estado] || pedido.estado}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
        <span>Fecha: {new Date(pedido.fecha).toLocaleDateString()}</span>
        <span style={{ fontWeight: 600, color: 'var(--price)' }}>Total: ${pedido.total.toFixed(2)}</span>
      </div>

      {items.length > 0 && (
        <>
          <button onClick={() => setExpanded(!expanded)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', padding: '4px 0', fontSize: 13, fontWeight: 500 }}
          >
            {items.length} artículos {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
                      {item.imagen
                        ? <img src={item.imagen} alt={item.nombre} style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Package size={20} /></div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--text)', fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nombre}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>x{item.cantidad}</div>
                      </div>
                      <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, flexShrink: 0 }}>${(item.precio * item.cantidad).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}

export default function MisPedidosPage() {
  const router = useRouter()
  const { authUser } = useStore()

  if (!authUser) { router.replace('/login'); return null }

  const { data: pedidos, isLoading, isError } = useQuery<Pedido[]>({
    queryKey: ['misPedidos'],
    queryFn: getMisPedidos,
  })

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', position: 'relative' }}>
      <button onClick={() => router.back()} title="Volver"
        style={{ position: 'absolute', top: 24, right: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 6 }}
      >
        <X size={16} />
      </button>
      <h2 style={{ color: 'var(--text)', fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Mis pedidos</h2>

      {isLoading && <OrderSkeleton />}
      {isError && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Error al cargar pedidos</p>}
      {!isLoading && !isError && (!pedidos || pedidos.length === 0) && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
          <Package size={48} strokeWidth={1.5} style={{ marginBottom: 16, opacity: 0.5 }} />
          <p style={{ fontSize: 16 }}>No tienes pedidos aún</p>
        </div>
      )}
      {pedidos?.map(pedido => <OrderCard key={pedido.id} pedido={pedido} />)}
    </div>
  )
}
