import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Minus, Trash2, ShoppingCart } from 'lucide-react'
import { BrandLogoSmall } from './ProductCard'
import type { CarritoItem } from '../interfaces'

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

export function CartPanel({ carrito, cantidadItems, cuponDescuento, cuponCodigo, setCuponCodigo, cuponError, aplicarCupon, subtotalCarrito, envioCarrito, impuestosCarrito, totalCarrito, formulario, setFormulario, formError, handleCheckout, checkoutPending, actualizarCantidad, setCantidad, eliminarItem, onClose }: CartPanelProps) {
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
                value={formulario.cliente} onChange={e => setFormulario(f => ({ ...f, cliente: e.target.value }))} />
              <input type="email" placeholder="Correo electrónico" className="form-input" maxLength={254}
                value={formulario.email} onChange={e => setFormulario(f => ({ ...f, email: e.target.value }))} />
              <input type="text" placeholder="Dirección de envío" className="form-input" maxLength={500}
                value={formulario.direccion} onChange={e => setFormulario(f => ({ ...f, direccion: e.target.value }))} />
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
