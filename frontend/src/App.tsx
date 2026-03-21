/*
=================================================================
KRATAMEX - TIENDA ONLINE
=================================================================
React 19 + TypeScript + Framer Motion
=================================================================
*/

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Routes, Route, Link, useSearchParams, useNavigate, Navigate } from 'react-router-dom'
import { ShoppingCart, X, Plus, Minus, Check, Search, Package, Truck, Shield, ArrowDown, Trash2, ArrowUp, Heart, LayoutGrid, List, Sun, Moon, User, LogOut, ClipboardList, Globe } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import Admin from './components/Admin/Admin'
import SecurityDashboard from './components/SecurityDashboard'
import { ProductCard, BrandLogoSmall } from './components/ProductCard'
import { SkeletonCard } from './components/SkeletonCard'
import { SecurityBadge } from './components/SecurityBadge'
import ProductoDetalle from './components/ProductoDetalle'
import { SplashScreen } from './components/SplashScreen'
import { ParticleCanvas } from './components/ParticleCanvas'
import Auth from './components/Auth'
import OrderHistory from './components/OrderHistory'
import UserProfile from './components/UserProfile'
import type { Producto, CarritoItem, Usuario } from './interfaces'
import * as api from './api'
import { t, getLang, setLang } from './i18n'

// =================================================================
// ZOD — Validación de formulario de checkout
// =================================================================
const CheckoutSchema = z.object({
  cliente:   z.string().min(1, 'Nombre requerido').max(200),
  email:     z.string().email('Email inválido').max(254),
  direccion: z.string().min(1, 'Dirección requerida').max(500),
})

// =================================================================
// TOAST
// =================================================================
interface Toast { id: number; nombre: string }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            className="toast"
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
// TIENDA
// =================================================================
interface TiendaProps {
  carritoExterno: CarritoItem[]
  setCarritoExterno: React.Dispatch<React.SetStateAction<CarritoItem[]>>
  carritoAbiertoExterno: boolean
  setCarritoAbiertoExterno: (v: boolean) => void
  wishlistExterno: number[]
  onToggleWishlistExterno: (id: number) => void
  tema: 'dark' | 'light'
  onToggleTema: () => void
}

function Tienda({ carritoExterno, setCarritoExterno, carritoAbiertoExterno, setCarritoAbiertoExterno, wishlistExterno, onToggleWishlistExterno, tema, onToggleTema }: TiendaProps) {
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
  const [vistaLista, setVistaLista] = useState(false)
  const [filtrarFavoritos, setFiltrarFavoritos] = useState(false)
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [showBackTop, setShowBackTop] = useState(false)
  const [cuponCodigo, setCuponCodigo] = useState('')
  const [cuponDescuento, setCuponDescuento] = useState(0)
  const [cuponError, setCuponError] = useState('')
  const [filtroEnStock, setFiltroEnStock] = useState(false)

  const productosRef = useRef<HTMLElement>(null)
  const [searchParams] = useSearchParams()
  const categoriaURL = searchParams.get('categoria') || ''

  useEffect(() => {
    const handleScroll = () => setShowBackTop(window.scrollY > 420)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Escape cierra el carrito
  useEffect(() => {
    if (!carritoAbierto) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarCarrito() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [carritoAbierto])

  const addToast = (nombre: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, nombre }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2600)
  }

  // TanStack Query — carga de productos
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

  // Filtros cliente (favoritos + rango de precio)
  const productosFiltrados = useMemo(() => {
    let result = productos
    if (filtrarFavoritos) result = result.filter(p => wishlistExterno.includes(p.id))
    if (precioMin !== '') result = result.filter(p => p.precio >= Number(precioMin))
    if (precioMax !== '') result = result.filter(p => p.precio <= Number(precioMax))
    return result
  }, [productos, filtrarFavoritos, wishlistExterno, precioMin, precioMax])

  // Carrito
  const agregarAlCarrito = (producto: Producto) => {
    setCarrito(prev => {
      const existente = prev.find(item => item.id === producto.id)
      if (existente) return prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item)
      return [...prev, { ...producto, cantidad: 1 }]
    })
    addToast(producto.nombre)
  }

  const actualizarCantidad = (id: number, delta: number) => {
    setCarrito(prev =>
      prev.map(item => item.id === id ? { ...item, cantidad: Math.max(1, item.cantidad + delta) } : item)
    )
  }

  const eliminarItem = (id: number) => setCarrito(prev => prev.filter(item => item.id !== id))

  const subtotalCarrito = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
  const envioCarrito = subtotalCarrito >= 100 ? 0 : 5.99
  const impuestosCarrito = Math.round(subtotalCarrito * 0.21 * 100) / 100
  const totalCarrito = Math.round((subtotalCarrito - cuponDescuento + impuestosCarrito + envioCarrito) * 100) / 100
  const cantidadItems = carrito.reduce((sum, item) => sum + item.cantidad, 0)

  const aplicarCupon = async () => {
    setCuponError('')
    if (!cuponCodigo.trim()) return
    try {
      const res = await api.validarCupon(cuponCodigo, subtotalCarrito)
      setCuponDescuento(res.descuento)
    } catch (err: any) {
      setCuponError(err.message)
      setCuponDescuento(0)
    }
  }

  // TanStack Query — mutación de checkout
  const checkoutMutation = useMutation({
    mutationFn: (data: typeof formulario) =>
      api.postPedido({
        ...data,
        items: carrito.map(item => ({ id: item.id, cantidad: item.cantidad })),
        cupon: cuponCodigo || undefined,
      }),
    onSuccess: () => {
      setCarrito([])
      setCheckoutExitoso(true)
      setFormError('')
      setCuponCodigo('')
      setCuponDescuento(0)
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

  const limpiarFiltros = () => {
    setBusqueda('')
    setCategoriaFiltro('')
    setOrdenPrecio('')
    setFiltrarFavoritos(false)
    setPrecioMin('')
    setPrecioMax('')
  }

  const hayFiltrosActivos = busqueda || categoriaFiltro || ordenPrecio || filtrarFavoritos || precioMin || precioMax

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

          <button className="theme-toggle-btn" onClick={onToggleTema} title={tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
            {tema === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {(() => {
            const user = (() => { try { return JSON.parse(localStorage.getItem('kratamex_user') || 'null') } catch { return null } })()
            return user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Link to="/mis-pedidos" className="theme-toggle-btn" title="Mis pedidos"><ClipboardList size={16} /></Link>
                <Link to="/perfil" className="theme-toggle-btn" title="Mi perfil"><User size={16} /></Link>
              </div>
            ) : (
              <Link to="/login" className="theme-toggle-btn" title="Iniciar sesión" style={{ textDecoration: 'none' }}>
                <User size={16} />
              </Link>
            )
          })()}

          <button className="cart-btn" onClick={() => setCarritoAbierto(true)}>
            <ShoppingCart size={17} />
            Carrito
            <AnimatePresence mode="wait">
              {cantidadItems > 0 && (
                <motion.span
                  key={cantidadItems}
                  className="cart-badge"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                >
                  {cantidadItems}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Category pills + filters */}
        <div className="container">
          <div className="category-nav">
            <button
              className={`category-pill ${!categoriaFiltro && !filtrarFavoritos ? 'active' : ''}`}
              onClick={() => { setCategoriaFiltro(''); setFiltrarFavoritos(false) }}
            >
              Todos
              {!loading && <span className="category-pill-count">{productos.length}</span>}
            </button>

            {categoriasConConteo.map(([cat, count]) => (
              <button
                key={cat}
                className={`category-pill ${categoriaFiltro === cat ? 'active' : ''}`}
                onClick={() => { setCategoriaFiltro(prev => prev === cat ? '' : cat); setFiltrarFavoritos(false) }}
              >
                {cat}
                <span className="category-pill-count">{count}</span>
              </button>
            ))}

            <button
              className={`category-pill category-pill--heart ${filtrarFavoritos ? 'active' : ''}`}
              onClick={() => { setFiltrarFavoritos(p => !p); setCategoriaFiltro('') }}
            >
              <Heart size={12} fill={filtrarFavoritos ? 'currentColor' : 'none'} />
              Favoritos
              {wishlistExterno.length > 0 && (
                <span className="category-pill-count">{wishlistExterno.length}</span>
              )}
            </button>

            <div className="filters-right">
              <div className="price-range">
                <input
                  type="number"
                  placeholder="Min $"
                  className="price-input"
                  value={precioMin}
                  onChange={e => setPrecioMin(e.target.value)}
                  min={0}
                />
                <span className="price-range-sep">–</span>
                <input
                  type="number"
                  placeholder="Max $"
                  className="price-input"
                  value={precioMax}
                  onChange={e => setPrecioMax(e.target.value)}
                  min={0}
                />
              </div>

              <select
                value={ordenPrecio}
                onChange={e => setOrdenPrecio(e.target.value as 'asc' | 'desc' | '')}
                className="filter-select"
              >
                <option value="">Precio</option>
                <option value="asc">Menor a Mayor</option>
                <option value="desc">Mayor a Menor</option>
              </select>

              <div className="view-toggle">
                <button
                  className={`view-toggle-btn ${!vistaLista ? 'active' : ''}`}
                  onClick={() => setVistaLista(false)}
                  title="Vista cuadrícula"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  className={`view-toggle-btn ${vistaLista ? 'active' : ''}`}
                  onClick={() => setVistaLista(true)}
                  title="Vista lista"
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ═══════ HERO ═══════ */}
      <div className="container">
        <motion.div
          className="hero"
          style={{ position: 'relative' }}

          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <ParticleCanvas />
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
                {filtrarFavoritos && (
                  <button className="active-filter-tag" onClick={() => setFiltrarFavoritos(false)}>
                    Favoritos ×
                  </button>
                )}
                {(precioMin || precioMax) && (
                  <button className="active-filter-tag" onClick={() => { setPrecioMin(''); setPrecioMax('') }}>
                    {precioMin ? `$${precioMin}` : ''}
                    {precioMin && precioMax ? ' – ' : ''}
                    {precioMax ? `$${precioMax}` : ''} ×
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className={vistaLista ? 'products-list' : 'products-grid'}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="no-results">
            <div className="no-results-icon">
              {filtrarFavoritos ? <Heart size={52} /> : <Search size={52} />}
            </div>
            <h3>{filtrarFavoritos ? 'Sin favoritos aún' : 'Sin resultados'}</h3>
            <p>
              {filtrarFavoritos
                ? 'Guarda productos con el corazón para verlos aquí'
                : `No hay productos para "${busqueda || categoriaFiltro}"`}
            </p>
            <button className="btn-secondary" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className={vistaLista ? 'products-list' : 'products-grid'}>
            {productosFiltrados.map((producto, index) => (
              <ProductCard
                key={producto.id}
                producto={producto}
                onAddToCart={agregarAlCarrito}
                index={index}
                isWishlisted={wishlistExterno.includes(producto.id)}
                onToggleWishlist={onToggleWishlistExterno}
                vistaLista={vistaLista}
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
                    <div className="cart-summary">
                      <div className="cart-summary-row">
                        <span>Subtotal</span>
                        <span>€{subtotalCarrito.toFixed(2)}</span>
                      </div>
                      {cuponDescuento > 0 && (
                        <div className="cart-summary-row" style={{ color: '#22c55e' }}>
                          <span>Descuento</span>
                          <span>-€{cuponDescuento.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="cart-summary-row">
                        <span>IVA (21%)</span>
                        <span>€{impuestosCarrito.toFixed(2)}</span>
                      </div>
                      <div className="cart-summary-row">
                        <span>Envío</span>
                        <span>{envioCarrito === 0 ? <span style={{ color: '#22c55e' }}>Gratis</span> : `€${envioCarrito.toFixed(2)}`}</span>
                      </div>
                      {subtotalCarrito < 100 && (
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '2px 0 4px' }}>
                          Envío gratis a partir de €100
                        </p>
                      )}
                    </div>
                    <div className="cart-total">
                      <span className="cart-total-label">Total</span>
                      <span className="cart-total-value">€{totalCarrito.toFixed(2)}</span>
                    </div>

                    {/* Cupón */}
                    <div style={{ display: 'flex', gap: '6px', margin: '8px 0' }}>
                      <input
                        type="text"
                        placeholder="Código de cupón"
                        className="form-input"
                        style={{ flex: 1, textTransform: 'uppercase' }}
                        value={cuponCodigo}
                        onChange={e => setCuponCodigo(e.target.value)}
                      />
                      <button className="btn-secondary" style={{ whiteSpace: 'nowrap', padding: '6px 12px', fontSize: '0.75rem' }} onClick={aplicarCupon}>
                        Aplicar
                      </button>
                    </div>
                    {cuponError && <p style={{ color: '#f87171', fontSize: '0.75rem', margin: '0 0 4px' }}>{cuponError}</p>}
                    {cuponDescuento > 0 && <p style={{ color: '#22c55e', fontSize: '0.75rem', margin: '0 0 4px' }}>Cupón aplicado: -€{cuponDescuento.toFixed(2)}</p>}

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

      {/* ═══════ BACK TO TOP ═══════ */}
      <AnimatePresence>
        {showBackTop && (
          <motion.button
            className="back-to-top"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Volver arriba"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.2 }}
          >
            <ArrowUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ═══════ TOASTS ═══════ */}
      <ToastContainer toasts={toasts} />
    </>
  )
}

// =================================================================
// APP — carrito compartido entre páginas + auth
// =================================================================
function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [tema, setTema] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('kratamex_tema') as 'dark' | 'light') || 'dark'
  )
  const [authUser, setAuthUser] = useState<Usuario | null>(() => {
    try {
      const saved = localStorage.getItem('kratamex_user')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [lang, setLangState] = useState(getLang())

  useEffect(() => {
    document.documentElement.setAttribute('data-tema', tema)
    localStorage.setItem('kratamex_tema', tema)
  }, [tema])

  const toggleTema = () => setTema(t => t === 'dark' ? 'light' : 'dark')

  const handleAuth = useCallback((data: { token: string; user: any }) => {
    localStorage.setItem('kratamex_token', data.token)
    localStorage.setItem('kratamex_user', JSON.stringify(data.user))
    setAuthUser(data.user)
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('kratamex_token')
    localStorage.removeItem('kratamex_user')
    setAuthUser(null)
    fetch('/api/logout', { method: 'POST', headers: { Authorization: localStorage.getItem('kratamex_token') || '' } })
  }, [])

  const handleLangChange = useCallback((newLang: 'es' | 'en') => {
    setLang(newLang)
    setLangState(newLang)
  }, [])

  const [carrito, setCarrito] = useState<CarritoItem[]>(() => {
    try {
      const saved = localStorage.getItem('kratamex_cart')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const [wishlist, setWishlist] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('kratamex_wishlist')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem('kratamex_cart', JSON.stringify(carrito))
  }, [carrito])

  useEffect(() => {
    localStorage.setItem('kratamex_wishlist', JSON.stringify(wishlist))
  }, [wishlist])

  const toggleWishlist = (id: number) => {
    setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    // Sync with server if logged in
    if (authUser) {
      const isFav = wishlist.includes(id)
      if (isFav) api.removeFavorito(id).catch(() => {})
      else api.addFavorito(id).catch(() => {})
    }
  }

  const agregarAlCarrito = (producto: Producto) => {
    setCarrito(prev => {
      const existente = prev.find(item => item.id === producto.id)
      if (existente) return prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item)
      return [...prev, { ...producto, cantidad: 1 }]
    })
  }

  const cantidadItems = carrito.reduce((sum, item) => sum + item.cantidad, 0)

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen key="splash" onDone={() => setShowSplash(false)} />}
      </AnimatePresence>

    <Routes>
      <Route path="/" element={
        <Tienda
          carritoExterno={carrito}
          setCarritoExterno={setCarrito}
          carritoAbiertoExterno={carritoAbierto}
          setCarritoAbiertoExterno={setCarritoAbierto}
          wishlistExterno={wishlist}
          onToggleWishlistExterno={toggleWishlist}
          tema={tema}
          onToggleTema={toggleTema}
        />
      } />
      <Route path="/producto/:id" element={
        <ProductoDetalle
          onAddToCart={agregarAlCarrito}
          carritoCount={cantidadItems}
          onOpenCart={() => setCarritoAbierto(true)}
        />
      } />
      <Route path="/login" element={
        authUser ? <Navigate to="/" /> : <Auth onAuth={handleAuth} defaultMode="login" />
      } />
      <Route path="/registro" element={
        authUser ? <Navigate to="/" /> : <Auth onAuth={handleAuth} defaultMode="register" />
      } />
      <Route path="/mis-pedidos" element={
        authUser ? <OrderHistory /> : <Navigate to="/login" />
      } />
      <Route path="/perfil" element={
        authUser ? <UserProfile user={authUser} /> : <Navigate to="/login" />
      } />
      <Route path="/admin" element={<Admin />} />
      <Route path="/panel" element={<SecurityDashboard />} />
    </Routes>
    </>
  )
}

export default App
