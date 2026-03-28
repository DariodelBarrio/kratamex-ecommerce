/*
=================================================================
KRATAMEX - TIENDA ONLINE
=================================================================
React 19 + TypeScript + Framer Motion
=================================================================
*/

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Routes, Route, useSearchParams, useNavigate, Navigate } from 'react-router-dom'
import { Check, Search, Heart, ArrowUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import Admin from './components/Admin/Admin'
import SecurityDashboard from './components/SecurityDashboard'
import ForgotPassword from './components/ForgotPassword'
import ResetPassword from './components/ResetPassword'
import { ProductCard } from './components/ProductCard'
import { BrandCarousel } from './components/BrandCarousel'
import { SkeletonCard } from './components/SkeletonCard'
import ProductoDetalle from './components/ProductoDetalle'
import { SplashScreen } from './components/SplashScreen'
import Auth from './components/Auth'
import OrderHistory from './components/OrderHistory'
import UserProfile from './components/UserProfile'
import { StoreHeader } from './components/StoreHeader'
import { StoreHero } from './components/StoreHero'
import { StoreFooter } from './components/StoreFooter'
import { CartPanel } from './components/CartPanel'
import NotFound from './components/NotFound'
import { useFiltros } from './hooks/useFiltros'
import { useToasts } from './hooks/useToasts'
import type { OrdenPrecio } from './hooks/useFiltros'
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
// ACTIVE FILTERS — chips de filtros activos
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
// CATALOG CONTENT — grid/lista de productos con skeleton y vacíos
// =================================================================
const SKELETON_KEYS = ['s0','s1','s2','s3','s4','s5','s6','s7']

interface CatalogContentProps {
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

function CatalogContent({ loading, productosFiltrados, vistaLista, filtrarFavoritos, busqueda, categoriaFiltro, limpiarFiltros, wishlistExterno, onAddToCart, onToggleWishlist }: CatalogContentProps) {
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
          isWishlisted={wishlistExterno.includes(producto.id)} onToggleWishlist={onToggleWishlist} vistaLista={vistaLista} />
      ))}
    </div>
  )
}

// =================================================================
// TIENDA — página principal
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
  const navigate = useNavigate()
  const productosRef = useRef<HTMLElement>(null)
  const [searchParams] = useSearchParams()
  const categoriaURL = searchParams.get('categoria') || ''

  // ── Hooks extraídos ──
  const filtros = useFiltros()
  const { toasts, addToast } = useToasts()

  // ── Estado local ──
  const [vistaLista, setVistaLista] = useState(false)
  const [showBackTop, setShowBackTop] = useState(false)
  const [cuponCodigo, setCuponCodigo] = useState('')
  const [cuponDescuento, setCuponDescuento] = useState(0)
  const [cuponError, setCuponError] = useState('')
  const [formulario, setFormulario] = useState({ cliente: '', email: '', direccion: '' })
  const [formError, setFormError] = useState('')

  useEffect(() => {
    const fn = () => setShowBackTop(globalThis.scrollY > 420)
    globalThis.addEventListener('scroll', fn, { passive: true })
    return () => globalThis.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    if (!carritoAbiertoExterno) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setCarritoAbiertoExterno(false) }
    globalThis.addEventListener('keydown', fn)
    return () => globalThis.removeEventListener('keydown', fn)
  }, [carritoAbiertoExterno])

  // ── Datos ──
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
    if (filtros.filtrarFavoritos) result = result.filter(p => wishlistExterno.includes(p.id))
    if (filtros.precioMin !== '') result = result.filter(p => p.precio >= Number(filtros.precioMin))
    if (filtros.precioMax !== '') result = result.filter(p => p.precio <= Number(filtros.precioMax))
    return result
  }, [productos, filtros.filtrarFavoritos, wishlistExterno, filtros.precioMin, filtros.precioMax])

  // ── Carrito ──
  const agregarAlCarrito = (producto: Producto) => {
    setCarritoExterno(prev => {
      const existente = prev.find(item => item.id === producto.id)
      if (existente) return prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item)
      return [...prev, { ...producto, cantidad: 1 }]
    })
    addToast(producto.nombre)
  }

  const actualizarCantidad = (id: number, delta: number) => {
    setCarritoExterno(prev =>
      prev.map(item => item.id === id ? { ...item, cantidad: Math.max(1, Math.min(item.cantidad + delta, item.stock)) } : item)
    )
  }

  const setCantidad = (id: number, cantidad: number) => {
    setCarritoExterno(prev =>
      prev.map(item => item.id === id ? { ...item, cantidad: Math.max(1, Math.min(cantidad, item.stock)) } : item)
    )
  }

  const eliminarItem = (id: number) => setCarritoExterno(prev => prev.filter(item => item.id !== id))

  const subtotalCarrito = carritoExterno.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
  const envioCarrito    = subtotalCarrito >= 100 ? 0 : 5.99
  const impuestosCarrito = Math.round(subtotalCarrito * 0.21 * 100) / 100
  const totalCarrito    = Math.round((subtotalCarrito - cuponDescuento + impuestosCarrito + envioCarrito) * 100) / 100
  const cantidadItems   = carritoExterno.reduce((sum, item) => sum + item.cantidad, 0)

  // ── Cupón / checkout ──
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
      items: carritoExterno.map(item => ({ id: item.id, cantidad: item.cantidad })),
      cupon: cuponCodigo || undefined,
    }),
    onSuccess: () => {
      setCarritoExterno([])
      setCuponCodigo('')
      setCuponDescuento(0)
      setCarritoAbiertoExterno(false)
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

  return (
    <>
      <StoreHeader
        busqueda={filtros.busqueda}           setBusqueda={v => filtros.setBusqueda(v)}
        tema={tema}                            onToggleTema={onToggleTema}
        authUser={authUser}                    onLogout={onLogout}
        cantidadItems={cantidadItems}          onOpenCart={() => setCarritoAbiertoExterno(true)}
        productos={productos}                  loading={loading}
        categoriaFiltro={filtros.categoriaFiltro} setCategoriaFiltro={v => filtros.setCategoriaFiltro(v)}
        filtrarFavoritos={filtros.filtrarFavoritos} setFiltrarFavoritos={v => filtros.setFiltrarFavoritos(v)}
        wishlistCount={wishlistExterno.length}
        categoriasConConteo={categoriasConConteo}
        precioMin={filtros.precioMin}         setPrecioMin={v => filtros.setPrecioMin(v)}
        precioMax={filtros.precioMax}         setPrecioMax={v => filtros.setPrecioMax(v)}
        ordenPrecio={filtros.ordenPrecio}     setOrdenPrecio={v => filtros.setOrdenPrecio(v)}
        vistaLista={vistaLista}               setVistaLista={setVistaLista}
      />

      <StoreHero onScrollToProductos={() => productosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />

      <BrandCarousel />

      <main className="container products-section" ref={productosRef}>
        {!loading && (
          <div className="section-header">
            <h2 className="section-title">Catálogo</h2>
            <span className="section-count">{productosFiltrados.length} producto{productosFiltrados.length === 1 ? '' : 's'}</span>
            {filtros.hayFiltrosActivos && (
              <ActiveFilters
                categoriaFiltro={filtros.categoriaFiltro} setCategoriaFiltro={v => filtros.setCategoriaFiltro(v)}
                busqueda={filtros.busqueda}               setBusqueda={v => filtros.setBusqueda(v)}
                ordenPrecio={filtros.ordenPrecio}         setOrdenPrecio={v => filtros.setOrdenPrecio(v)}
                filtrarFavoritos={filtros.filtrarFavoritos} setFiltrarFavoritos={v => filtros.setFiltrarFavoritos(v)}
                precioMin={filtros.precioMin}             setPrecioMin={v => filtros.setPrecioMin(v)}
                precioMax={filtros.precioMax}             setPrecioMax={v => filtros.setPrecioMax(v)}
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
          wishlistExterno={wishlistExterno}
          onAddToCart={agregarAlCarrito}
          onToggleWishlist={onToggleWishlistExterno}
        />
      </main>

      <StoreFooter />

      {/* ── Carrito ── */}
      <AnimatePresence>
        {carritoAbiertoExterno && (
          <motion.div className="cart-overlay" onClick={() => setCarritoAbiertoExterno(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <CartPanel
              carrito={carritoExterno}          cantidadItems={cantidadItems}
              cuponDescuento={cuponDescuento}   cuponCodigo={cuponCodigo}     setCuponCodigo={setCuponCodigo}
              cuponError={cuponError}            aplicarCupon={aplicarCupon}
              subtotalCarrito={subtotalCarrito}  envioCarrito={envioCarrito}
              impuestosCarrito={impuestosCarrito} totalCarrito={totalCarrito}
              formulario={formulario}            setFormulario={setFormulario}
              formError={formError}              handleCheckout={handleCheckout}
              checkoutPending={checkoutMutation.isPending}
              actualizarCantidad={actualizarCantidad} setCantidad={setCantidad}
              eliminarItem={eliminarItem}        onClose={() => setCarritoAbiertoExterno(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Back to top ── */}
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
    </>
  )
}

// =================================================================
// APP — estado global compartido + router
// =================================================================
function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [tema, setTema] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('kratamex_tema') as 'dark' | 'light') || 'dark'
  )
  const [authUser, setAuthUser] = useState<Usuario | null>(null)
  const [carrito, setCarrito] = useState<CarritoItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('kratamex_cart') || '[]') } catch { return [] }
  })
  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const [wishlist, setWishlist] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('kratamex_wishlist') || '[]') } catch { return [] }
  })

  useEffect(() => {
    const token = localStorage.getItem('kratamex_token')
    const saved = localStorage.getItem('kratamex_user')
    if (!token || !saved) return
    fetch('/api/usuario', { headers: { Authorization: token } }).then(r => {
      if (r.ok) { try { setAuthUser(JSON.parse(saved)) } catch {} }
      else { localStorage.removeItem('kratamex_token'); localStorage.removeItem('kratamex_user') }
    }).catch(() => { try { setAuthUser(JSON.parse(saved)) } catch {} })
  }, [])

  useEffect(() => { document.documentElement.dataset['tema'] = tema; localStorage.setItem('kratamex_tema', tema) }, [tema])
  useEffect(() => { localStorage.setItem('kratamex_cart', JSON.stringify(carrito)) }, [carrito])
  useEffect(() => { localStorage.setItem('kratamex_wishlist', JSON.stringify(wishlist)) }, [wishlist])

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

  const toggleWishlist = (id: number) => {
    setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    if (authUser) {
      const isFav = wishlist.includes(id)
      if (isFav) api.removeFavorito(id).catch(() => {})
      else api.addFavorito(id).catch(() => {})
    }
  }

  const agregarAlCarrito = (producto: Producto) => {
    setCarrito(prev => {
      const ex = prev.find(item => item.id === producto.id)
      if (ex) return prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item)
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
            carritoExterno={carrito}           setCarritoExterno={setCarrito}
            carritoAbiertoExterno={carritoAbierto} setCarritoAbiertoExterno={setCarritoAbierto}
            wishlistExterno={wishlist}         onToggleWishlistExterno={toggleWishlist}
            tema={tema}                        onToggleTema={() => setTema(t => t === 'dark' ? 'light' : 'dark')}
            authUser={authUser}                onLogout={handleLogout}
          />
        } />
        <Route path="/producto/:id" element={
          <ProductoDetalle onAddToCart={agregarAlCarrito} carritoCount={cantidadItems} onOpenCart={() => setCarritoAbierto(true)} />
        } />
        <Route path="/login"    element={authUser ? <Navigate to="/" /> : <Auth onAuth={handleAuth} defaultMode="login" />} />
        <Route path="/registro" element={authUser ? <Navigate to="/" /> : <Auth onAuth={handleAuth} defaultMode="register" />} />
        <Route path="/mis-pedidos" element={authUser ? <OrderHistory /> : <Navigate to="/login" />} />
        <Route path="/perfil"   element={authUser ? <UserProfile user={authUser} /> : <Navigate to="/login" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/admin"  element={<Admin />} />
        <Route path="/panel"  element={<SecurityDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

export default App
