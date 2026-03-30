'use client'

import { motion } from 'framer-motion'
import { Search, Heart, GitCompare } from 'lucide-react'
import type { Producto } from '@/lib/types'

interface ProductCardProps {
  readonly producto: Producto
  readonly onAddToCart: (p: Producto, rect: DOMRect) => void
  readonly index: number
  readonly isWishlisted: boolean
  readonly onToggleWishlist: (id: number) => void
  readonly vistaLista: boolean
  readonly estaEnComparador: boolean
  readonly onToggleComparador: (p: Producto) => void
  readonly puedeAgregarComparador: boolean
}

/* ─── Glassmorphism token ─── */
const glass = {
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  background: 'rgba(15, 23, 42, 0.55)',
  /* Gradient border de 0.5px */
  border: '0.5px solid transparent',
  backgroundImage: [
    'linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.55))',
    'linear-gradient(135deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 60%, rgba(5,150,105,0.12) 100%)',
  ].join(', '),
  backgroundOrigin: 'border-box',
  backgroundClip: 'padding-box, border-box',
} as React.CSSProperties

export function ProductCard({
  producto, onAddToCart, isWishlisted, onToggleWishlist,
  estaEnComparador, onToggleComparador, puedeAgregarComparador,
}: ProductCardProps) {
  return (
    <motion.div
      className="rounded-2xl overflow-hidden relative flex flex-col"
      style={glass}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{
        y: -5,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(5,150,105,0.25)',
      }}
    >
      {/* ── Imagen ── */}
      <a
        href={`/producto/${producto.id}`}
        className="block relative overflow-hidden"
        style={{ aspectRatio: '4/3', textDecoration: 'none' }}
      >
        <motion.div className="w-full h-full" whileHover={{ scale: 1.05 }} transition={{ duration: 0.4 }}>
          {producto.imagen
            ? (
                <img
                  src={producto.imagen}
                  alt={producto.nombre}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              )
            : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(30,41,59,0.6)' }}>
                  <Search size={32} color="var(--text-subtle)" />
                </div>
              )}
        </motion.div>

        {/* Category pill */}
        {producto.categoria && (
          <span className="absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(5,150,105,0.85)', color: '#fff', backdropFilter: 'blur(6px)' }}>
            {producto.categoria}
          </span>
        )}

        {/* Out of stock overlay */}
        {producto.stock === 0 && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(4px)' }}>
            <span className="text-sm font-semibold text-white/70 tracking-wide">Sin stock</span>
          </div>
        )}

        {/* Destacado shine */}
        {producto.destacado && (
          <div className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }}>
            ★ Top
          </div>
        )}
      </a>

      {/* ── Info ── */}
      <div className="flex flex-col flex-1 p-5">
        <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-2"
          style={{ color: 'var(--text)' }}>
          {producto.nombre}
        </h3>
        <p className="text-xs leading-relaxed mb-4 line-clamp-2 flex-1"
          style={{ color: 'var(--text-muted)' }}>
          {producto.descripcion}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-bold" style={{ color: 'var(--price)' }}>
            €{producto.precio.toFixed(2)}
          </span>

          <div className="flex items-center gap-1.5">
            <motion.button
              className="add-to-cart text-xs px-3 py-2"
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                onAddToCart(producto, rect)
              }}
              disabled={producto.stock === 0}
              whileTap={{ scale: 0.95 }}
            >
              Añadir
            </motion.button>

            <motion.button
              className="flex items-center justify-center w-8 h-8 rounded-xl"
              style={{
                background: isWishlisted ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                color: isWishlisted ? '#ef4444' : 'var(--text-subtle)',
              }}
              onClick={() => onToggleWishlist(producto.id)}
              whileTap={{ scale: 0.85 }}
              aria-label={isWishlisted ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            >
              <Heart size={13} fill={isWishlisted ? 'currentColor' : 'none'} />
            </motion.button>

            <motion.button
              className={`flex items-center justify-center w-8 h-8 rounded-xl compare-btn ${estaEnComparador ? 'compare-btn--active' : ''}`}
              style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}
              onClick={() => onToggleComparador(producto)}
              disabled={!estaEnComparador && !puedeAgregarComparador}
              whileTap={{ scale: 0.85 }}
              title={estaEnComparador ? 'Quitar de comparar' : puedeAgregarComparador ? 'Añadir a comparar' : 'Máximo 3 productos'}
            >
              <GitCompare size={13} />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
