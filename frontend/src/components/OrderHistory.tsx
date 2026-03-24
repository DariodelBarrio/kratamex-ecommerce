import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronDown, ChevronUp } from 'lucide-react';
import { getMisPedidos } from '../api';
import { t } from '../i18n';
import type { Pedido, PedidoItem } from '../interfaces';

// =================================================================
// ORDER HISTORY — User's past orders with expand/collapse items
// =================================================================

const statusColors: Record<string, { bg: string; text: string }> = {
  pendiente: { bg: '#fef3c7', text: '#92400e' },
  confirmado: { bg: '#dbeafe', text: '#1e40af' },
  enviado: { bg: '#ede9fe', text: '#6b21a8' },
  entregado: { bg: '#d1fae5', text: '#065f46' },
  cancelado: { bg: '#fee2e2', text: '#991b1b' },
};

function OrderSkeleton() {
  const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--border-color) 25%, transparent 50%, var(--border-color) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 6,
  };

  return (
    <>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ ...shimmer, width: 120, height: 20 }} />
            <div style={{ ...shimmer, width: 80, height: 24, borderRadius: 12 }} />
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ ...shimmer, width: 140, height: 16 }} />
            <div style={{ ...shimmer, width: 100, height: 16 }} />
          </div>
        </div>
      ))}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  );
}

function StatusBadge({ estado }: Readonly<{ estado: string }>) {
  const colors = statusColors[estado] || statusColors.pendiente;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: colors.bg,
        color: colors.text,
        textTransform: 'capitalize',
      }}
    >
      {t(`status.${estado}`) || estado}
    </span>
  );
}

function OrderCard({ pedido }: Readonly<{ pedido: Pedido }>) {
  const [expanded, setExpanded] = useState(false);
  const items: PedidoItem[] = pedido.items || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>
          {t('orders.order')} #{pedido.id}
        </span>
        <StatusBadge estado={pedido.estado} />
      </div>

      {/* Meta */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 20,
          color: 'var(--text-secondary)',
          fontSize: 14,
          marginBottom: 12,
        }}
      >
        <span>
          {t('orders.date')}: {new Date(pedido.fecha).toLocaleDateString()}
        </span>
        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
          {t('orders.total')}: ${pedido.total.toFixed(2)}
        </span>
      </div>

      {/* Expand toggle */}
      {items.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              padding: '4px 0',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {items.length} {t('orders.items')}
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        background: 'var(--card-bg)',
                      }}
                    >
                      {item.imagen ? (
                        <img
                          src={item.imagen}
                          alt={item.nombre}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 6,
                            objectFit: 'cover',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 6,
                            background: 'var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Package size={20} stroke="var(--text-secondary)" />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                            fontSize: 14,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.nombre}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                          x{item.cantidad}
                        </div>
                      </div>
                      <span
                        style={{
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        ${(item.precio * item.cantidad).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}

export default function OrderHistory() {
  const { data: pedidos, isLoading, isError } = useQuery<Pedido[]>({
    queryKey: ['misPedidos'],
    queryFn: getMisPedidos,
    enabled: !!localStorage.getItem('kratamex_token'),
  });

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      <h2
        style={{
          color: 'var(--text-primary)',
          fontSize: 24,
          fontWeight: 700,
          marginBottom: 24,
        }}
      >
        {t('orders.title')}
      </h2>

      {isLoading && <OrderSkeleton />}

      {isError && (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 32 }}>
          {t('general.error')}
        </p>
      )}

      {!isLoading && !isError && (!pedidos || pedidos.length === 0) && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 16px',
            color: 'var(--text-secondary)',
          }}
        >
          <Package size={48} strokeWidth={1.5} style={{ marginBottom: 16, opacity: 0.5 }} />
          <p style={{ fontSize: 16 }}>{t('orders.empty')}</p>
        </div>
      )}

      {pedidos && pedidos.length > 0 && (
        <div>
          {pedidos.map((pedido) => (
            <OrderCard key={pedido.id} pedido={pedido} />
          ))}
        </div>
      )}
    </div>
  );
}
