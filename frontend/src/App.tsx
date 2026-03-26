/*
=================================================================
KRATAMEX - TIENDA ONLINE
=================================================================
React 19 + TypeScript + Framer Motion
=================================================================
*/

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Routes, Route, Link, useSearchParams, useNavigate, Navigate } from 'react-router-dom'
import { ShoppingCart, X, Plus, Minus, Check, Search, Package, Truck, Shield, ArrowDown, Trash2, ArrowUp, Heart, LayoutGrid, List, Sun, Moon, User, LogOut, ClipboardList } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import Admin from './components/Admin/Admin'
import SecurityDashboard from './components/SecurityDashboard'
import ForgotPassword from './components/ForgotPassword'
import ResetPassword from './components/ResetPassword'
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

function ToastContainer({ toasts }: Readonly<{ toasts: Toast[] }>) {
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
// ACTIVE FILTERS
// =================================================================
type OrdenPrecio = '' | 'asc' | 'desc'

interface ActiveFiltersProps {
  readonly categoriaFiltro: string
  readonly setCategoriaFiltro: (v: string) => void
  readonly busqueda: string
  readonly setBusqueda: (v: string) => void
  readonly ordenPrecio: string
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
// TIENDA PRODUCTS CONTENT
// =================================================================
const SKELETON_KEYS = ['skeleton-card-0', 'skeleton-card-1', 'skeleton-card-2', 'skeleton-card-3', 'skeleton-card-4', 'skeleton-card-5', 'skeleton-card-6', 'skeleton-card-7']

interface TiendaProductsContentProps {
  readonly loading: boolean
  readonly productosFiltrados: Producto[]
  readonly vistaLista: boolean
  readonly filtrarFavoritos: boolean
  readonly busqueda: string
  readonly categoriaFiltro: string
  readonly limpiarFiltros: () => void
  readonly wishlistExterno: number[]
  readonly onAddToCart: (p: Producto) => void
  readonly onToggleWishlist: (id: number) => void
}
function TiendaProductsContent({ loading, productosFiltrados, vistaLista, filtrarFavoritos, busqueda, categoriaFiltro, limpiarFiltros, wishlistExterno, onAddToCart, onToggleWishlist }: TiendaProductsContentProps) {
  if (loading) {
    return (
      <div className={vistaLista ? 'products-list' : 'products-grid'}>
        {SKELETON_KEYS.map((key) => <SkeletonCard key={key} />)}
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
          isWishlisted={wishlistExterno.includes(producto.id)} onToggleWishlist={onToggleWishlist} vistaLista={vistaLista} />
      ))}
    </div>
  )
}

// =================================================================
// CART PANEL
// =================================================================
interface CartPanelProps {
  readonly carrito: CarritoItem[]
  readonly cantidadItems: number
  readonly cuponDescuento: number
  readonly cuponCodigo: string
  readonly setCuponCodigo: (v: string) => void
  readonly cuponError: string
  readonly aplicarCupon: () => void
  readonly subtotalCarrito: number
  readonly envioCarrito: number
  readonly impuestosCarrito: number
  readonly totalCarrito: number
  readonly formulario: { cliente: string; email: string; direccion: string }
  readonly setFormulario: React.Dispatch<React.SetStateAction<{ cliente: string; email: string; direccion: string }>>
  readonly formError: string
  readonly handleCheckout: () => void
  readonly checkoutPending: boolean
  readonly actualizarCantidad: (id: number, delta: number) => void
  readonly setCantidad: (id: number, cantidad: number) => void
  readonly eliminarItem: (id: number) => void
  readonly onClose: () => void
}
function CartPanel({ carrito, cantidadItems, cuponDescuento, cuponCodigo, setCuponCodigo, cuponError, aplicarCupon, subtotalCarrito, envioCarrito, impuestosCarrito, totalCarrito, formulario, setFormulario, formError, handleCheckout, checkoutPending, actualizarCantidad, setCantidad, eliminarItem, onClose }: CartPanelProps) {
  return (
    <motion.div className="cart-panel" onClick={e => e.stopPropagation()}
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
      <div className="cart-header">
        <div className="cart-header-left">
          <h2>Tu Carrito</h2>
          {cantidadItems > 0 && <span className="cart-header-count">{cantidadItems} item{cantidadItems === 1 ? '' : 's'}</span>}
        </div>
        <button className="cart-close-btn" onClick={onClose}><X size={20} /></button>
      </div>
      {carrito.length === 0 ? (
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
                <motion.div key={item.id} className="cart-item" layout
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16, height: 0, padding: 0 }} transition={{ duration: 0.2 }}>
                  <BrandLogoSmall imagen={item.imagen} nombre={item.nombre} />
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.nombre}</div>
                    <div className="cart-item-subtotal">
                      <span className="cart-item-price">${(item.precio * item.cantidad).toFixed(2)}</span>
                      {item.cantidad > 1 && <span className="cart-item-unit">${item.precio.toFixed(2)} c/u</span>}
                    </div>
                    <div className="cart-item-quantity">
                      <button className="qty-btn" onClick={() => actualizarCantidad(item.id, -1)} disabled={item.cantidad <= 1}><Minus size={12} /></button>
                      <input key={`qty-${item.id}-${item.cantidad}`} type="number" className="qty-num"
                        defaultValue={item.cantidad} min={1} max={item.stock}
                        onBlur={e => { const val = Number.parseInt(e.target.value); if (!Number.isNaN(val) && val >= 1) setCantidad(item.id, val); else e.target.value = String(item.cantidad) }}
                        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
                      <button className="qty-btn" onClick={() => actualizarCantidad(item.id, 1)} disabled={item.cantidad >= item.stock}><Plus size={12} /></button>
                      <button className="remove-btn" onClick={() => eliminarItem(item.id)} title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="cart-footer">
            <div className="cart-summary">
              <div className="cart-summary-row"><span>Subtotal</span><span>€{subtotalCarrito.toFixed(2)}</span></div>
              {cuponDescuento > 0 && <div className="cart-summary-row" style={{ color: '#22c55e' }}><span>Descuento</span><span>-€{cuponDescuento.toFixed(2)}</span></div>}
              <div className="cart-summary-row"><span>IVA (21%)</span><span>€{impuestosCarrito.toFixed(2)}</span></div>
              <div className="cart-summary-row">
                <span>Envío</span>
                <span>{envioCarrito === 0 ? <span style={{ color: '#22c55e' }}>Gratis</span> : `€${envioCarrito.toFixed(2)}`}</span>
              </div>
              {subtotalCarrito < 100 && <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '2px 0 4px' }}>Envío gratis a partir de €100</p>}
            </div>
            <div className="cart-total">
              <span className="cart-total-label">Total</span>
              <span className="cart-total-value">€{totalCarrito.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', margin: '8px 0' }}>
              <input type="text" placeholder="Código de cupón" className="form-input"
                style={{ flex: 1, textTransform: 'uppercase' }} value={cuponCodigo}
                onChange={e => setCuponCodigo(e.target.value)} />
              <button className="btn-secondary" style={{ whiteSpace: 'nowrap', padding: '6px 12px', fontSize: '0.75rem' }} onClick={aplicarCupon}>Aplicar</button>
            </div>
            {cuponError && <p style={{ color: '#f87171', fontSize: '0.75rem', margin: '0 0 4px' }}>{cuponError}</p>}
            {cuponDescuento > 0 && <p style={{ color: '#22c55e', fontSize: '0.75rem', margin: '0 0 4px' }}>Cupón aplicado: -€{cuponDescuento.toFixed(2)}</p>}
            <p className="checkout-form-label">Datos de envío</p>
            <div className="checkout-form">
              <input type="text" placeholder="Nombre completo" className="form-input" maxLength={200}
                value={formulario.cliente} onChange={e => setFormulario({ ...formulario, cliente: e.target.value })} />
              <input type="email" placeholder="Correo electrónico" className="form-input" maxLength={254}
                value={formulario.email} onChange={e => setFormulario({ ...formulario, email: e.target.value })} />
              <input type="text" placeholder="Dirección de envío" className="form-input" maxLength={500}
                value={formulario.direccion} onChange={e => setFormulario({ ...formulario, direccion: e.target.value })} />
              {formError && <p style={{ color: '#f87171', fontSize: '0.8rem', margin: '4px 0 0' }}>{formError}</p>}
              <button className="checkout-btn" onClick={handleCheckout} disabled={checkoutPending}>
                {checkoutPending ? 'Procesando...' : 'Realizar pedido →'}
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
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
  authUser: Usuario | null
  onLogout: () => void
}

function Tienda({ carritoExterno, setCarritoExterno, carritoAbiertoExterno, setCarritoAbiertoExterno, wishlistExterno, onToggleWishlistExterno, tema, onToggleTema, authUser, onLogout }: Readonly<TiendaProps>) {
  const carrito = carritoExterno
  const setCarrito = setCarritoExterno
  const carritoAbierto = carritoAbiertoExterno
  const setCarritoAbierto = setCarritoAbiertoExterno

  const navigate = useNavigate()
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
  const [busquedaFocus, setBusquedaFocus] = useState(false)
  const [busquedaReciente, setBusquedaReciente] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('kratamex_searches') || '[]') } catch { return [] }
  })

  const productosRef = useRef<HTMLElement>(null)
  const [searchParams] = useSearchParams()
  const categoriaURL = searchParams.get('categoria') || ''

  useEffect(() => {
    const handleScroll = () => setShowBackTop(globalThis.scrollY > 420)
    globalThis.addEventListener('scroll', handleScroll, { passive: true })
    return () => globalThis.removeEventListener('scroll', handleScroll)
  }, [])

  // Escape cierra el carrito
  useEffect(() => {
    if (!carritoAbierto) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarCarrito() }
    globalThis.addEventListener('keydown', handleKey)
    return () => globalThis.removeEventListener('keydown', handleKey)
  }, [carritoAbierto])

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const addToast = (nombre: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, nombre }])
    setTimeout(() => removeToast(id), 2600)
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
      prev.map(item => item.id === id ? { ...item, cantidad: Math.max(1, Math.min(item.cantidad + delta, item.stock)) } : item)
    )
  }

  const setCantidad = (id: number, cantidad: number) => {
    setCarrito(prev =>
      prev.map(item => item.id === id ? { ...item, cantidad: Math.max(1, Math.min(cantidad, item.stock)) } : item)
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
      navigate('/mis-pedidos')
    },
    onError: (err: any) => setFormError(err.message),
  })

  const handleCheckout = () => {
    setFormError('')
    const result = CheckoutSchema.safeParse(formulario)
    if (!result.success) { setFormError(result.error.issues[0].message); return }
    checkoutMutation.mutate()
  }

  const cerrarCarrito = () => {
    setCarritoAbierto(false)
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

  const guardarBusqueda = (q: string) => {
    if (!q.trim()) return
    setBusquedaReciente(prev => {
      const next = [q, ...prev.filter(s => s !== q)].slice(0, 6)
      localStorage.setItem('kratamex_searches', JSON.stringify(next))
      return next
    })
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

          <div className="search-bar" style={{ position: 'relative' }}>
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="search-input"
              onFocus={() => setBusquedaFocus(true)}
              onBlur={() => setTimeout(() => setBusquedaFocus(false), 150)}
              onKeyDown={e => { if (e.key === 'Enter') guardarBusqueda(busqueda) }}
            />
            {busqueda && (
              <button className="search-clear" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda">
                <X size={14} />
              </button>
            )}
            {busquedaFocus && busquedaReciente.length > 0 && !busqueda && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 999, overflow: 'hidden', marginTop: 4 }}>
                <div style={{ padding: '8px 14px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Búsquedas recientes</div>
                {busquedaReciente.map(s => (
                  <button key={s} onClick={() => { setBusqueda(s); setBusquedaFocus(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 14, textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <Search size={12} style={{ opacity: 0.4, flexShrink: 0 }} /> {s}
                  </button>
                ))}
                <button onClick={() => { setBusquedaReciente([]); localStorage.removeItem('kratamex_searches') }}
                  style={{ width: '100%', padding: '6px 14px', background: 'none', border: 'none', borderTop: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>
                  Limpiar historial
                </button>
              </div>
            )}
          </div>

          <button className="theme-toggle-btn" onClick={onToggleTema} title={tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
            {tema === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {authUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Link to="/mis-pedidos" className="theme-toggle-btn" title="Mis pedidos"><ClipboardList size={16} /></Link>
              <Link to="/perfil" className="theme-toggle-btn" title="Mi perfil"><User size={16} /></Link>
              <button className="theme-toggle-btn" onClick={onLogout} title="Cerrar sesión"><LogOut size={16} /></button>
            </div>
          ) : (
            <Link to="/login" className="theme-toggle-btn" title="Iniciar sesión" style={{ textDecoration: 'none' }}>
              <User size={16} />
            </Link>
          )}

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
                  className={`view-toggle-btn ${vistaLista ? '' : 'active'}`}
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
            <span className="hero-eyebrow-dot" />{' '}
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
              {productosFiltrados.length} producto{productosFiltrados.length === 1 ? '' : 's'}
            </span>

            {hayFiltrosActivos && (
              <ActiveFilters
                categoriaFiltro={categoriaFiltro} setCategoriaFiltro={setCategoriaFiltro}
                busqueda={busqueda} setBusqueda={setBusqueda}
                ordenPrecio={ordenPrecio} setOrdenPrecio={setOrdenPrecio}
                filtrarFavoritos={filtrarFavoritos} setFiltrarFavoritos={setFiltrarFavoritos}
                precioMin={precioMin} setPrecioMin={setPrecioMin}
                precioMax={precioMax} setPrecioMax={setPrecioMax}
              />
            )}
          </div>
        )}

        <TiendaProductsContent
          loading={loading} productosFiltrados={productosFiltrados} vistaLista={vistaLista}
          filtrarFavoritos={filtrarFavoritos} busqueda={busqueda} categoriaFiltro={categoriaFiltro}
          limpiarFiltros={limpiarFiltros} wishlistExterno={wishlistExterno}
          onAddToCart={agregarAlCarrito} onToggleWishlist={onToggleWishlistExterno}
        />
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
          <motion.div className="cart-overlay" onClick={cerrarCarrito}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}>
            <CartPanel
              carrito={carrito} cantidadItems={cantidadItems}
              cuponDescuento={cuponDescuento} cuponCodigo={cuponCodigo} setCuponCodigo={setCuponCodigo}
              cuponError={cuponError} aplicarCupon={aplicarCupon}
              subtotalCarrito={subtotalCarrito} envioCarrito={envioCarrito}
              impuestosCarrito={impuestosCarrito} totalCarrito={totalCarrito}
              formulario={formulario} setFormulario={setFormulario}
              formError={formError} handleCheckout={handleCheckout}
              checkoutPending={checkoutMutation.isPending}
              actualizarCantidad={actualizarCantidad} setCantidad={setCantidad}
              eliminarItem={eliminarItem} onClose={cerrarCarrito}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ BACK TO TOP ═══════ */}
      <AnimatePresence>
        {showBackTop && (
          <motion.button
            className="back-to-top"
            onClick={() => globalThis.scrollTo({ top: 0, behavior: 'smooth' })}
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
  const [authUser, setAuthUser] = useState<Usuario | null>(null)

  // Validar sesión guardada contra el backend al arrancar
  useEffect(() => {
    const token = localStorage.getItem('kratamex_token')
    const saved = localStorage.getItem('kratamex_user')
    if (!token || !saved) return
    fetch('/api/usuario', { headers: { Authorization: token } }).then(r => {
      if (r.ok) {
        try { setAuthUser(JSON.parse(saved)) } catch {}
      } else {
        localStorage.removeItem('kratamex_token')
        localStorage.removeItem('kratamex_user')
      }
    }).catch(() => {
      // Sin conexión — restaurar sesión localmente para no romper UX offline
      try { setAuthUser(JSON.parse(saved)) } catch {}
    })
  }, [])

  useEffect(() => {
    document.documentElement.dataset['tema'] = tema
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
          authUser={authUser}
          onLogout={handleLogout}
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
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/panel" element={<SecurityDashboard />} />
      <Route path="*" element={
        <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 40 }}>
          <div style={{ fontSize: 96, fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>404</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Página no encontrada</h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 400, margin: 0 }}>
            La página que buscas no existe o fue movida.
          </p>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: 'var(--accent)', color: '#fff', borderRadius: 10, fontWeight: 600, textDecoration: 'none' }}>
            ← Volver a la tienda
          </Link>
        </div>
      } />
    </Routes>
    </>
  )
}

export default App
