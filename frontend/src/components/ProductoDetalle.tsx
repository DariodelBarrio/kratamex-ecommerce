import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ShoppingCart, Check, Monitor, Package,
  Tag, ChevronDown, Share2, Star
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { Producto } from '../interfaces'
import { StarRating, RatingForm, ValoracionesList } from './StarRating'

interface Props {
  onAddToCart: (producto: Producto) => void
  carritoCount: number
  onOpenCart: () => void
}

// =================================================================
// PRODUCTOS RELACIONADOS
// =================================================================
function SeccionRelacionados({
  categoriaActual,
  idActual,
  onAddToCart,
}: {
  categoriaActual: string
  idActual: number
  onAddToCart: (p: Producto) => void
}) {
  const navigate = useNavigate()
  const [addedId, setAddedId] = useState<number | null>(null)

  const { data: todos = [] } = useQuery<Producto[]>({
    queryKey: ['productos-relacionados', categoriaActual],
    queryFn:  () => fetch(`/api/productos?categoria=${encodeURIComponent(categoriaActual)}`).then(r => r.json()),
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
          <motion.div
            key={p.id}
            className="relacionado-card"
            onClick={() => navigate(`/producto/${p.id}`)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            whileHover={{ y: -4 }}
          >
            <div className="relacionado-img">
              {p.imagen ? (
                <img src={p.imagen} alt={p.nombre} loading="lazy" />
              ) : (
                <Monitor size={32} stroke="#475569" />
              )}
            </div>
            <div className="relacionado-info">
              <p className="relacionado-nombre">{p.nombre}</p>
              <div className="relacionado-footer">
                <span className="relacionado-precio">${p.precio.toFixed(2)}</span>
                <motion.button
                  className={`add-to-cart ${addedId === p.id ? 'add-to-cart--success' : ''}`}
                  style={{ width: 'auto', padding: '7px 14px', fontSize: '0.8rem' }}
                  onClick={e => handleAdd(e, p)}
                  whileTap={{ scale: 0.95 }}
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
export default function ProductoDetalle({ onAddToCart, carritoCount, onOpenCart }: Props) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [added, setAdded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [shared, setShared] = useState(false)

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    })
  }

  // TanStack Query — carga del producto con caché
  const { data: producto, isLoading: loading, isError } = useQuery<Producto>({
    queryKey: ['producto', id],
    queryFn:  async () => {
      const r = await fetch(`/api/productos/${id}`)
      if (r.status === 404) throw Object.assign(new Error('not_found'), { status: 404 })
      if (!r.ok) throw new Error('server_error')
      return r.json()
    },
    retry: (failureCount, error: unknown) => {
      if (error instanceof Error && error.message === 'not_found') return false
      return failureCount < 1
    },
  })

  const notFound = isError

  const handleAdd = () => {
    if (!producto || added) return
    onAddToCart(producto)
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
            <div className="skeleton-image" style={{ height: 400, borderRadius: 16 }}>
              <div className="skeleton-shimmer" />
            </div>
            <div>
              <div className="skeleton-line" style={{ width: '40%', height: 12, marginBottom: 16 }} />
              <div className="skeleton-line" style={{ width: '90%', height: 32, marginBottom: 12 }} />
              <div className="skeleton-line" style={{ width: '60%', height: 28, marginBottom: 32 }} />
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton-line" style={{ width: '100%', height: 44, marginBottom: 8, borderRadius: 10 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !producto) {
    return (
      <div className="detalle-not-found">
        <Package size={52} style={{ opacity: 0.15, marginBottom: 16 }} />
        <h2>Producto no encontrado</h2>
        <p>El producto que buscas no existe o fue eliminado.</p>
        <button className="btn-secondary" onClick={() => navigate('/')}>
          Volver a la tienda
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Mini header */}
      <header className="detalle-header">
        <div className="container detalle-header-inner">
          <button className="detalle-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Volver
          </button>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <motion.button
              className={`detalle-share-btn ${shared ? 'detalle-share-btn--ok' : ''}`}
              onClick={handleShare}
              title="Copiar enlace"
              whileTap={{ scale: 0.95 }}
            >
              <AnimatePresence mode="wait">
                {shared ? (
                  <motion.span key="ok" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Check size={14} /> Copiado
                  </motion.span>
                ) : (
                  <motion.span key="share" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Share2 size={14} /> Compartir
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
            <button className="cart-btn" onClick={onOpenCart} style={{ fontSize: '0.875rem', padding: '8px 16px' }}>
              <ShoppingCart size={16} />
              Carrito
              {carritoCount > 0 && <span className="cart-badge">{carritoCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <motion.div
        className="container detalle-page"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {/* Breadcrumb */}
        <nav className="detalle-breadcrumb">
          <button onClick={() => navigate('/')}>Tienda</button>
          {producto.categoria && (
            <>
              <ChevronDown size={12} style={{ transform: 'rotate(-90deg)', opacity: 0.4 }} />
              <button onClick={() => navigate(`/?categoria=${producto.categoria}`)}>
                {producto.categoria}
              </button>
            </>
          )}
          <ChevronDown size={12} style={{ transform: 'rotate(-90deg)', opacity: 0.4 }} />
          <span>{producto.nombre}</span>
        </nav>

        {/* Main grid */}
        <div className="detalle-grid">
          {/* Image */}
          <div className="detalle-imagen-wrap">
            {producto.imagen && !imageError ? (
              <img
                src={producto.imagen}
                alt={producto.nombre}
                className="detalle-imagen"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="detalle-imagen-placeholder">
                <Monitor size={72} stroke="#334155" />
              </div>
            )}
            {producto.categoria && (
              <div className="detalle-categoria-badge">
                <Tag size={12} /> {producto.categoria}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="detalle-info">
            <h1 className="detalle-nombre">{producto.nombre}</h1>

            <div className="detalle-precio-row">
              <span className="detalle-precio">€{producto.precio.toFixed(2)}</span>
              <span className="detalle-precio-label">IVA incluido</span>
            </div>

            {/* Rating */}
            {(producto as any).rating > 0 && (
              <div style={{ margin: '8px 0' }}>
                <StarRating rating={(producto as any).rating} count={(producto as any).numValoraciones} />
              </div>
            )}

            {/* Stock */}
            <div style={{ margin: '8px 0' }}>
              {producto.stock > 10 ? (
                <span className="stock-badge in-stock">En stock ({producto.stock} uds)</span>
              ) : producto.stock > 0 ? (
                <span className="stock-badge low-stock">Últimas {producto.stock} unidades</span>
              ) : (
                <span className="stock-badge out-of-stock">Sin stock</span>
              )}
            </div>

            {/* Image gallery */}
            {(producto as any).imagenes?.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', margin: '12px 0', flexWrap: 'wrap' }}>
                {(producto as any).imagenes.map((img: string, i: number) => (
                  <img key={i} src={img} alt={`${producto.nombre} ${i + 1}`}
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
                  />
                ))}
              </div>
            )}

            {/* Specs */}
            {specs.length > 0 && (
              <div className="detalle-specs">
                <p className="detalle-specs-title">Especificaciones</p>
                <ul className="detalle-specs-list">
                  {specs.map((spec, i) => (
                    <motion.li
                      key={i}
                      className="detalle-spec-item"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                    >
                      <span className="detalle-spec-dot" />
                      {spec}
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {/* Trust chips */}
            <div className="detalle-trust">
              <span className="detalle-trust-chip">🚚 Envío en 24–48h</span>
              <span className="detalle-trust-chip">🛡️ Garantía 1 año</span>
              <span className="detalle-trust-chip">↩️ 30 días devolución</span>
            </div>

            {/* CTA */}
            <motion.button
              className={`detalle-add-btn ${added ? 'detalle-add-btn--success' : ''}`}
              onClick={handleAdd}
              disabled={producto.stock <= 0}
              whileTap={{ scale: 0.97 }}
              style={producto.stock <= 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              <AnimatePresence mode="wait">
                {added ? (
                  <motion.span
                    key="ok"
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                  >
                    <Check size={18} /> Agregado al carrito
                  </motion.span>
                ) : (
                  <motion.span
                    key="add"
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <ShoppingCart size={18} /> Agregar al carrito
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {/* Productos relacionados */}
        {producto.categoria && (
          <SeccionRelacionados
            categoriaActual={producto.categoria}
            idActual={producto.id}
            onAddToCart={onAddToCart}
          />
        )}

        {/* Ratings */}
        <section style={{ marginTop: 32, marginBottom: 24 }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={18} /> Valoraciones
          </h3>
          <RatingForm productoId={producto.id} />
          <ValoracionesList productoId={producto.id} />
        </section>

      </motion.div>

      <footer className="store-footer" style={{ marginTop: 0 }}>
        <div className="container footer-inner">
          <span className="footer-brand">Kratamex</span>
          <span className="footer-copy">© {new Date().getFullYear()} · Todos los derechos reservados</span>
        </div>
      </footer>
    </>
  )
}
