/*
=================================================================
KRATAMEX - TIENDA ONLINE
=================================================================
React 19 + TypeScript + Framer Motion
=================================================================
*/

import { useState, useMemo, useRef } from 'react'
import { Routes, Route, Link, useSearchParams } from 'react-router-dom'
import { ShoppingCart, X, Plus, Minus, Check, Search, Package, Truck, Shield, ArrowDown, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import Admin from './components/Admin/Admin'
import { ProductCard, BrandLogoSmall } from './components/ProductCard'
import { SkeletonCard } from './components/SkeletonCard'
import { SecurityBadge } from './components/SecurityBadge'
import ProductoDetalle from './components/ProductoDetalle'
import { Producto, CarritoItem } from './interfaces'

// =================================================================
// ZOD — Validación de formulario de checkout
// =================================================================
const CheckoutSchema = z.object({
  cliente:   z.string().min(1, 'Nombre requerido').max(200),
  email:     z.string().email('Email inválido').max(254),
  direccion: z.string().min(1, 'Dirección requerida').max(500),
})

// =================================================================
// TIENDA
// =================================================================
interface TiendaProps {
  carritoExterno: CarritoItem[]
  setCarritoExterno: React.Dispatch<React.SetStateAction<CarritoItem[]>>
  carritoAbiertoExterno: boolean
  setCarritoAbiertoExterno: (v: boolean) => void
}

function Tienda({ carritoExterno, setCarritoExterno, carritoAbiertoExterno, setCarritoAbiertoExterno }: TiendaProps) {
  const carrito = carritoExterno
  const setCarrito = setCarritoExterno
  const carritoAbierto = carritoAbiertoExterno
  const setCarritoAbierto = setCarritoAbiertoExterno
  const [checkoutExitoso, setCheckoutExitoso] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [ordenPrecio, setOrdenPrecio] = useState<'asc' | 'desc' | ''>('')
  const [formulario, setFormulario] = useState({ cliente: '', email: '', direccion: '' })
  const [formError, setFormError] = useState('')

  const productosRef = useRef<HTMLElement>(null)
  const [searchParams] = useSearchParams()

  // Sincronizar categoría desde URL (?categoria=...)
  const categoriaURL = searchParams.get('categoria') || ''

  // TanStack Query — carga de productos con caché automático
  const params = new URLSearchParams()
  if (busqueda) params.append('busqueda', busqueda)
  if (categoriaFiltro || categoriaURL) params.append('categoria', categoriaFiltro || categoriaURL)
  if (ordenPrecio) params.append('orden', ordenPrecio)

  const { data: productos = [], isLoading: loading } = useQuery<Producto[]>({
    queryKey: ['productos', busqueda, categoriaFiltro || categoriaURL, ordenPrecio],
    queryFn:  () => fetch(`/api/productos?${params}`).then(r => r.json()),
  })

  // Categorías con conteo
  const categoriasConConteo = useMemo(() => {
    const counts: Record<string, number> = {}
    productos.forEach(p => {
      if (p.categoria) counts[p.categoria] = (counts[p.categoria] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [productos])

  const productosFiltrados = productos

  // Carrito
  const agregarAlCarrito = (producto: Producto) => {
    setCarrito(prev => {
      const existente = prev.find(item => item.id === producto.id)
      if (existente) {
        return prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item)
      }
      return [...prev, { ...producto, cantidad: 1 }]
    })
  }

  const actualizarCantidad = (id: number, delta: number) => {
    setCarrito(prev =>
      prev.map(item => item.id === id ? { ...item, cantidad: Math.max(1, item.cantidad + delta) } : item)
    )
  }

  const eliminarItem = (id: number) => setCarrito(prev => prev.filter(item => item.id !== id))

  const totalCarrito = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
  const cantidadItems = carrito.reduce((sum, item) => sum + item.cantidad, 0)

  // TanStack Query — mutación de checkout
  const checkoutMutation = useMutation({
    mutationFn: (data: typeof formulario) =>
      fetch('/api/pedidos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...data,
          items: carrito.map(item => ({ id: item.id, cantidad: item.cantidad })),
        }),
      }).then(async r => {
        if (!r.ok) {
          const err = await r.json()
          throw new Error(err.error || 'Error al procesar el pedido')
        }
        return r.json()
      }),
    onSuccess: () => {
      setCarrito([])
      setCheckoutExitoso(true)
      setFormError('')
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const handleCheckout = () => {
    setFormError('')
    const result = CheckoutSchema.safeParse(formulario)
    if (!result.success) {
      setFormError(result.error.issues[0].message)
      return
    }
    checkoutMutation.mutate(formulario)
  }

  const cerrarCarrito = () => {
    setCarritoAbierto(false)
    setTimeout(() => setCheckoutExitoso(false), 300)
  }

  const scrollToProductos = () => {
    productosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const limpiarFiltros = () => { setBusqueda(''); setCategoriaFiltro(''); setOrdenPrecio('') }

  const hayFiltrosActivos = busqueda || categoriaFiltro || ordenPrecio

  return (
    <>
      {/* ═══════ HEADER ═══════ */}
      <header>
        <div className="container header-main">
          <div className="header-left">
            <Link to="/" className="logo">Kratamex</Link>
            <SecurityBadge />
          </div>

          <div className="search-bar">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="search-input"
            />
            {busqueda && (
              <button className="search-clear" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda">
                <X size={14} />
              </button>
            )}
          </div>

          <button className="cart-btn" onClick={() => setCarritoAbierto(true)}>
            <ShoppingCart size={17} />
            Carrito
            {cantidadItems > 0 && <span className="cart-badge">{cantidadItems}</span>}
          </button>
        </div>

        {/* Category pills + sort */}
        <div className="container">
          <div className="category-nav">
            <button
              className={`category-pill ${!categoriaFiltro ? 'active' : ''}`}
              onClick={() => setCategoriaFiltro('')}
            >
              Todos
              {!loading && <span className="category-pill-count">{productos.length}</span>}
            </button>

            {categoriasConConteo.map(([cat, count]) => (
              <button
                key={cat}
                className={`category-pill ${categoriaFiltro === cat ? 'active' : ''}`}
                onClick={() => setCategoriaFiltro(prev => prev === cat ? '' : cat)}
              >
                {cat}
                <span className="category-pill-count">{count}</span>
              </button>
            ))}

            <div className="filters-right">
              <select
                value={ordenPrecio}
                onChange={e => setOrdenPrecio(e.target.value as 'asc' | 'desc' | '')}
                className="filter-select"
              >
                <option value="">Precio</option>
                <option value="asc">Menor a Mayor</option>
                <option value="desc">Mayor a Menor</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* ═══════ HERO ═══════ */}
      <div className="container">
        <motion.div
          className="hero"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            Tecnología de primer nivel
          </div>

          <h1 className="hero-title">
            Equipos para<br />
            <span className="highlight">profesionales</span>
          </h1>

          <p className="hero-subtitle">
            Laptops y accesorios de alta gama para quienes exigen rendimiento sin compromisos.
          </p>

          <button className="hero-cta" onClick={scrollToProductos}>
            Ver catálogo
            <ArrowDown size={16} className="hero-cta-arrow" />
          </button>

          {/* Trust badges */}
          <div className="hero-trust">
            <div className="trust-item">
              <div className="trust-icon"><Truck size={16} /></div>
              <div className="trust-text">
                <strong>Envío express</strong>
                <span>Entrega en 24–48h</span>
              </div>
            </div>
            <div className="trust-item">
              <div className="trust-icon"><Shield size={16} /></div>
              <div className="trust-text">
                <strong>Garantía oficial</strong>
                <span>1 año de cobertura</span>
              </div>
            </div>
            <div className="trust-item">
              <div className="trust-icon"><Package size={16} /></div>
              <div className="trust-text">
                <strong>+200 productos</strong>
                <span>Stock permanente</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══════ PRODUCTOS ═══════ */}
      <main className="container products-section" ref={productosRef}>
        {!loading && (
          <div className="section-header">
            <h2 className="section-title">Catálogo</h2>
            <span className="section-count">
              {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''}
            </span>

            {hayFiltrosActivos && (
              <div className="active-filters">
                {categoriaFiltro && (
                  <button className="active-filter-tag" onClick={() => setCategoriaFiltro('')}>
                    {categoriaFiltro} ×
                  </button>
                )}
                {busqueda && (
                  <button className="active-filter-tag" onClick={() => setBusqueda('')}>
                    "{busqueda}" ×
                  </button>
                )}
                {ordenPrecio && (
                  <button className="active-filter-tag" onClick={() => setOrdenPrecio('')}>
                    {ordenPrecio === 'asc' ? 'Precio ↑' : 'Precio ↓'} ×
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="products-grid">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="no-results">
            <div className="no-results-icon"><Search size={52} /></div>
            <h3>Sin resultados</h3>
            <p>No hay productos para "{busqueda || categoriaFiltro}"</p>
            <button className="btn-secondary" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="products-grid">
            {productosFiltrados.map((producto, index) => (
              <ProductCard
                key={producto.id}
                producto={producto}
                onAddToCart={agregarAlCarrito}
                index={index}
              />
            ))}
          </div>
        )}
      </main>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="store-footer">
        <div className="container footer-inner">
          <span className="footer-brand">Kratamex</span>
          <div className="footer-links">
            <Link to="/admin" className="footer-link">Admin</Link>
          </div>
          <span className="footer-copy">© {new Date().getFullYear()} · Todos los derechos reservados</span>
        </div>
      </footer>

      {/* ═══════ CART ═══════ */}
      <AnimatePresence>
        {carritoAbierto && (
          <motion.div
            className="cart-overlay"
            onClick={cerrarCarrito}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="cart-panel"
              onClick={e => e.stopPropagation()}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            >
              {/* Cart header */}
              <div className="cart-header">
                <div className="cart-header-left">
                  <h2>Tu Carrito</h2>
                  {cantidadItems > 0 && (
                    <span className="cart-header-count">{cantidadItems} item{cantidadItems !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <button className="cart-close-btn" onClick={cerrarCarrito}>
                  <X size={20} />
                </button>
              </div>

              {checkoutExitoso ? (
                <motion.div
                  className="success-message"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 18 }}
                >
                  <div className="success-icon-wrap">
                    <Check size={32} />
                  </div>
                  <h2 className="success-title">¡Pedido Realizado!</h2>
                  <p className="success-text">Gracias por tu compra. Te enviaremos un correo de confirmación en breve.</p>
                </motion.div>

              ) : carrito.length === 0 ? (
                <div className="empty-cart">
                  <div className="empty-cart-icon"><ShoppingCart size={52} /></div>
                  <h3>Carrito vacío</h3>
                  <p>Agrega productos para continuar</p>
                </div>

              ) : (
                <>
                  <div className="cart-items">
                    <AnimatePresence>
                      {carrito.map(item => (
                        <motion.div
                          key={item.id}
                          className="cart-item"
                          layout
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -16, height: 0, padding: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <BrandLogoSmall imagen={item.imagen} nombre={item.nombre} />
                          <div className="cart-item-info">
                            <div className="cart-item-name">{item.nombre}</div>
                            <div className="cart-item-subtotal">
                              <span className="cart-item-price">
                                ${(item.precio * item.cantidad).toFixed(2)}
                              </span>
                              {item.cantidad > 1 && (
                                <span className="cart-item-unit">${item.precio.toFixed(2)} c/u</span>
                              )}
                            </div>
                            <div className="cart-item-quantity">
                              <button className="qty-btn" onClick={() => actualizarCantidad(item.id, -1)}>
                                <Minus size={12} />
                              </button>
                              <span className="qty-num">{item.cantidad}</span>
                              <button className="qty-btn" onClick={() => actualizarCantidad(item.id, 1)}>
                                <Plus size={12} />
                              </button>
                              <button className="remove-btn" onClick={() => eliminarItem(item.id)} title="Eliminar">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <div className="cart-footer">
                    <div className="cart-total">
                      <span className="cart-total-label">Total</span>
                      <span className="cart-total-value">${totalCarrito.toFixed(2)}</span>
                    </div>
                    <p className="cart-total-items">
                      {cantidadItems} producto{cantidadItems !== 1 ? 's' : ''} · IVA incluido
                    </p>

                    <p className="checkout-form-label">Datos de envío</p>
                    <div className="checkout-form">
                      <input
                        type="text"
                        placeholder="Nombre completo"
                        className="form-input"
                        maxLength={200}
                        value={formulario.cliente}
                        onChange={e => setFormulario({ ...formulario, cliente: e.target.value })}
                      />
                      <input
                        type="email"
                        placeholder="Correo electrónico"
                        className="form-input"
                        maxLength={254}
                        value={formulario.email}
                        onChange={e => setFormulario({ ...formulario, email: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Dirección de envío"
                        className="form-input"
                        maxLength={500}
                        value={formulario.direccion}
                        onChange={e => setFormulario({ ...formulario, direccion: e.target.value })}
                      />
                      {formError && (
                        <p style={{ color: '#f87171', fontSize: '0.8rem', margin: '4px 0 0' }}>{formError}</p>
                      )}
                      <button
                        className="checkout-btn"
                        onClick={handleCheckout}
                        disabled={checkoutMutation.isPending}
                      >
                        {checkoutMutation.isPending ? 'Procesando...' : 'Confirmar pedido'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// =================================================================
// APP — carrito compartido entre páginas
// =================================================================
function App() {
  const [carrito, setCarrito] = useState<CarritoItem[]>([])
  const [carritoAbierto, setCarritoAbierto] = useState(false)

  const agregarAlCarrito = (producto: Producto) => {
    setCarrito(prev => {
      const existente = prev.find(item => item.id === producto.id)
      if (existente) return prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item)
      return [...prev, { ...producto, cantidad: 1 }]
    })
  }

  const cantidadItems = carrito.reduce((sum, item) => sum + item.cantidad, 0)

  return (
    <Routes>
      <Route path="/" element={
        <Tienda
          carritoExterno={carrito}
          setCarritoExterno={setCarrito}
          carritoAbiertoExterno={carritoAbierto}
          setCarritoAbiertoExterno={setCarritoAbierto}
        />
      } />
      <Route path="/producto/:id" element={
        <ProductoDetalle
          onAddToCart={agregarAlCarrito}
          carritoCount={cantidadItems}
          onOpenCart={() => setCarritoAbierto(true)}
        />
      } />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}

export default App
