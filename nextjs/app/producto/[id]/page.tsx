'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ShoppingCart, Check, Monitor, Package, Tag, ChevronDown, Share2, Star } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from '@/lib/store-context'
import type { Producto } from '@/lib/types'

// =================================================================
// STAR RATING
// =================================================================
function StarRating({ rating, count }: { rating: number; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div className="stars">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} size={14} fill={i <= Math.round(rating) ? '#f59e0b' : 'none'} stroke={i <= Math.round(rating) ? '#f59e0b' : 'var(--text-subtle)'} />
        ))}
      </div>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {rating.toFixed(1)}{count ? ` (${count})` : ''}
      </span>
    </div>
  )
}

// =================================================================
// ZOOM IMAGE — lupa inmersiva con seguimiento del ratón
// =================================================================
interface ZoomImageProps {
  src?: string | null
  alt: string
  imageError: boolean
  onImageError: () => void
  categoria?: string | null
}

function ZoomImage({ src, alt, imageError, onImageError, categoria }: ZoomImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(false)
  const [pos, setPos] = useState({ x: 50, y: 50 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPos({ x, y })
  }

  return (
    <div
      ref={containerRef}
      className="detalle-imagen-wrap relative overflow-hidden"
      style={{ cursor: zoom ? 'zoom-out' : 'zoom-in', borderRadius: 'var(--radius)' }}
      onMouseEnter={() => setZoom(true)}
      onMouseLeave={() => setZoom(false)}
      onMouseMove={handleMouseMove}
    >
      {src && !imageError ? (
        <motion.img
          src={src}
          alt={alt}
          className="detalle-imagen"
          onError={onImageError}
          animate={zoom
            ? { scale: 1.55, x: `${-(pos.x - 50) * 0.6}%`, y: `${-(pos.y - 50) * 0.6}%` }
            : { scale: 1, x: '0%', y: '0%' }
          }
          transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.6 }}
          style={{ transformOrigin: `${pos.x}% ${pos.y}%`, willChange: 'transform' }}
        />
      ) : (
        <div className="detalle-imagen-placeholder">
          <Monitor size={72} stroke="#334155" />
        </div>
      )}

      {categoria && (
        <div className="detalle-categoria-badge"><Tag size={12} /> {categoria}</div>
      )}

      {/* Hint de lupa al hacer hover */}
      <motion.div
        className="absolute bottom-3 right-3 text-xs px-2 py-1 rounded-full pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(6px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: zoom ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      >
        🔍 Hover para zoom
      </motion.div>
    </div>
  )
}

// =================================================================
// RELATED PRODUCTS
// =================================================================
function SeccionRelacionados({ categoriaActual, idActual, onAddToCart }: { categoriaActual: string; idActual: number; onAddToCart: (p: Producto) => void }) {
  const router = useRouter()
  const [addedId, setAddedId] = useState<number | null>(null)

  const { data: todos = [] } = useQuery<Producto[]>({
    queryKey: ['productos-relacionados', categoriaActual],
    queryFn: () => fetch(`/api/productos?categoria=${encodeURIComponent(categoriaActual)}`).then(r => r.json()),
  })

  const relacionados = todos.filter(p => p.id !== idActual).slice(0, 3)
  if (relacionados.length === 0) return null

  const handleAdd = (e: React.MouseEvent, producto: Producto) => {
    e.stopPropagation()
    onAddToCart(producto)
    setAddedId(producto.id)
    setTimeout(() => setAddedId(null), 1600)
  }

  return (
    <section className="relacionados">
      <h3 className="relacionados-title">También te puede interesar</h3>
      <div className="relacionados-grid">
        {relacionados.map((p, i) => (
          <motion.div key={p.id} className="relacionado-card"
            onClick={() => router.push(`/producto/${p.id}`)}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }} whileHover={{ y: -4 }}
          >
            <div className="relacionado-img">
              {p.imagen ? <img src={p.imagen} alt={p.nombre} loading="lazy" /> : <Monitor size={32} stroke="#475569" />}
            </div>
            <div className="relacionado-info">
              <p className="relacionado-nombre">{p.nombre}</p>
              <div className="relacionado-footer">
                <span className="relacionado-precio">${p.precio.toFixed(2)}</span>
                <motion.button
                  className={`add-to-cart ${addedId === p.id ? 'add-to-cart--success' : ''}`}
                  style={{ width: 'auto', padding: '7px 14px', fontSize: '0.8rem' }}
                  onClick={e => handleAdd(e, p)} whileTap={{ scale: 0.95 }}
                >
                  <span className="add-to-cart-content">
                    {addedId === p.id ? <><Check size={13} /> Agregado</> : <><ShoppingCart size={13} /> Agregar</>}
                  </span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

// =================================================================
// PRODUCT DETAIL PAGE
// =================================================================
export default function ProductoDetallePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { carrito, setCarrito, setCarritoAbierto } = useStore()
  const [added, setAdded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [shared, setShared] = useState(false)

  const cantidadItems = carrito.reduce((s, i) => s + i.cantidad, 0)

  const handleShare = () => {
    navigator.clipboard.writeText(globalThis.location.href).then(() => {
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    })
  }

  const { data: producto, isLoading: loading, isError } = useQuery<Producto>({
    queryKey: ['producto', params.id],
    queryFn: async () => {
      const r = await fetch(`/api/productos/${params.id}`)
      if (r.status === 404) throw Object.assign(new Error('not_found'), { status: 404 })
      if (!r.ok) throw new Error('server_error')
      return r.json()
    },
    retry: (failureCount, error: unknown) => {
      if (error instanceof Error && error.message === 'not_found') return false
      return failureCount < 1
    },
  })

  const handleAdd = () => {
    if (!producto || added) return
    setCarrito(prev => {
      const ex = prev.find(item => item.id === producto.id)
      if (ex) return prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item)
      return [...prev, { ...producto, cantidad: 1 }]
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const specs = producto?.descripcion
    ? producto.descripcion.split(',').map(s => s.trim()).filter(Boolean)
    : []

  if (loading) {
    return (
      <div className="detalle-loading-page">
        <div className="detalle-skeleton-layout">
          <div className="skeleton-line" style={{ width: 120, height: 14, marginBottom: 32 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
            <div className="skeleton-image" style={{ height: 400, borderRadius: 16 }}><div className="skeleton-shimmer" /></div>
            <div>
              {[40, 90, 60].map((w, i) => <div key={i} className="skeleton-line" style={{ width: `${w}%`, height: i === 0 ? 12 : 32, marginBottom: 16 }} />)}
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton-line" style={{ width: '100%', height: 44, marginBottom: 8, borderRadius: 10 }} />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isError || !producto) {
    return (
      <div className="detalle-not-found">
        <Package size={52} style={{ opacity: 0.15, marginBottom: 16 }} />
        <h2>Producto no encontrado</h2>
        <p>El producto que buscas no existe o fue eliminado.</p>
        <button className="btn-secondary" onClick={() => router.push('/')}>Volver a la tienda</button>
      </div>
    )
  }

  return (
    <>
      <header className="detalle-header">
        <div className="container detalle-header-inner">
          <button className="detalle-back-btn" onClick={() => router.back()}>
            <ArrowLeft size={16} /> Volver
          </button>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <motion.button
              className={`detalle-share-btn ${shared ? 'detalle-share-btn--ok' : ''}`}
              onClick={handleShare} title="Copiar enlace" whileTap={{ scale: 0.95 }}
            >
              <AnimatePresence mode="wait">
                {shared
                  ? <motion.span key="ok" style={{ display: 'flex', alignItems: 'center', gap: 6 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Check size={14} /> Copiado</motion.span>
                  : <motion.span key="share" style={{ display: 'flex', alignItems: 'center', gap: 6 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Share2 size={14} /> Compartir</motion.span>
                }
              </AnimatePresence>
            </motion.button>
            <button className="cart-btn" onClick={() => setCarritoAbierto(true)} style={{ fontSize: '0.875rem', padding: '8px 16px' }}>
              <ShoppingCart size={16} /> Carrito
              {cantidadItems > 0 && <span className="cart-badge">{cantidadItems}</span>}
            </button>
          </div>
        </div>
      </header>

      <motion.div className="container detalle-page"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      >
        <nav className="detalle-breadcrumb">
          <button onClick={() => router.push('/')}>Tienda</button>
          {producto.categoria && (
            <>
              <ChevronDown size={12} style={{ transform: 'rotate(-90deg)', opacity: 0.4 }} />
              <button onClick={() => router.push(`/?categoria=${producto.categoria}`)}>{producto.categoria}</button>
            </>
          )}
          <ChevronDown size={12} style={{ transform: 'rotate(-90deg)', opacity: 0.4 }} />
          <span>{producto.nombre}</span>
        </nav>

        <div className="detalle-grid">
          <ZoomImage
            src={producto.imagen}
            alt={producto.nombre}
            imageError={imageError}
            onImageError={() => setImageError(true)}
            categoria={producto.categoria}
          />

          <div className="detalle-info">
            <h1 className="detalle-nombre">{producto.nombre}</h1>
            <div className="detalle-precio-row">
              <span className="detalle-precio">€{producto.precio.toFixed(2)}</span>
              <span className="detalle-precio-label">IVA incluido</span>
            </div>

            {(producto as any).rating > 0 && (
              <div style={{ margin: '8px 0' }}>
                <StarRating rating={(producto as any).rating} count={(producto as any).numValoraciones} />
              </div>
            )}

            <div style={{ margin: '8px 0' }}>
              {producto.stock > 10
                ? <span className="stock-badge in-stock">En stock ({producto.stock} uds)</span>
                : producto.stock > 0
                  ? <span className="stock-badge low-stock">Últimas {producto.stock} unidades</span>
                  : <span className="stock-badge out-of-stock">Sin stock</span>
              }
            </div>

            {(producto as any).imagenes?.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', margin: '12px 0', flexWrap: 'wrap' }}>
                {(producto as any).imagenes.map((img: string, i: number) => (
                  <img key={img} src={img} alt={`${producto.nombre} ${i + 1}`}
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }} />
                ))}
              </div>
            )}

            {specs.length > 0 && (
              <div className="detalle-specs">
                <p className="detalle-specs-title">Especificaciones</p>
                <ul className="detalle-specs-list">
                  {specs.map((spec, i) => (
                    <motion.li key={spec} className="detalle-spec-item"
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                    >
                      <span className="detalle-spec-dot" />{spec}
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            <div className="detalle-trust">
              <span className="detalle-trust-chip">🚚 Envío en 24–48h</span>
              <span className="detalle-trust-chip">🛡️ Garantía 1 año</span>
              <span className="detalle-trust-chip">🔄 30 días devolución</span>
            </div>

            <motion.button
              className={`detalle-add-btn ${added ? 'detalle-add-btn--success' : ''}`}
              onClick={handleAdd}
              disabled={producto.stock === 0 || added}
              whileTap={{ scale: 0.98 }}
            >
              <AnimatePresence mode="wait">
                {added
                  ? <motion.span key="ok" style={{ display: 'flex', alignItems: 'center', gap: 8 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Check size={18} /> Añadido al carrito</motion.span>
                  : <motion.span key="add" style={{ display: 'flex', alignItems: 'center', gap: 8 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <ShoppingCart size={18} />
                      {producto.stock === 0 ? 'Sin stock' : 'Añadir al carrito'}
                    </motion.span>
                }
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {producto.categoria && (
          <SeccionRelacionados
            categoriaActual={producto.categoria}
            idActual={producto.id}
            onAddToCart={p => setCarrito(prev => {
              const ex = prev.find(item => item.id === p.id)
              if (ex) return prev.map(item => item.id === p.id ? { ...item, cantidad: item.cantidad + 1 } : item)
              return [...prev, { ...p, cantidad: 1 }]
            })}
          />
        )}
      </motion.div>
    </>
  )
}
