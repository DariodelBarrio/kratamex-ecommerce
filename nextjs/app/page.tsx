'use client'

import { useState, useMemo, useRef, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Check, Search, Heart, ArrowUp, GitCompare } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { StoreHeader } from '@/components/StoreHeader'
import { StoreHero } from '@/components/StoreHero'
import { StoreFooter } from '@/components/StoreFooter'
import { BrandCarousel } from '@/components/BrandCarousel'
import { ProductComparator } from '@/components/ProductComparator'
import { useStore } from '@/lib/store-context'
import { useFiltros } from '@/hooks/useFiltros'
import { useToasts } from '@/hooks/useToasts'
import { useComparador } from '@/hooks/useComparador'
import * as api from '@/lib/api'
import type { Producto, CarritoItem } from '@/lib/types'
import type { OrdenPrecio } from '@/hooks/useFiltros'

// =================================================================
// ZOD — Validación de formulario de checkout
// =================================================================
const CheckoutSchema = z.object({
  cliente:   z.string().min(1, 'Nombre requerido').max(200),
  email:     z.string().email('Email inválido').max(254),
  direccion: z.string().min(1, 'Dirección requerida').max(500),
})

// =================================================================
// TOAST CONTAINER
// =================================================================
interface Toast { id: number; nombre: string }

function ToastContainer({ toasts }: Readonly<{ toasts: Toast[] }>) {
  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} className="toast"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <div className="toast-icon"><Check size={13} /></div>
            <span><strong>{t.nombre}</strong> agregado al carrito</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// =================================================================
// ACTIVE FILTERS
// =================================================================
interface ActiveFiltersProps {
  readonly categoriaFiltro: string
  readonly setCategoriaFiltro: (v: string) => void
  readonly busqueda: string
  readonly setBusqueda: (v: string) => void
  readonly ordenPrecio: OrdenPrecio
  readonly setOrdenPrecio: (v: OrdenPrecio) => void
  readonly filtrarFavoritos: boolean
  readonly setFiltrarFavoritos: (v: boolean) => void
  readonly precioMin: string
  readonly setPrecioMin: (v: string) => void
  readonly precioMax: string
  readonly setPrecioMax: (v: string) => void
}

function ActiveFilters({ categoriaFiltro, setCategoriaFiltro, busqueda, setBusqueda, ordenPrecio, setOrdenPrecio, filtrarFavoritos, setFiltrarFavoritos, precioMin, setPrecioMin, precioMax, setPrecioMax }: ActiveFiltersProps) {
  return (
    <div className="active-filters">
      {categoriaFiltro && <button className="active-filter-tag" onClick={() => setCategoriaFiltro('')}>{categoriaFiltro} ×</button>}
      {busqueda && <button className="active-filter-tag" onClick={() => setBusqueda('')}>"{busqueda}" ×</button>}
      {ordenPrecio && <button className="active-filter-tag" onClick={() => setOrdenPrecio('')}>{ordenPrecio === 'asc' ? 'Precio ↑' : 'Precio ↓'} ×</button>}
      {filtrarFavoritos && <button className="active-filter-tag" onClick={() => setFiltrarFavoritos(false)}>Favoritos ×</button>}
      {(precioMin || precioMax) && (
        <button className="active-filter-tag" onClick={() => { setPrecioMin(''); setPrecioMax('') }}>
          {precioMin ? `$${precioMin}` : ''}{precioMin && precioMax ? ' – ' : ''}{precioMax ? `$${precioMax}` : ''} ×
        </button>
      )}
    </div>
  )
}

// =================================================================
// SKELETON
// =================================================================
function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-image"><div className="skeleton-shimmer" /></div>
      <div style={{ padding: '18px 20px 20px' }}>
        <div className="skeleton-line skeleton-category" />
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line skeleton-desc" />
        <div className="skeleton-line skeleton-desc-short" />
        <div className="skeleton-line skeleton-price" />
        <div className="skeleton-line skeleton-btn" />
      </div>
    </div>
  )
}

// =================================================================
// PRODUCT CARD (minimal — full version in Sprint 1)
// =================================================================
interface ProductCardProps {
  readonly producto: Producto
  readonly onAddToCart: (p: Producto) => void
  readonly index: number
  readonly isWishlisted: boolean
  readonly onToggleWishlist: (id: number) => void
  readonly vistaLista: boolean
  readonly estaEnComparador: boolean
  readonly onToggleComparador: (p: Producto) => void
  readonly puedeAgregarComparador: boolean
}

function ProductCard({ producto, onAddToCart, isWishlisted, onToggleWishlist, estaEnComparador, onToggleComparador, puedeAgregarComparador }: ProductCardProps) {
  return (
    <motion.div
      className={`product-card${producto.destacado ? ' product-card--destacado' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <a href={`/producto/${producto.id}`} className="product-image-area" style={{ textDecoration: 'none', display: 'block' }}>
        {producto.imagen
          ? <img src={producto.imagen} alt={producto.nombre} loading="lazy" />
          : <div className="product-image-placeholder"><Search size={32} /></div>
        }
        {producto.categoria && <span className="product-category-pill">{producto.categoria}</span>}
        {producto.stock === 0 && (
          <div className="product-out-of-stock-overlay">
            <span className="product-out-of-stock-label">Sin stock</span>
          </div>
        )}
      </a>
      <div className="product-info">
        <h3 className="product-name">{producto.nombre}</h3>
        <p className="product-description">{producto.descripcion}</p>
        <div className="product-card-footer">
          <span className="product-price">${producto.precio.toFixed(2)}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="add-to-cart"
              onClick={() => onAddToCart(producto)}
              disabled={producto.stock === 0}
            >
              Añadir al carrito
            </button>
            <button
              onClick={() => onToggleWishlist(producto.id)}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '0 10px', cursor: 'pointer', color: isWishlisted ? '#ef4444' : 'var(--text-subtle)', transition: 'color 0.2s' }}
              aria-label={isWishlisted ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            >
              <Heart size={15} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
            <button
              className={`compare-btn ${estaEnComparador ? 'compare-btn--active' : ''}`}
              onClick={() => onToggleComparador(producto)}
              disabled={!estaEnComparador && !puedeAgregarComparador}
              title={estaEnComparador ? 'Quitar de comparar' : puedeAgregarComparador ? 'Añadir a comparar' : 'Máximo 3 productos'}
            >
              <GitCompare size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// =================================================================
// CART PANEL (minimal — full version migrated in next step)
// =================================================================
interface CartPanelProps {
  carrito: CarritoItem[]
  cantidadItems: number
  subtotal: number
  total: number
  onClose: () => void
  onEliminar: (id: number) => void
  onCheckout: () => void
  checkoutPending: boolean
  formulario: { cliente: string; email: string; direccion: string }
  setFormulario: React.Dispatch<React.SetStateAction<{ cliente: string; email: string; direccion: string }>>
  formError: string
}

function CartPanel({ carrito, cantidadItems, subtotal, total, onClose, onEliminar, onCheckout, checkoutPending, formulario, setFormulario, formError }: CartPanelProps) {
  return (
    <motion.div
      className="cart-panel"
      onClick={e => e.stopPropagation()}
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="cart-header">
        <div className="cart-header-left">
          <h2>Carrito</h2>
          {cantidadItems > 0 && <span className="cart-header-count">{cantidadItems}</span>}
        </div>
        <button className="cart-close-btn" onClick={onClose} aria-label="Cerrar carrito">×</button>
      </div>

      {carrito.length === 0 ? (
        <div className="empty-cart">
          <div className="empty-cart-icon"><Search size={40} /></div>
          <h3>Tu carrito está vacío</h3>
          <p>Añade productos para continuar</p>
        </div>
      ) : (
        <>
          <div className="cart-items">
            {carrito.map(item => (
              <div key={item.id} className="cart-item">
                <div className="brand-logo-sm">
                  {item.imagen && <img src={item.imagen} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div className="cart-item-info">
                  <p className="cart-item-name">{item.nombre}</p>
                  <div className="cart-item-subtotal">
                    <span className="cart-item-price">${(item.precio * item.cantidad).toFixed(2)}</span>
                    <span className="cart-item-unit">× {item.cantidad}</span>
                  </div>
                </div>
                <button className="remove-btn" onClick={() => onEliminar(item.id)}>✕</button>
              </div>
            ))}
          </div>
          <div className="cart-footer">
            <div className="cart-total">
              <span className="cart-total-label">Subtotal</span>
              <span className="cart-total-value">${subtotal.toFixed(2)}</span>
            </div>
            <p className="cart-total-items">Total: <strong>${total.toFixed(2)}</strong> (IVA incl.)</p>

            <div className="checkout-form">
              <input className="form-input" placeholder="Nombre completo" value={formulario.cliente}
                onChange={e => setFormulario(f => ({ ...f, cliente: e.target.value }))} />
              <input className="form-input" placeholder="Email" type="email" value={formulario.email}
                onChange={e => setFormulario(f => ({ ...f, email: e.target.value }))} />
              <input className="form-input" placeholder="Dirección de entrega" value={formulario.direccion}
                onChange={e => setFormulario(f => ({ ...f, direccion: e.target.value }))} />
              {formError && <p style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{formError}</p>}
              <button className="checkout-btn" onClick={onCheckout} disabled={checkoutPending}>
                {checkoutPending ? 'Procesando...' : 'Confirmar pedido'}
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}

// =================================================================
// CATALOG CONTENT
// =================================================================
const SKELETON_KEYS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']

function CatalogContent({ loading, productosFiltrados, vistaLista, filtrarFavoritos, busqueda, categoriaFiltro, limpiarFiltros, wishlistExterno, onAddToCart, onToggleWishlist, comparadorIds, onToggleComparador, puedeAgregarComparador }: {
  loading: boolean
  productosFiltrados: Producto[]
  vistaLista: boolean
  filtrarFavoritos: boolean
  busqueda: string
  categoriaFiltro: string
  limpiarFiltros: () => void
  wishlistExterno: number[]
  onAddToCart: (p: Producto) => void
  onToggleWishlist: (id: number) => void
  comparadorIds: number[]
  onToggleComparador: (p: Producto) => void
  puedeAgregarComparador: boolean
}) {
  if (loading) {
    return (
      <div className={vistaLista ? 'products-list' : 'products-grid'}>
        {SKELETON_KEYS.map(k => <SkeletonCard key={k} />)}
      </div>
    )
  }
  if (productosFiltrados.length === 0) {
    return (
      <div className="no-results">
        <div className="no-results-icon">{filtrarFavoritos ? <Heart size={52} /> : <Search size={52} />}</div>
        <h3>{filtrarFavoritos ? 'Sin favoritos aún' : 'Sin resultados'}</h3>
        <p>{filtrarFavoritos ? 'Guarda productos con el corazón para verlos aquí' : `No hay productos para "${busqueda || categoriaFiltro}"`}</p>
        <button className="btn-secondary" onClick={limpiarFiltros}>Limpiar filtros</button>
      </div>
    )
  }
  return (
    <div className={vistaLista ? 'products-list' : 'products-grid'}>
      {productosFiltrados.map((producto, index) => (
        <ProductCard key={producto.id} producto={producto} onAddToCart={onAddToCart} index={index}
          isWishlisted={wishlistExterno.includes(producto.id)} onToggleWishlist={onToggleWishlist} vistaLista={vistaLista}
          estaEnComparador={comparadorIds.includes(producto.id)} onToggleComparador={onToggleComparador} puedeAgregarComparador={puedeAgregarComparador} />
      ))}
    </div>
  )
}

// =================================================================
// HOME PAGE
// =================================================================
function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoriaURL = searchParams.get('categoria') || ''
  const productosRef = useRef<HTMLElement>(null)

  const { carrito, setCarrito, carritoAbierto, setCarritoAbierto, wishlist, toggleWishlist, tema, toggleTema, authUser, handleLogout } = useStore()
  const filtros = useFiltros()
  const { toasts, addToast } = useToasts()
  const comparador = useComparador()

  const [vistaLista, setVistaLista] = useState(false)
  const [showBackTop, setShowBackTop] = useState(false)
  const [cuponCodigo, setCuponCodigo] = useState('')
  const [cuponDescuento, setCuponDescuento] = useState(0)
  const [cuponError, setCuponError] = useState('')
  const [formulario, setFormulario] = useState({ cliente: '', email: '', direccion: '' })
  const [formError, setFormError] = useState('')
  const [comparadorAbierto, setComparadorAbierto] = useState(false)

  useEffect(() => {
    const fn = () => setShowBackTop(globalThis.scrollY > 420)
    globalThis.addEventListener('scroll', fn, { passive: true })
    return () => globalThis.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    if (!carritoAbierto) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setCarritoAbierto(false) }
    globalThis.addEventListener('keydown', fn)
    return () => globalThis.removeEventListener('keydown', fn)
  }, [carritoAbierto, setCarritoAbierto])

  // Fetch products
  const params = new URLSearchParams()
  if (filtros.busqueda) params.append('busqueda', filtros.busqueda)
  if (filtros.categoriaFiltro || categoriaURL) params.append('categoria', filtros.categoriaFiltro || categoriaURL)
  if (filtros.ordenPrecio) params.append('orden', filtros.ordenPrecio)

  const { data: productos = [], isLoading: loading } = useQuery<Producto[]>({
    queryKey: ['productos', filtros.busqueda, filtros.categoriaFiltro || categoriaURL, filtros.ordenPrecio],
    queryFn: () => fetch(`/api/productos?${params}`).then(r => r.json()),
  })

  const categoriasConConteo = useMemo(() => {
    const counts: Record<string, number> = {}
    productos.forEach(p => { if (p.categoria) counts[p.categoria] = (counts[p.categoria] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [productos])

  const productosFiltrados = useMemo(() => {
    let result = productos
    if (filtros.filtrarFavoritos) result = result.filter(p => wishlist.includes(p.id))
    if (filtros.precioMin !== '') result = result.filter(p => p.precio >= Number(filtros.precioMin))
    if (filtros.precioMax !== '') result = result.filter(p => p.precio <= Number(filtros.precioMax))
    return result
  }, [productos, filtros.filtrarFavoritos, wishlist, filtros.precioMin, filtros.precioMax])

  // Cart actions
  const agregarAlCarrito = (producto: Producto) => {
    setCarrito(prev => {
      const existente = prev.find(item => item.id === producto.id)
      if (existente) return prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item)
      return [...prev, { ...producto, cantidad: 1 }]
    })
    addToast(producto.nombre)
  }

  const eliminarItem = (id: number) => setCarrito(prev => prev.filter(item => item.id !== id))

  const subtotalCarrito   = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
  const envioCarrito      = subtotalCarrito >= 100 ? 0 : 5.99
  const impuestosCarrito  = Math.round(subtotalCarrito * 0.21 * 100) / 100
  const totalCarrito      = Math.round((subtotalCarrito - cuponDescuento + impuestosCarrito + envioCarrito) * 100) / 100
  const cantidadItems     = carrito.reduce((sum, item) => sum + item.cantidad, 0)

  const checkoutMutation = useMutation({
    mutationFn: () => api.postPedido({
      ...formulario,
      items: carrito.map(item => ({ id: item.id, cantidad: item.cantidad })),
      cupon: cuponCodigo || undefined,
    }),
    onSuccess: () => {
      setCarrito([])
      setCuponCodigo('')
      setCuponDescuento(0)
      setCarritoAbierto(false)
      router.push('/mis-pedidos')
    },
    onError: (err: any) => setFormError(err.message),
  })

  const handleCheckout = () => {
    setFormError('')
    const result = CheckoutSchema.safeParse(formulario)
    if (!result.success) { setFormError(result.error.issues[0].message); return }
    checkoutMutation.mutate()
  }

  return (
    <>
      <StoreHeader
        busqueda={filtros.busqueda}            setBusqueda={v => filtros.setBusqueda(v)}
        tema={tema}                             onToggleTema={toggleTema}
        authUser={authUser}                     onLogout={handleLogout}
        cantidadItems={cantidadItems}           onOpenCart={() => setCarritoAbierto(true)}
        productos={productos}                   loading={loading}
        categoriaFiltro={filtros.categoriaFiltro} setCategoriaFiltro={v => filtros.setCategoriaFiltro(v)}
        filtrarFavoritos={filtros.filtrarFavoritos} setFiltrarFavoritos={v => filtros.setFiltrarFavoritos(v)}
        wishlistCount={wishlist.length}
        categoriasConConteo={categoriasConConteo}
        precioMin={filtros.precioMin}          setPrecioMin={v => filtros.setPrecioMin(v)}
        precioMax={filtros.precioMax}          setPrecioMax={v => filtros.setPrecioMax(v)}
        ordenPrecio={filtros.ordenPrecio}      setOrdenPrecio={v => filtros.setOrdenPrecio(v)}
        vistaLista={vistaLista}                setVistaLista={setVistaLista}
        comparadorCount={comparador.productosSeleccionados.length}
        onOpenComparador={() => setComparadorAbierto(true)}
      />

      <StoreHero onScrollToProductos={() => productosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} authUser={authUser} />

      <BrandCarousel />

      <main className="container products-section" ref={productosRef}>
        {!loading && (
          <div className="section-header">
            <h2 className="section-title">Catálogo</h2>
            <span className="section-count">{productosFiltrados.length} producto{productosFiltrados.length === 1 ? '' : 's'}</span>
            {filtros.hayFiltrosActivos && (
              <ActiveFilters
                categoriaFiltro={filtros.categoriaFiltro}  setCategoriaFiltro={v => filtros.setCategoriaFiltro(v)}
                busqueda={filtros.busqueda}                 setBusqueda={v => filtros.setBusqueda(v)}
                ordenPrecio={filtros.ordenPrecio}           setOrdenPrecio={v => filtros.setOrdenPrecio(v)}
                filtrarFavoritos={filtros.filtrarFavoritos} setFiltrarFavoritos={v => filtros.setFiltrarFavoritos(v)}
                precioMin={filtros.precioMin}               setPrecioMin={v => filtros.setPrecioMin(v)}
                precioMax={filtros.precioMax}               setPrecioMax={v => filtros.setPrecioMax(v)}
              />
            )}
          </div>
        )}
        <CatalogContent
          loading={loading}
          productosFiltrados={productosFiltrados}
          vistaLista={vistaLista}
          filtrarFavoritos={filtros.filtrarFavoritos}
          busqueda={filtros.busqueda}
          categoriaFiltro={filtros.categoriaFiltro}
          limpiarFiltros={filtros.limpiarFiltros}
          wishlistExterno={wishlist}
          onAddToCart={agregarAlCarrito}
          onToggleWishlist={toggleWishlist}
          comparadorIds={comparador.productosSeleccionados.map(p => p.id)}
          onToggleComparador={(p) => {
            if (comparador.estaEnComparador(p.id)) {
              comparador.eliminarProducto(p.id)
            } else {
              comparador.agregarProducto(p)
            }
          }}
          puedeAgregarComparador={comparador.puedeAgregar}
        />
      </main>

      <StoreFooter />

      {/* Cart overlay */}
      <AnimatePresence>
        {carritoAbierto && (
          <motion.div className="cart-overlay" onClick={() => setCarritoAbierto(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <CartPanel
              carrito={carrito}
              cantidadItems={cantidadItems}
              subtotal={subtotalCarrito}
              total={totalCarrito}
              onClose={() => setCarritoAbierto(false)}
              onEliminar={eliminarItem}
              onCheckout={handleCheckout}
              checkoutPending={checkoutMutation.isPending}
              formulario={formulario}
              setFormulario={setFormulario}
              formError={formError}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back to top */}
      <AnimatePresence>
        {showBackTop && (
          <motion.button className="back-to-top"
            onClick={() => globalThis.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Volver arriba"
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.2 }}
          >
            <ArrowUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} />

      <AnimatePresence>
        {comparador.productosSeleccionados.length > 0 && (
          <motion.button
            className="comparador-float-btn"
            onClick={() => setComparadorAbierto(true)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <GitCompare size={18} />
            <span>Comparar ({comparador.productosSeleccionados.length})</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {comparadorAbierto && (
          <ProductComparator
            productos={comparador.productosSeleccionados}
            onRemove={comparador.eliminarProducto}
            onClear={comparador.limpiarComparador}
            onClose={() => setComparadorAbierto(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  )
}
