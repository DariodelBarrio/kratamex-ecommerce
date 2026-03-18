/* 
=================================================================
KRATAMEX - TIENDA ONLINE
=================================================================
Este archivo contiene toda la lógica de la tienda online.
Está escrito en React + TypeScript.

Estructura:
1. Funciones auxiliares (sanitize)
2. Tipos de datos (interfaces)
3. Componente Tienda (página principal)
4. Componente Admin (panel de administración)
5. Componente App (router principal)
=================================================================
*/

import { useState, useEffect, useMemo } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { ShoppingCart, X, Plus, Minus, Check, Search, SlidersHorizontal } from 'lucide-react'
import Admin from './components/Admin/Admin';
import { OptimizedImage } from './components/OptimizedImage';
import { Producto, CarritoItem } from './interfaces';
import { sanitize } from './utils';

// =================================================================
// COMPONENTE: TIENDA (PÁGINA PRINCIPAL)
// =================================================================
// Este componente muestra la tienda con productos, búsqueda y carrito
function Tienda() {
  // ----- ESTADOS (variables internas del componente) -----
  // useState crea una variable que cambia y reactualiza la pantalla
  
  // Lista de productos que vienen del backend/API
  const [productos, setProductos] = useState<Producto[]>([])
  
  // Carrito de compras: array de productos seleccionados
  const [carrito, setCarrito] = useState<CarritoItem[]>([])
  
  // Estado del carrito (abierto/cerrado)
  const [carritoAbierto, setCarritoAbierto] = useState(false)
  
  // Si el checkout (compra) fue exitoso
  const [checkoutExitoso, setCheckoutExitoso] = useState(false)
  
  // Texto de búsqueda del usuario
  const [busqueda, setBusqueda] = useState('')
  
  // Categoría seleccionada para filtrar
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  
  // Orden de precio (ascendente o descendente)
  const [ordenPrecio, setOrdenPrecio] = useState<'asc' | 'desc' | ''>('')
  
  // Indicador de carga (muestra "Cargando..." mientras obtiene datos)
  const [loading, setLoading] = useState(true)
  
  // Datos del formulario de compra (checkout)
  const [formulario, setFormulario] = useState({
    cliente: '',      // Nombre del cliente
    email: '',        // Correo electrónico
    direccion: ''     // Dirección de envío
  })

  // =================================================================
  // EFECTO: CARGAR PRODUCTOS
  // =================================================================
  // useEffect se ejecuta cuando cambia algo (aquí: búsqueda, filtro u orden)
  // Esto hace que la tienda busque productos en el backend cada vez que el usuario filtre
  useEffect(() => {
    setLoading(true)  // Mostrar indicador de carga
    
    // Construir parámetros para la URL de la API
    const params = new URLSearchParams()
    if (busqueda) params.append('busqueda', busqueda)        // Agregar búsqueda
    if (categoriaFiltro) params.append('categoria', categoriaFiltro)  // Agregar categoría
    if (ordenPrecio) params.append('orden', ordenPrecio)      // Agregar orden
    
    // Llamar al backend para obtener productos filtrados
    fetch(`http://localhost:3001/api/productos?${params}`)
      .then(res => res.json())  // Convertir respuesta a JSON
      .then(data => {
        setProductos(data)      // Guardar productos полученные del backend
        setLoading(false)       // Ocultar indicador de carga
      })
      .catch(err => {
        console.error('Error cargando productos:', err)
        setLoading(false)
      })
  }, [busqueda, categoriaFiltro, ordenPrecio])  // Se ejecuta cuando cambia cualquiera de estos

  // =================================================================
  // MEMO: OBTENER CATEGORÍAS ÚNICAS
  // =================================================================
  // useMemo calcula valores derivados (para no recalcular en cada render)
  // Extrae categorías únicas de los productos (sin duplicados)
  const categorias = useMemo(() => {
    const cats = new Set(productos.map(p => p.categoria).filter(Boolean))
    return Array.from(cats)
  }, [productos])

  // Los productos ya vienen filtrados del backend, solo los asignamos
  const productosFiltrados = productos

  // =================================================================
  // FUNCIÓN: AGREGAR AL CARRITO
  // =================================================================
  // Añade un producto al carrito o increase la cantidad si ya existe
  const agregarAlCarrito = (producto: Producto) => {
    setCarrito(prev => {
      // Buscar si el producto ya está en el carrito
      const existente = prev.find(item => item.id === producto.id)
      if (existente) {
        // Si ya existe, increase la cantidad
        return prev.map(item =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      }
      // Si no existe, agregarlo con cantidad 1
      return [...prev, { ...producto, cantidad: 1 }]
    })
  }

  // =================================================================
  // FUNCIÓN: ACTUALIZAR CANTIDAD
  // =================================================================
  // Increase o decrease la cantidad de un producto en el carrito
  const actualizarCantidad = (id: number, delta: number) => {
    setCarrito(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, cantidad: Math.max(1, item.cantidad + delta) }  // Mínimo 1
          : item
      )
    )
  }

  // =================================================================
  // FUNCIÓN: ELIMINAR DEL CARRITO
  // =================================================================
  // Quita un producto completamente del carrito
  const eliminarItem = (id: number) => {
    setCarrito(prev => prev.filter(item => item.id !== id))
  }

  // =================================================================
  // CÁLCULO: TOTAL DEL CARRITO
  // =================================================================
  // Suma el precio de todos los items multiplicado por su cantidad
  const totalCarrito = carrito.reduce(
    (sum, item) => sum + item.precio * item.cantidad,
    0
  )

  // =================================================================
  // CÁLCULO: CANTIDAD TOTAL DE ITEMS
  // =================================================================
  // Suma todas las cantidades de productos en el carrito
  const cantidadItems = carrito.reduce((sum, item) => sum + item.cantidad, 0)

  // =================================================================
  // FUNCIÓN: PROCESAR COMPRA (CHECKOUT)
  // =================================================================
  // Envía el pedido al backend cuando el usuario completa el formulario
  const handleCheckout = async () => {
    // Validar que todos los campos estén llenos
    if (!formulario.cliente || !formulario.email || !formulario.direccion) {
      alert('Por favor completa todos los campos')
      return
    }

    try {
      // Enviar pedido al backend
      await fetch('http://localhost:3001/api/pedidos', {
        method: 'POST',  // Método HTTP para crear datos
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formulario,  // Datos del cliente
          items: carrito.map(item => ({
            id: item.id,
            cantidad: item.cantidad,
            precio: item.precio
          }))
        })
      })
      // Limpiar carrito y mostrar mensaje de éxito
      setCarrito([])
      setCheckoutExitoso(true)
    } catch (err) {
      console.error('Error al procesar pedido:', err)
      alert('Error al procesar el pedido')
    }
  }

  // =================================================================
  // FUNCIÓN: CERRAR CARRITO
  // =================================================================
  // Cierra el panel del carrito
  const cerrarCarrito = () => {
    setCarritoAbierto(false)
    // Resetear mensaje de éxito después de 300ms (para animación)
    setTimeout(() => setCheckoutExitoso(false), 300)
  }

  // =================================================================
  // RENDER: INTERFAZ DE LA TIENDA
  // =================================================================
  return (
    <>
      {/* ----- HEADER (CABECERA) ----- */}
      <header>
        <div className="container header-content">
          {/* Logo que lleva al inicio */}
          <Link to="/" className="logo">Kratamex</Link>
          
          {/* Barra de búsqueda */}
          <div className="search-bar">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}  // Actualiza el estado de búsqueda
              className="search-input"
            />
          </div>

          {/* Botón del carrito */}
          <button className="cart-btn" onClick={() => setCarritoAbierto(true)}>
            <ShoppingCart size={20} />
            Carrito
            {/* Badge con cantidad si hay productos */}
            {cantidadItems > 0 && (
              <span className="cart-badge">{cantidadItems}</span>
            )}
          </button>
        </div>
        
        {/* ----- BARRA DE FILTROS ----- */}
        <div className="container filters-bar">
          <div className="filters">
            <SlidersHorizontal size={16} />
            
            {/* Dropdown para filtrar por categoría */}
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
            
            {/* Dropdown para ordenar por precio */}
            <select 
              value={ordenPrecio} 
              onChange={e => setOrdenPrecio(e.target.value as 'asc' | 'desc' | '')}
              className="filter-select"
            >
              <option value="">Ordenar por...</option>
              <option value="asc">Precio: Menor a Mayor</option>
              <option value="desc">Precio: Mayor a Menor</option>
            </select>
          </div>
          
          {/* Contador de resultados */}
          <span className="results-count">
            {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* ----- MAIN (CONTENIDO PRINCIPAL) ----- */}
      <main className="container">
        {/* Estado: Cargando */}
        {loading ? (
          <div className="loading">Cargando productos...</div>
        ) : productosFiltrados.length === 0 ? (
          /* Estado: Sin resultados */
          <div className="no-results">
            <Search size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p>No se encontraron productos</p>
            {/* Botón para limpiar filtros si hay búsqueda activa */}
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
          /* Estado: Mostrar productos */
          <div className="products-grid">
            {productosFiltrados.map(producto => (
              <div key={producto.id} className="product-card">
                {/* Imagen del producto */}
                <OptimizedImage
                  src={sanitize(producto.imagen)}
                  alt={sanitize(producto.nombre)}
                  className="product-image"
                />
                <div className="product-info">
                  <div className="product-category">{sanitize(producto.categoria)}</div>
                  <h3 className="product-name">{sanitize(producto.nombre)}</h3>
                  <p className="product-description">{sanitize(producto.descripcion)}</p>
                  <div className="product-price">${producto.precio.toFixed(2)}</div>
                  <button
                    className="add-to-cart"
                    onClick={() => agregarAlCarrito(producto)}
                  >
                    Agregar al Carrito
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ----- MODAL: CARRITO ----- */}
      {carritoAbierto && (
        <div className="cart-overlay" onClick={cerrarCarrito}>
          {/* Panel lateral del carrito */}
          <div className="cart-panel" onClick={e => e.stopPropagation()}>
            <div className="cart-header">
              <h2>Tu Carrito</h2>
              <button onClick={cerrarCarrito} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            {/* Estado: Compra exitosa */}
            {checkoutExitoso ? (
              <div className="success-message">
                <Check size={64} className="success-icon" />
                <h2 className="success-title">¡Pedido Realizado!</h2>
                <p className="success-text">Gracias por tu compra. Te enviaremos un correo de confirmación.</p>
              </div>
            ) : carrito.length === 0 ? (
              /* Estado: Carrito vacío */
              <div className="empty-cart">
                <ShoppingCart size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                <p>Tu carrito está vacío</p>
              </div>
            ) : (
              <>
                {/* Lista de productos en el carrito */}
                <div className="cart-items">
                  {carrito.map(item => (
                    <div key={item.id} className="cart-item">
                      <OptimizedImage src={sanitize(item.imagen)} alt={sanitize(item.nombre)} className="cart-item-image" />
                      <div className="cart-item-info">
                        <div className="cart-item-name">{sanitize(item.nombre)}</div>
                        <div className="cart-item-price">${item.precio.toFixed(2)}</div>
                        <div className="cart-item-quantity">
                          {/* Botones para decrease/cantidad */}
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
                    </div>
                  ))}
                </div>

                {/* Footer con total y formulario de compra */}
                <div className="cart-footer">
                  <div className="cart-total">
                    <span>Total:</span>
                    <span>${totalCarrito.toFixed(2)}</span>
                  </div>

                  {/* Formulario de checkout */}
                  <div className="checkout-form">
                    <input
                      type="text"
                      placeholder="Nombre completo"
                      className="form-input"
                      value={formulario.cliente}
                      onChange={e => setFormulario({ ...formulario, cliente: e.target.value })}
                    />
                    <input
                      type="email"
                      placeholder="Correo electrónico"
                      className="form-input"
                      value={formulario.email}
                      onChange={e => setFormulario({ ...formulario, email: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="Dirección de envío"
                      className="form-input"
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
          </div>
        </div>
      )}
    </>
  )
}



// =================================================================
// COMPONENTE: APP (ROUTER PRINCIPAL)
// =================================================================
// Define las rutas de la aplicación
function App() {
  return (
    <Routes>
      {/* Ruta principal: página de la tienda */}
      <Route path="/" element={<Tienda />} />
      {/* Ruta del admin: panel de administración */}
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}

// Exportar el componente principal
export default App
