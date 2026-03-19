/*
=================================================================
KRATAMEX - TIENDA ONLINE
=================================================================
React 19 + TypeScript — Bento Grid + Glassmorphism + Framer Motion
=================================================================
*/

import { useState, useEffect, useMemo } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { ShoppingCart, X, Plus, Minus, Check, Search, SlidersHorizontal } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Admin from './components/Admin/Admin'
import { ProductCard, BrandLogoSmall } from './components/ProductCard'
import { SkeletonCard } from './components/SkeletonCard'
import { SecurityBadge } from './components/SecurityBadge'
import { Producto, CarritoItem } from './interfaces'

// =================================================================
// COMPONENTE: TIENDA (PÁGINA PRINCIPAL)
// =================================================================
function Tienda() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<CarritoItem[]>([])
  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const [checkoutExitoso, setCheckoutExitoso] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [ordenPrecio, setOrdenPrecio] = useState<'asc' | 'desc' | ''>('')
  const [loading, setLoading] = useState(true)
  const [formulario, setFormulario] = useState({
    cliente: '',
    email: '',
    direccion: ''
  })

  // =================================================================
  // EFECTO: CARGAR PRODUCTOS
  // =================================================================
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (busqueda) params.append('busqueda', busqueda)
    if (categoriaFiltro) params.append('categoria', categoriaFiltro)
    if (ordenPrecio) params.append('orden', ordenPrecio)

    fetch(`/api/productos?${params}`)
      .then(res => res.json())
      .then(data => {
        setProductos(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error cargando productos:', err)
        setLoading(false)
      })
  }, [busqueda, categoriaFiltro, ordenPrecio])

  // Categorías únicas
  const categorias = useMemo(() => {
    const cats = new Set(productos.map(p => p.categoria).filter(Boolean))
    return Array.from(cats)
  }, [productos])

  const productosFiltrados = productos

  // =================================================================
  // FUNCIONES DEL CARRITO
  // =================================================================
  const agregarAlCarrito = (producto: Producto) => {
    setCarrito(prev => {
      const existente = prev.find(item => item.id === producto.id)
      if (existente) {
        return prev.map(item =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      }
      return [...prev, { ...producto, cantidad: 1 }]
    })
  }

  const actualizarCantidad = (id: number, delta: number) => {
    setCarrito(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, cantidad: Math.max(1, item.cantidad + delta) }
          : item
      )
    )
  }

  const eliminarItem = (id: number) => {
    setCarrito(prev => prev.filter(item => item.id !== id))
  }

  const totalCarrito = carrito.reduce(
    (sum, item) => sum + item.precio * item.cantidad, 0
  )

  const cantidadItems = carrito.reduce((sum, item) => sum + item.cantidad, 0)

  const handleCheckout = async () => {
    if (!formulario.cliente || !formulario.email || !formulario.direccion) {
      alert('Por favor completa todos los campos')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formulario.email)) {
      alert('Por favor ingresa un email válido')
      return
    }
    if (formulario.cliente.length > 200 || formulario.direccion.length > 500) {
      alert('Los datos ingresados son demasiado largos')
      return
    }
    try {
      await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formulario,
          items: carrito.map(item => ({
            id: item.id,
            cantidad: item.cantidad,
            precio: item.precio
          }))
        })
      })
      setCarrito([])
      setCheckoutExitoso(true)
    } catch (err) {
      console.error('Error al procesar pedido:', err)
      alert('Error al procesar el pedido')
    }
  }

  const cerrarCarrito = () => {
    setCarritoAbierto(false)
    setTimeout(() => setCheckoutExitoso(false), 300)
  }

  // =================================================================
  // RENDER
  // =================================================================
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
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="search-input"
            />
          </div>

          <button className="cart-btn" onClick={() => setCarritoAbierto(true)}>
            <ShoppingCart size={18} />
            Carrito
            {cantidadItems > 0 && (
              <span className="cart-badge">{cantidadItems}</span>
            )}
          </button>
        </div>

        {/* Filters */}
        <div className="container filters-bar">
          <div className="filters">
            <SlidersHorizontal size={14} />
            <select
              value={categoriaFiltro}
              onChange={e => setCategoriaFiltro(e.target.value)}
              className="filter-select"
            >
              <option value="">Todas las categorías</option>
              {categorias.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={ordenPrecio}
              onChange={e => setOrdenPrecio(e.target.value as 'asc' | 'desc' | '')}
              className="filter-select"
            >
              <option value="">Ordenar por precio</option>
              <option value="asc">Menor a Mayor</option>
              <option value="desc">Mayor a Menor</option>
            </select>
          </div>
          {!loading && (
            <span className="results-count">
              {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      {/* ═══════ HERO ═══════ */}
      <div className="container">
        <motion.div
          className="hero"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="hero-eyebrow">
            ✦ Tecnología de primer nivel
          </div>
          <h1 className="hero-title">
            Equipos para<br />
            <span className="highlight">profesionales</span>
          </h1>
          <p className="hero-subtitle">
            Laptops y accesorios de alta gama para quienes exigen rendimiento sin compromisos.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-value">+200</div>
              <div className="hero-stat-label">Productos</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">24h</div>
              <div className="hero-stat-label">Envío express</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">100%</div>
              <div className="hero-stat-label">Garantía oficial</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══════ MAIN ═══════ */}
      <main className="container products-section">
        {!loading && (
          <div className="section-header">
            <h2 className="section-title">
              Catálogo
              {!busqueda && !categoriaFiltro && (
                <span>{productosFiltrados.length} productos</span>
              )}
            </h2>
          </div>
        )}

        {loading ? (
          <div className="products-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="no-results">
            <Search size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <p style={{ fontWeight: 600, marginBottom: 6 }}>Sin resultados</p>
            <p style={{ fontSize: '0.875rem' }}>Intenta con otros términos de búsqueda</p>
            {(busqueda || categoriaFiltro) && (
              <button
                className="btn-secondary"
                onClick={() => { setBusqueda(''); setCategoriaFiltro(''); setOrdenPrecio('') }}
              >
                Limpiar filtros
              </button>
            )}
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
          <span className="footer-copy">© {new Date().getFullYear()} · Todos los derechos reservados</span>
        </div>
      </footer>

      {/* ═══════ CART OVERLAY ═══════ */}
      <AnimatePresence>
        {carritoAbierto && (
          <motion.div
            className="cart-overlay"
            onClick={cerrarCarrito}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="cart-panel"
              onClick={e => e.stopPropagation()}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <div className="cart-header">
                <h2>Tu Carrito</h2>
                <button className="cart-close-btn" onClick={cerrarCarrito}>
                  <X size={24} />
                </button>
              </div>

              {checkoutExitoso ? (
                <motion.div
                  className="success-message"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                >
                  <Check size={64} className="success-icon" />
                  <h2 className="success-title">¡Pedido Realizado!</h2>
                  <p className="success-text">Gracias por tu compra. Te enviaremos un correo de confirmación.</p>
                </motion.div>
              ) : carrito.length === 0 ? (
                <div className="empty-cart">
                  <ShoppingCart size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                  <p>Tu carrito está vacío</p>
                </div>
              ) : (
                <>
                  <div className="cart-items">
                    {carrito.map(item => (
                      <motion.div
                        key={item.id}
                        className="cart-item"
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <BrandLogoSmall imagen={item.imagen} nombre={item.nombre} />
                        <div className="cart-item-info">
                          <div className="cart-item-name">{item.nombre}</div>
                          <div className="cart-item-price">${item.precio.toFixed(2)}</div>
                          <div className="cart-item-quantity">
                            <button className="qty-btn" onClick={() => actualizarCantidad(item.id, -1)}>
                              <Minus size={14} />
                            </button>
                            <span>{item.cantidad}</span>
                            <button className="qty-btn" onClick={() => actualizarCantidad(item.id, 1)}>
                              <Plus size={14} />
                            </button>
                            <button className="remove-btn" onClick={() => eliminarItem(item.id)}>
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="cart-footer">
                    <div className="cart-total">
                      <span>Total</span>
                      <span className="cart-total-value">${totalCarrito.toFixed(2)}</span>
                    </div>
                    <p className="checkout-form-title">Datos de envío</p>
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
                      <button className="checkout-btn" onClick={handleCheckout}>
                        Realizar Pedido
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
// APP (ROUTER)
// =================================================================
function App() {
  return (
    <Routes>
      <Route path="/" element={<Tienda />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}

export default App
