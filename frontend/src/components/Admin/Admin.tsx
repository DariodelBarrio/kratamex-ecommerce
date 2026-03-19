import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, Package, TrendingUp, LayoutDashboard, Trash2, ShoppingBag, DollarSign, Users } from 'lucide-react';
import styles from './Admin.module.css';
import { Producto } from '../../interfaces';
import { sanitize } from '../../utils';

function Admin() {
  const [autenticado, setAutenticado] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [token, setToken] = useState('');
  const [vista, setVista] = useState<'dashboard' | 'productos' | 'pedidos'>('dashboard');
  const [editando, setEditando] = useState<Producto | null>(null);
  const [formProducto, setFormProducto] = useState({
    nombre: '', descripcion: '', precio: '', imagen: '', categoria: '',
  });

  const verificarPassword = async () => {
    if (!username || !password) { setError('Usuario y contraseña son requeridos'); return; }
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (response.ok) {
        const data = await response.json();
        setAutenticado(true);
        setToken(data.token);
        setError('');
      } else {
        const data = await response.json();
        setError(data.error || 'Credenciales incorrectas');
      }
    } catch {
      setError('Error al conectar con el servidor');
    }
  };

  if (!autenticado) {
    return (
      <div className={styles['login-container']}>
        <div className={styles['login-box']}>
          <Lock size={48} className={styles['login-icon']} />
          <h2>Acceso Administrador</h2>
          <p>Ingresa tus credenciales para continuar</p>
          <div className={styles['login-form']}>
            <div className={styles['input-group']}>
              <label className={styles['input-label']}>Usuario</label>
              <input type="text" placeholder="Nombre de usuario" className={styles['form-input']}
                value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verificarPassword()} />
            </div>
            <div className={styles['input-group']}>
              <label className={styles['input-label']}>Contraseña</label>
              <div className={styles['password-input-wrapper']}>
                <input type={mostrarPassword ? 'text' : 'password'} placeholder="••••••••"
                  className={styles['form-input']} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && verificarPassword()} />
                <button type="button" className={styles['toggle-password']}
                  onClick={() => setMostrarPassword(!mostrarPassword)}>
                  {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {error && <p className={styles['login-error']}>{error}</p>}
            <button className={styles['login-btn']} onClick={verificarPassword}>Iniciar Sesión</button>
          </div>
          <Link to="/" className={styles['back-link']}>← Volver a la tienda</Link>
        </div>
      </div>
    );
  }

  return <AdminPanel token={token} productos={productos} setProductos={setProductos}
    pedidos={pedidos} setPedidos={setPedidos} vista={vista} setVista={setVista}
    editando={editando} setEditando={setEditando} formProducto={formProducto}
    setFormProducto={setFormProducto}
    onLogout={async () => {
      await fetch('/api/logout', { method: 'POST', headers: { 'Authorization': token } });
      setAutenticado(false); setUsername(''); setPassword(''); setToken('');
    }} />;
}

function AdminPanel({ token, productos, setProductos, pedidos, setPedidos, vista, setVista,
  editando, setEditando, formProducto, setFormProducto, onLogout }: any) {

  useEffect(() => { cargarDatos(); }, [token]);

  const cargarDatos = () => {
    fetch('/api/productos').then(r => r.json()).then(setProductos).catch(console.error);
    fetch('/api/admin/pedidos', { headers: { 'Authorization': token } })
      .then(r => r.json()).then(setPedidos).catch(console.error);
  };

  const eliminarPedido = async (id: number) => {
    if (!confirm('¿Eliminar este pedido?')) return;
    await fetch(`/api/admin/pedidos/${id}`, { method: 'DELETE', headers: { 'Authorization': token } });
    cargarDatos();
  };

  const guardarProducto = async () => {
    if (!formProducto.nombre || !formProducto.precio) { alert('Nombre y precio son requeridos'); return; }
    const data = { ...formProducto, precio: parseFloat(formProducto.precio) };
    const url = editando ? `/api/productos/${editando.id}` : '/api/productos';
    const method = editando ? 'PUT' : 'POST';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    setFormProducto({ nombre: '', descripcion: '', precio: '', imagen: '', categoria: '' });
    setEditando(null);
    cargarDatos();
  };

  const eliminarProducto = async (id: number) => {
    if (!confirm('¿Eliminar producto?')) return;
    await fetch(`/api/productos/${id}`, { method: 'DELETE' });
    cargarDatos();
  };

  const totalVentas = pedidos.reduce((s: number, p: any) => s + p.total, 0);
  const ticketMedio = pedidos.length > 0 ? totalVentas / pedidos.length : 0;
  const pedidosRecientes = [...pedidos].sort((a, b) =>
    new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  return (
    <div className={styles['admin-container']}>
      <header className={styles['admin-header']}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <h1 style={{ color: '#fff' }}>Panel de Administración</h1>
            <Link to="/" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={18} /> Ver Tienda
            </Link>
          </div>
          <button className={styles['logout-btn']} onClick={onLogout}>
            <Lock size={18} /> Cerrar Sesión
          </button>
        </div>
      </header>

      <div className="container" style={{ padding: '24px 20px' }}>
        {/* Tabs */}
        <div className={styles['admin-tabs']}>
          <button className={`${styles['tab-btn']} ${vista === 'dashboard' ? styles.active : ''}`}
            onClick={() => setVista('dashboard')}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button className={`${styles['tab-btn']} ${vista === 'productos' ? styles.active : ''}`}
            onClick={() => setVista('productos')}>
            <Package size={18} /> Productos
          </button>
          <button className={`${styles['tab-btn']} ${vista === 'pedidos' ? styles.active : ''}`}
            onClick={() => setVista('pedidos')}>
            <TrendingUp size={18} /> Pedidos
          </button>
        </div>

        {/* DASHBOARD */}
        {vista === 'dashboard' && (
          <div>
            {/* Métricas */}
            <div className={styles['admin-stats']}>
              <div className={styles['stat-card']}>
                <ShoppingBag size={28} style={{ color: '#2563eb' }} />
                <div>
                  <div className={styles['stat-value']}>{pedidos.length}</div>
                  <div className={styles['stat-label']}>Total Pedidos</div>
                </div>
              </div>
              <div className={styles['stat-card']}>
                <DollarSign size={28} style={{ color: '#10b981' }} />
                <div>
                  <div className={styles['stat-value']}>${totalVentas.toFixed(2)}</div>
                  <div className={styles['stat-label']}>Ingresos Totales</div>
                </div>
              </div>
              <div className={styles['stat-card']}>
                <TrendingUp size={28} style={{ color: '#f59e0b' }} />
                <div>
                  <div className={styles['stat-value']}>${ticketMedio.toFixed(2)}</div>
                  <div className={styles['stat-label']}>Ticket Medio</div>
                </div>
              </div>
              <div className={styles['stat-card']}>
                <Users size={28} style={{ color: '#8b5cf6' }} />
                <div>
                  <div className={styles['stat-value']}>{new Set(pedidos.map((p: any) => p.email)).size}</div>
                  <div className={styles['stat-label']}>Clientes Únicos</div>
                </div>
              </div>
              <div className={styles['stat-card']}>
                <Package size={28} style={{ color: '#64748b' }} />
                <div>
                  <div className={styles['stat-value']}>{productos.length}</div>
                  <div className={styles['stat-label']}>Productos en Catálogo</div>
                </div>
              </div>
            </div>

            {/* Tabla de compras */}
            <div className={styles['admin-section']}>
              <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>
                Compras de Clientes ({pedidos.length})
              </h3>
              {pedidos.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '40px' }}>
                  No hay pedidos todavía
                </p>
              ) : (
                <div className={styles['admin-table']}>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Cliente</th>
                        <th>Email</th>
                        <th>Dirección</th>
                        <th>Total</th>
                        <th>Fecha</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidosRecientes.map((p: any) => (
                        <tr key={p.id}>
                          <td><span className={styles['order-id']}>#{p.id}</span></td>
                          <td style={{ fontWeight: 500 }}>{sanitize(p.cliente)}</td>
                          <td style={{ color: 'var(--text-light)' }}>{sanitize(p.email)}</td>
                          <td style={{ color: 'var(--text-light)', maxWidth: '180px' }}>{sanitize(p.direccion)}</td>
                          <td><span className={styles['order-total']}>${p.total.toFixed(2)}</span></td>
                          <td style={{ color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                            {new Date(p.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td>
                            <button className={styles['btn-delete']} onClick={() => eliminarPedido(p.id)}
                              title="Eliminar pedido">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PRODUCTOS */}
        {vista === 'productos' && (
          <div className={styles['admin-section']}>
            <div className={styles['admin-form']}>
              <h3>{editando ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <div className={styles['form-grid']}>
                <input type="text" placeholder="Nombre" className={styles['form-input']}
                  value={formProducto.nombre} onChange={e => setFormProducto({ ...formProducto, nombre: e.target.value })} />
                <input type="text" placeholder="Descripción" className={styles['form-input']}
                  value={formProducto.descripcion} onChange={e => setFormProducto({ ...formProducto, descripcion: e.target.value })} />
                <input type="number" placeholder="Precio" className={styles['form-input']}
                  value={formProducto.precio} onChange={e => setFormProducto({ ...formProducto, precio: e.target.value })} />
                <input type="text" placeholder="URL Imagen" className={styles['form-input']}
                  value={formProducto.imagen} onChange={e => setFormProducto({ ...formProducto, imagen: e.target.value })} />
                <input type="text" placeholder="Categoría" className={styles['form-input']}
                  value={formProducto.categoria} onChange={e => setFormProducto({ ...formProducto, categoria: e.target.value })} />
              </div>
              <div className={styles['form-actions']}>
                <button className={styles['btn-primary']} onClick={guardarProducto}>
                  {editando ? 'Actualizar' : 'Crear'}
                </button>
                {editando && (
                  <button className={styles['btn-secondary']} onClick={() => {
                    setEditando(null);
                    setFormProducto({ nombre: '', descripcion: '', precio: '', imagen: '', categoria: '' });
                  }}>Cancelar</button>
                )}
              </div>
            </div>
            <div className={styles['admin-table']}>
              <table>
                <thead>
                  <tr><th>ID</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {productos.map((p: Producto) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{sanitize(p.nombre)}</td>
                      <td>{sanitize(p.categoria)}</td>
                      <td>${p.precio.toFixed(2)}</td>
                      <td>
                        <button className={styles['btn-edit']} onClick={() => {
                          setEditando(p);
                          setFormProducto({ nombre: p.nombre, descripcion: p.descripcion, precio: p.precio.toString(), imagen: p.imagen, categoria: p.categoria });
                        }}>Editar</button>
                        <button className={styles['btn-delete']} onClick={() => eliminarProducto(p.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PEDIDOS */}
        {vista === 'pedidos' && (
          <div className={styles['admin-section']}>
            <div className={styles['admin-table']}>
              <table>
                <thead>
                  <tr><th>ID</th><th>Cliente</th><th>Email</th><th>Dirección</th><th>Total</th><th>Fecha</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  {pedidosRecientes.map((p: any) => (
                    <tr key={p.id}>
                      <td>#{p.id}</td>
                      <td>{sanitize(p.cliente)}</td>
                      <td>{sanitize(p.email)}</td>
                      <td>{sanitize(p.direccion)}</td>
                      <td>${p.total.toFixed(2)}</td>
                      <td>{new Date(p.fecha).toLocaleDateString('es-ES')}</td>
                      <td>
                        <button className={styles['btn-delete']} onClick={() => eliminarPedido(p.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pedidos.length === 0 && <p style={{ padding: '20px', textAlign: 'center' }}>No hay pedidos</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;
