import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, Package, TrendingUp, LayoutDashboard, Trash2, ShoppingBag, DollarSign, Users, Upload, X, ImageIcon, Star, MessageSquare, Tag, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import styles from './Admin.module.css';
import type { Producto } from '../../interfaces';
import { sanitize } from '../../utils';
import { PasswordStrength } from '../PasswordStrength';
import {
  patchPedidoEstado, getAdminAnalytics, getAdminUsuarios,
  getAdminCupones, postAdminCupon, deleteAdminCupon,
  exportPedidosCsv, exportProductosCsv, patchProductoStock,
} from '../../api';

function Admin() {
  const [autenticado, setAutenticado] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [token, setToken] = useState('');
  const [vista, setVista] = useState<'dashboard' | 'productos' | 'pedidos' | 'reseñas' | 'cupones' | 'usuarios'>('dashboard');
  const [editando, setEditando] = useState<Producto | null>(null);
  const [formProducto, setFormProducto] = useState({
    nombre: '', descripcion: '', precio: '', imagen: '', categoria: '', stock: '0', activo: true,
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
        localStorage.setItem('kratamex_token', data.token);
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
              <label htmlFor="admin-username" className={styles['input-label']}>Usuario</label>
              <input id="admin-username" type="text" placeholder="Nombre de usuario" className={styles['form-input']}
                value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verificarPassword()} />
            </div>
            <div className={styles['input-group']}>
              <label htmlFor="admin-password" className={styles['input-label']}>Contraseña</label>
              <div className={styles['password-input-wrapper']}>
                <input id="admin-password" type={mostrarPassword ? 'text' : 'password'} placeholder="••••••••"
                  className={styles['form-input']} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && verificarPassword()} />
                <button type="button" className={styles['toggle-password']}
                  onClick={() => setMostrarPassword(!mostrarPassword)}>
                  {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <PasswordStrength password={password} />
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
      localStorage.removeItem('kratamex_token');
      setAutenticado(false); setUsername(''); setPassword(''); setToken('');
    }} />;
}

function AdminPanel({ token, productos, setProductos, pedidos, setPedidos, vista, setVista,
  editando, setEditando, formProducto, setFormProducto, onLogout }: any) {

  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensajeForm, setMensajeForm] = useState('');
  const [reseñas, setReseñas] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [cupones, setCupones] = useState<any[]>([]);
  const [formCupon, setFormCupon] = useState({ codigo: '', tipo: 'porcentaje', valor: '', minCompra: '', maxUsos: '' });
  const [estadoEditando, setEstadoEditando] = useState<number | null>(null);
  const [stockEditando, setStockEditando] = useState<number | null>(null);
  const [stockValor, setStockValor] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { cargarDatos(); }, [token]);

  const cargarDatos = () => {
    fetch('/api/productos').then(r => r.json()).then(setProductos).catch(console.error);
    fetch('/api/admin/pedidos', { headers: { 'Authorization': token } })
      .then(r => r.json()).then(setPedidos).catch(console.error);
    fetch('/api/admin/valoraciones', { headers: { 'Authorization': token } })
      .then(r => r.json()).then(data => { if (Array.isArray(data)) setReseñas(data); }).catch(console.error);
    getAdminAnalytics().then(setAnalytics).catch(console.error);
    getAdminUsuarios().then(setUsuarios).catch(console.error);
    getAdminCupones().then(setCupones).catch(console.error);
  };

  const actualizarStock = async (id: number, nuevoStock: number) => {
    await patchProductoStock(id, { stock: nuevoStock });
    setProductos((prev: Producto[]) => prev.map((p: Producto) => p.id === id ? { ...p, stock: nuevoStock } : p));
    setStockEditando(null);
  };

  const toggleActivo = async (id: number, activo: boolean) => {
    await patchProductoStock(id, { activo: !activo });
    setProductos((prev: Producto[]) => prev.map((p: Producto) => p.id === id ? { ...p, activo: !activo } : p));
  };

  const cambiarEstadoPedido = async (id: number, estado: string) => {
    await patchPedidoEstado(id, estado);
    setPedidos((prev: any[]) => prev.map((p: any) => p.id === id ? { ...p, estado } : p));
    setEstadoEditando(null);
  };

  const crearCupon = async () => {
    if (!formCupon.codigo || !formCupon.valor) return;
    await postAdminCupon({
      codigo: formCupon.codigo.toUpperCase(),
      tipo: formCupon.tipo,
      valor: Number.parseFloat(formCupon.valor),
      minCompra: formCupon.minCompra ? Number.parseFloat(formCupon.minCompra) : 0,
      maxUsos: formCupon.maxUsos ? Number.parseInt(formCupon.maxUsos) : undefined,
    });
    setFormCupon({ codigo: '', tipo: 'porcentaje', valor: '', minCompra: '', maxUsos: '' });
    getAdminCupones().then(setCupones);
  };

  const eliminarCupon = async (id: number) => {
    if (!confirm('¿Eliminar cupón?')) return;
    await deleteAdminCupon(id);
    setCupones(prev => prev.filter((c: any) => c.id !== id));
  };

  const descargarCSV = async (tipo: 'pedidos' | 'productos') => {
    const csv = tipo === 'pedidos' ? await exportPedidosCsv() : await exportProductosCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tipo}_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

const eliminarPedido = async (id: number) => {
    if (!confirm('¿Eliminar este pedido?')) return;
    await fetch(`/api/admin/pedidos/${id}`, { method: 'DELETE', headers: { 'Authorization': token } });
    cargarDatos();
  };

  const eliminarReseña = async (id: number) => {
    if (!confirm('¿Eliminar esta reseña?')) return;
    await fetch(`/api/admin/valoraciones/${id}`, { method: 'DELETE', headers: { 'Authorization': token } });
    setReseñas(prev => prev.filter(r => r.id !== id));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagenFile(file);
    setImagenPreview(URL.createObjectURL(file));
  };

  const limpiarImagen = () => {
    setImagenFile(null);
    setImagenPreview('');
    setFormProducto((prev: any) => ({ ...prev, imagen: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const guardarProducto = async () => {
    if (!formProducto.nombre || !formProducto.precio) {
      setMensajeForm('Nombre y precio son requeridos');
      return;
    }
    setGuardando(true);
    setMensajeForm('');
    try {
      const data = { ...formProducto, precio: Number.parseFloat(formProducto.precio), stock: Number.parseInt(formProducto.stock) || 0 };
      const url = editando ? `/api/productos/${editando.id}` : '/api/productos';
      const method = editando ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        setMensajeForm(err.error || 'Error al guardar');
        return;
      }
      const result = await res.json();
      const productoId = editando ? editando.id : result.id;

      if (imagenFile) {
        const formData = new FormData();
        formData.append('imagen', imagenFile);
        const imgRes = await fetch(`/api/productos/${productoId}/imagen`, {
          method: 'POST',
          headers: { 'Authorization': token },
          body: formData,
        });
        if (!imgRes.ok) {
          const err = await imgRes.json();
          setMensajeForm(`Producto guardado pero error en imagen: ${err.error}`);
          cargarDatos();
          return;
        }
      }

      setFormProducto({ nombre: '', descripcion: '', precio: '', imagen: '', categoria: '', stock: '0', activo: true });
      setImagenFile(null);
      setImagenPreview('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setEditando(null);
      setMensajeForm('');
      cargarDatos();
    } finally {
      setGuardando(false);
    }
  };

  const eliminarProducto = async (id: number) => {
    if (!confirm('¿Eliminar producto?')) return;
    await fetch(`/api/productos/${id}`, { method: 'DELETE', headers: { 'Authorization': token } });
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
          <button className={`${styles['tab-btn']} ${vista === 'reseñas' ? styles.active : ''}`}
            onClick={() => setVista('reseñas')}>
            <MessageSquare size={18} /> Reseñas
            {reseñas.length > 0 && <span style={{ marginLeft: 6, background: '#6366f1', color: '#fff', borderRadius: '99px', fontSize: '0.7rem', padding: '1px 7px' }}>{reseñas.length}</span>}
          </button>
          <button className={`${styles['tab-btn']} ${vista === 'cupones' ? styles.active : ''}`}
            onClick={() => setVista('cupones')}>
            <Tag size={18} /> Cupones
          </button>
          <button className={`${styles['tab-btn']} ${vista === 'usuarios' ? styles.active : ''}`}
            onClick={() => setVista('usuarios')}>
            <Users size={18} /> Usuarios
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

            {/* Gráficas */}
            {pedidos.length > 0 && (() => {
              // Agrupar ingresos y nº pedidos por día
              const porDia: Record<string, { fecha: string, ingresos: number, pedidos: number }> = {};
              pedidosRecientes.slice().reverse().forEach((p: any) => {
                const dia = new Date(p.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                if (!porDia[dia]) porDia[dia] = { fecha: dia, ingresos: 0, pedidos: 0 };
                porDia[dia].ingresos += p.total;
                porDia[dia].pedidos += 1;
              });
              const chartData = Object.values(porDia);

              return (
                <div className={styles['charts-row']}>
                  <div className={styles['chart-card']}>
                    <h4 className={styles['chart-title']}>Ingresos por día (€)</h4>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <defs>
                          <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
                        <Tooltip formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Ingresos']} />
                        <Area type="natural" dataKey="ingresos" stroke="#2563eb" strokeWidth={2} fill="url(#gradIngresos)" dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className={styles['chart-card']}>
                    <h4 className={styles['chart-title']}>Pedidos por día</h4>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                        <Tooltip formatter={(v: any) => [v, 'Pedidos']} />
                        <Line type="natural" dataKey="pedidos" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}

            {/* Analytics extras */}
            {analytics && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                {/* Top productos */}
                <div className={styles['chart-card']}>
                  <h4 className={styles['chart-title']}>Top productos más vendidos</h4>
                  {analytics.topProductos?.length === 0 ? (
                    <p style={{ color: 'var(--text-light)', padding: '20px 0' }}>Sin datos</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--text-secondary)' }}>Producto</th>
                          <th style={{ textAlign: 'right', padding: '6px 0', color: 'var(--text-secondary)' }}>Vendidos</th>
                          <th style={{ textAlign: 'right', padding: '6px 0', color: 'var(--text-secondary)' }}>Ingresos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.topProductos?.slice(0,6).map((p: any) => (
                          <tr key={p.productoId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '6px 0' }}>{sanitize(p.nombre)}</td>
                            <td style={{ textAlign: 'right', padding: '6px 0', color: '#10b981', fontWeight: 600 }}>{p.vendidos}</td>
                            <td style={{ textAlign: 'right', padding: '6px 0' }}>€{Number(p.ingresos).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {/* Stock bajo */}
                <div className={styles['chart-card']}>
                  <h4 className={styles['chart-title']}><AlertCircle size={15} style={{ display: 'inline', marginRight: 6, color: '#f59e0b' }} />Stock bajo (≤5 unidades)</h4>
                  {analytics.stockBajo?.length === 0 ? (
                    <p style={{ color: '#10b981', padding: '20px 0', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={15} />{' '}Todo el stock es correcto</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--text-secondary)' }}>Producto</th>
                          <th style={{ textAlign: 'right', padding: '6px 0', color: 'var(--text-secondary)' }}>Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.stockBajo?.map((p: any) => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '6px 0' }}>{sanitize(p.nombre)}</td>
                            <td style={{ textAlign: 'right', padding: '6px 0', color: p.stock === 0 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>{p.stock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Export CSV */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <button onClick={() => descargarCSV('pedidos')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                <Download size={14} /> Exportar pedidos CSV
              </button>
              <button onClick={() => descargarCSV('productos')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                <Download size={14} /> Exportar productos CSV
              </button>
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
                <input type="text" placeholder="Nombre *" className={styles['form-input']}
                  value={formProducto.nombre} onChange={e => setFormProducto({ ...formProducto, nombre: e.target.value })} />
                <input type="text" placeholder="Descripción" className={styles['form-input']}
                  value={formProducto.descripcion} onChange={e => setFormProducto({ ...formProducto, descripcion: e.target.value })} />
                <input type="number" placeholder="Precio *" className={styles['form-input']}
                  value={formProducto.precio} onChange={e => setFormProducto({ ...formProducto, precio: e.target.value })} min={0} step={0.01} />
                <input type="text" placeholder="Categoría" className={styles['form-input']}
                  value={formProducto.categoria} onChange={e => setFormProducto({ ...formProducto, categoria: e.target.value })} />
                <input type="number" placeholder="Stock (unidades)" className={styles['form-input']}
                  value={formProducto.stock} onChange={e => setFormProducto({ ...formProducto, stock: e.target.value })} min={0} step={1} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={formProducto.activo}
                    onChange={e => setFormProducto({ ...formProducto, activo: e.target.checked })}
                    style={{ width: 16, height: 16, cursor: 'pointer' }} />{' '}
                  Producto activo (visible en tienda)
                </label>
                {!formProducto.activo && (
                  <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>⚠ Oculto en tienda</span>
                )}
              </div>

              {/* Imagen */}
              <div className={styles['imagen-upload-area']}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                {imagenPreview ? (
                  <div className={styles['imagen-preview-wrap']}>
                    <img src={imagenPreview} alt="Preview" className={styles['imagen-preview']} />
                    <button
                      type="button"
                      className={styles['imagen-remove-btn']}
                      onClick={limpiarImagen}
                      title="Quitar imagen"
                    >
                      <X size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles['imagen-change-btn']}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={14} /> Cambiar imagen
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles['imagen-upload-btn']}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon size={32} className={styles['imagen-upload-icon']} />
                    <span>Subir imagen del producto</span>
                    <span className={styles['imagen-upload-hint']}>JPG, PNG, WEBP · máx. 5MB</span>
                  </button>
                )}
              </div>

              {mensajeForm && (
                <p className={styles[mensajeForm.includes('guardado') ? 'form-warning' : 'form-error']}>
                  {mensajeForm}
                </p>
              )}

              <div className={styles['form-actions']}>
                <button className={styles['btn-primary']} onClick={guardarProducto} disabled={guardando}>
                  {(() => { if (guardando) return 'Guardando...'; return editando ? 'Actualizar' : 'Crear producto'; })()}
                </button>
                {editando && (
                  <button className={styles['btn-secondary']} onClick={() => {
                    setEditando(null);
                    setFormProducto({ nombre: '', descripcion: '', precio: '', imagen: '', categoria: '', stock: '0', activo: true });
                    setImagenFile(null);
                    setImagenPreview('');
                    setMensajeForm('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}>Cancelar</button>
                )}
              </div>
            </div>
            <div className={styles['admin-table']}>
              <table>
                <thead>
                  <tr><th>ID</th><th>Imagen</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {productos.map((p: Producto) => {
                    const stockAmount = p.stock ?? 0;
                    let stockColor: string;
                    if (stockAmount === 0) { stockColor = '#ef4444'; }
                    else if (stockAmount <= 5) { stockColor = '#f59e0b'; }
                    else { stockColor = '#10b981'; }
                    return (
                    <tr key={p.id} style={{ opacity: p.activo === false ? 0.5 : 1 }}>
                      <td>{p.id}</td>
                      <td>
                        {p.imagen
                          ? <img src={p.imagen} alt={p.nombre} className={styles['tabla-thumbnail']} />
                          : <div className={styles['tabla-thumbnail-placeholder']}><ImageIcon size={16} /></div>
                        }
                      </td>
                      <td>{sanitize(p.nombre)}</td>
                      <td>{sanitize(p.categoria)}</td>
                      <td>€{p.precio.toFixed(2)}</td>
                      <td>
                        {stockEditando === p.id ? (
                          <input
                            type="number" min={0} defaultValue={p.stock ?? 0}
                            value={stockValor}
                            onChange={e => setStockValor(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { actualizarStock(p.id, Number.parseInt(stockValor) || 0); } if (e.key === 'Escape') { setStockEditando(null); } }}
                            onBlur={() => actualizarStock(p.id, Number.parseInt(stockValor) || 0)}
                            autoFocus
                            style={{ width: 70, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 13 }}
                          />
                        ) : (
                          <span
                            onClick={() => { setStockEditando(p.id); setStockValor(String(p.stock ?? 0)); }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setStockEditando(p.id); setStockValor(String(p.stock ?? 0)); } }}
                            title="Click para editar stock"
                            style={{ cursor: 'pointer', fontWeight: 700, color: stockColor, padding: '2px 8px', borderRadius: 6, background: `${stockColor}18`, border: `1px solid ${stockColor}33` }}
                          >
                            {(p.stock ?? 0) === 0 ? '⊘ Agotado' : p.stock}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => toggleActivo(p.id, p.activo !== false)}
                          title={p.activo === false ? 'Activar producto' : 'Ocultar producto'}
                          style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: p.activo === false ? '#ef444422' : '#10b98122', color: p.activo === false ? '#ef4444' : '#10b981' }}
                        >
                          {p.activo === false ? 'Oculto' : 'Activo'}
                        </button>
                      </td>
                      <td>
                        <button className={styles['btn-edit']} onClick={() => {
                          setEditando(p);
                          setFormProducto({ nombre: p.nombre, descripcion: p.descripcion, precio: p.precio.toString(), imagen: p.imagen, categoria: p.categoria, stock: String(p.stock ?? 0), activo: p.activo !== false });
                          setImagenFile(null);
                          setImagenPreview(p.imagen || '');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                          setMensajeForm('');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}>Editar</button>
                        <button className={styles['btn-delete']} onClick={() => eliminarProducto(p.id)}>Eliminar</button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PEDIDOS */}
        {vista === 'pedidos' && (
          <div className={styles['admin-section']}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={() => descargarCSV('pedidos')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                <Download size={14} /> Exportar CSV
              </button>
            </div>
            <div className={styles['admin-table']}>
              <table>
                <thead>
                  <tr><th>ID</th><th>Cliente</th><th>Email</th><th>Total</th><th>Estado</th><th>Fecha</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  {pedidosRecientes.map((p: any) => {
                    const estadoColors: Record<string, string> = {
                      pendiente: '#f59e0b', confirmado: '#3b82f6', enviado: '#8b5cf6',
                      entregado: '#10b981', cancelado: '#ef4444',
                    };
                    return (
                      <tr key={p.id}>
                        <td>#{p.id}</td>
                        <td>{sanitize(p.cliente)}</td>
                        <td style={{ color: 'var(--text-light)' }}>{sanitize(p.email)}</td>
                        <td><span className={styles['order-total']}>${p.total.toFixed(2)}</span></td>
                        <td>
                          {estadoEditando === p.id ? (
                            <select
                              defaultValue={p.estado || 'pendiente'}
                              onChange={e => cambiarEstadoPedido(p.id, e.target.value)}
                              onBlur={() => setEstadoEditando(null)}
                              autoFocus
                              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12 }}
                            >
                              {['pendiente','confirmado','enviado','entregado','cancelado'].map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          ) : (
                            <span
                              onClick={() => setEstadoEditando(p.id)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setEstadoEditando(p.id); } }}
                              title="Click para cambiar estado"
                              style={{ cursor: 'pointer', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${estadoColors[p.estado] || '#94a3b8'}22`, color: estadoColors[p.estado] || '#94a3b8', border: `1px solid ${estadoColors[p.estado] || '#94a3b8'}44` }}
                            >
                              {p.estado || 'pendiente'}
                            </span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{new Date(p.fecha).toLocaleDateString('es-ES')}</td>
                        <td>
                          <button className={styles['btn-delete']} onClick={() => eliminarPedido(p.id)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pedidos.length === 0 && <p style={{ padding: '20px', textAlign: 'center' }}>No hay pedidos</p>}
            </div>
          </div>
        )}

        {/* RESEÑAS */}
        {vista === 'reseñas' && (
          <div className={styles['admin-section']}>
            <h2 style={{ color: '#fff', marginBottom: '16px' }}>Reseñas de clientes</h2>
            {reseñas.length === 0 ? (
              <p style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No hay reseñas todavía</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reseñas.map((r: any) => (
                  <div key={r.id} className={styles['review-card']}>
                    <div className={styles['review-header']}>
                      <div className={styles['review-meta']}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {r.avatar
                            ? <img src={r.avatar} alt={r.username} className={styles['review-avatar']} />
                            : <div className={styles['review-avatar-placeholder']}>{r.username[0].toUpperCase()}</div>
                          }
                          <span className={styles['review-username']}>{sanitize(r.username)}</span>
                        </div>
                        <span className={styles['review-product']}>sobre: <strong>{sanitize(r.productoNombre)}</strong></span>
                        <span className={styles['review-date']}>{new Date(r.fecha).toLocaleDateString('es-ES')}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          {[1,2,3,4,5].map(n => (
                            <Star key={n} size={14} fill={n <= r.puntuacion ? '#f59e0b' : 'none'} color={n <= r.puntuacion ? '#f59e0b' : '#475569'} />
                          ))}
                        </div>
                        <button className={styles['btn-delete']} onClick={() => eliminarReseña(r.id)} title="Eliminar reseña">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {r.titulo && <p className={styles['review-title']}>{sanitize(r.titulo)}</p>}
                    {r.comentario && <p className={styles['review-body']}>{sanitize(r.comentario)}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* CUPONES */}
        {vista === 'cupones' && (
          <div className={styles['admin-section']}>
            <div className={styles['admin-form']}>
              <h3>Nuevo cupón</h3>
              <div className={styles['form-grid']}>
                <input type="text" placeholder="Código (ej: VERANO20)" className={styles['form-input']}
                  value={formCupon.codigo} onChange={e => setFormCupon({ ...formCupon, codigo: e.target.value.toUpperCase() })} />
                <select className={styles['form-input']} value={formCupon.tipo}
                  onChange={e => setFormCupon({ ...formCupon, tipo: e.target.value })}>
                  <option value="porcentaje">Porcentaje (%)</option>
                  <option value="fijo">Descuento fijo (€)</option>
                </select>
                <input type="number" placeholder={formCupon.tipo === 'porcentaje' ? 'Valor % (ej: 20)' : 'Valor € (ej: 10)'} className={styles['form-input']}
                  value={formCupon.valor} onChange={e => setFormCupon({ ...formCupon, valor: e.target.value })} min={0} step={0.01} />
                <input type="number" placeholder="Compra mínima (€, opcional)" className={styles['form-input']}
                  value={formCupon.minCompra} onChange={e => setFormCupon({ ...formCupon, minCompra: e.target.value })} min={0} />
                <input type="number" placeholder="Máx. usos (opcional)" className={styles['form-input']}
                  value={formCupon.maxUsos} onChange={e => setFormCupon({ ...formCupon, maxUsos: e.target.value })} min={1} />
              </div>
              <div className={styles['form-actions']}>
                <button className={styles['btn-primary']} onClick={crearCupon}>
                  <Tag size={15} /> Crear cupón
                </button>
              </div>
            </div>
            <div className={styles['admin-table']}>
              <table>
                <thead>
                  <tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Mín. compra</th><th>Usos</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {cupones.map((c: any) => (
                    <tr key={c.id}>
                      <td><code style={{ background: '#1e293b', padding: '2px 8px', borderRadius: 4, fontSize: 13 }}>{c.codigo}</code></td>
                      <td>{c.tipo}</td>
                      <td>{c.tipo === 'porcentaje' ? `${c.valor}%` : `€${c.valor}`}</td>
                      <td>{c.minCompra ? `€${c.minCompra}` : '—'}</td>
                      <td>{c.usosActuales ?? 0}{c.maxUsos ? ` / ${c.maxUsos}` : ''}</td>
                      <td><span style={{ color: c.activo ? '#10b981' : '#ef4444', fontWeight: 600 }}>{c.activo ? 'Activo' : 'Inactivo'}</span></td>
                      <td><button className={styles['btn-delete']} onClick={() => eliminarCupon(c.id)}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cupones.length === 0 && <p style={{ padding: '20px', textAlign: 'center' }}>No hay cupones</p>}
            </div>
          </div>
        )}

        {/* USUARIOS */}
        {vista === 'usuarios' && (
          <div className={styles['admin-section']}>
            <div className={styles['admin-table']}>
              <table>
                <thead>
                  <tr><th>ID</th><th>Usuario</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Pedidos</th><th>Registro</th></tr>
                </thead>
                <tbody>
                  {usuarios.map((u: any) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td style={{ fontWeight: 600 }}>{sanitize(u.username)}</td>
                      <td>{sanitize(u.nombre) || '—'}</td>
                      <td style={{ color: 'var(--text-light)' }}>{sanitize(u.email) || '—'}</td>
                      <td>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: u.role === 'admin' ? '#ef444422' : '#3b82f622', color: u.role === 'admin' ? '#ef4444' : '#3b82f6' }}>
                          {u.role}
                        </span>
                      </td>
                      <td>{u.totalPedidos ?? 0}</td>
                      <td style={{ color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-ES') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {usuarios.length === 0 && <p style={{ padding: '20px', textAlign: 'center' }}>No hay usuarios</p>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Admin;
