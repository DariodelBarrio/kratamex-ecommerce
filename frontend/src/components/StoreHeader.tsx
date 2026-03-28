import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, X, Search, Sun, Moon, User, LogOut, ClipboardList, Heart, LayoutGrid, List } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SecurityBadge } from './SecurityBadge'
import type { Producto, Usuario } from '../interfaces'
import type { OrdenPrecio } from '../hooks/useFiltros'

interface StoreHeaderProps {
  readonly busqueda: string
  readonly setBusqueda: (v: string) => void
  readonly tema: 'dark' | 'light'
  readonly onToggleTema: () => void
  readonly authUser: Usuario | null
  readonly onLogout: () => void
  readonly cantidadItems: number
  readonly onOpenCart: () => void
  readonly productos: Producto[]
  readonly loading: boolean
  readonly categoriaFiltro: string
  readonly setCategoriaFiltro: (v: string) => void
  readonly filtrarFavoritos: boolean
  readonly setFiltrarFavoritos: (v: boolean) => void
  readonly wishlistCount: number
  readonly categoriasConConteo: [string, number][]
  readonly precioMin: string
  readonly setPrecioMin: (v: string) => void
  readonly precioMax: string
  readonly setPrecioMax: (v: string) => void
  readonly ordenPrecio: OrdenPrecio
  readonly setOrdenPrecio: (v: OrdenPrecio) => void
  readonly vistaLista: boolean
  readonly setVistaLista: (v: boolean) => void
}

export function StoreHeader({
  busqueda, setBusqueda,
  tema, onToggleTema,
  authUser, onLogout,
  cantidadItems, onOpenCart,
  productos, loading,
  categoriaFiltro, setCategoriaFiltro,
  filtrarFavoritos, setFiltrarFavoritos,
  wishlistCount,
  categoriasConConteo,
  precioMin, setPrecioMin,
  precioMax, setPrecioMax,
  ordenPrecio, setOrdenPrecio,
  vistaLista, setVistaLista,
}: StoreHeaderProps) {
  const [busquedaFocus, setBusquedaFocus] = useState(false)
  const [busquedaReciente, setBusquedaReciente] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('kratamex_searches') || '[]') } catch { return [] }
  })

  const guardarBusqueda = (q: string) => {
    if (!q.trim()) return
    setBusquedaReciente(prev => {
      const next = [q, ...prev.filter(s => s !== q)].slice(0, 6)
      localStorage.setItem('kratamex_searches', JSON.stringify(next))
      return next
    })
  }

  return (
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

        <button className="cart-btn" onClick={onOpenCart}>
          <ShoppingCart size={17} />
          <span className="cart-btn-text">Carrito</span>
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

      {/* ── Category pills + filters ── */}
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
              onClick={() => { setCategoriaFiltro(categoriaFiltro === cat ? '' : cat); setFiltrarFavoritos(false) }}
            >
              {cat}
              <span className="category-pill-count">{count}</span>
            </button>
          ))}

          <button
            className={`category-pill category-pill--heart ${filtrarFavoritos ? 'active' : ''}`}
            onClick={() => { setFiltrarFavoritos(!filtrarFavoritos); setCategoriaFiltro('') }}
          >
            <Heart size={12} fill={filtrarFavoritos ? 'currentColor' : 'none'} />
            Favoritos
            {wishlistCount > 0 && <span className="category-pill-count">{wishlistCount}</span>}
          </button>

          <div className="filters-right">
            <div className="price-range">
              <input type="number" placeholder="Min $" className="price-input"
                value={precioMin} onChange={e => setPrecioMin(e.target.value)} min={0} />
              <span className="price-range-sep">–</span>
              <input type="number" placeholder="Max $" className="price-input"
                value={precioMax} onChange={e => setPrecioMax(e.target.value)} min={0} />
            </div>

            <select value={ordenPrecio} onChange={e => setOrdenPrecio(e.target.value as OrdenPrecio)} className="filter-select">
              <option value="">Precio</option>
              <option value="asc">Menor a Mayor</option>
              <option value="desc">Mayor a Menor</option>
            </select>

            <div className="view-toggle">
              <button className={`view-toggle-btn ${vistaLista ? '' : 'active'}`} onClick={() => setVistaLista(false)} title="Vista cuadrícula">
                <LayoutGrid size={14} />
              </button>
              <button className={`view-toggle-btn ${vistaLista ? 'active' : ''}`} onClick={() => setVistaLista(true)} title="Vista lista">
                <List size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
