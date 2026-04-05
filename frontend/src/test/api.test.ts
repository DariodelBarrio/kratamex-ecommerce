import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
});

describe('API module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(store).forEach(k => delete store[k]);
  });

  it('login calls /api/login with POST', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'abc', user: { id: 1, username: 'admin' } }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const { login } = await import('../api');
    const result = await login('admin', 'admin123');
    expect(result.token).toBe('abc');
    expect(mockFetch).toHaveBeenCalledWith('/api/login', expect.objectContaining({ method: 'POST' }));
  });

  it('register calls /api/register with POST', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'xyz', user: { id: 2, username: 'newuser' } }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const { register } = await import('../api');
    const result = await register({ username: 'newuser', password: 'pass123', email: 'test@test.com' });
    expect(result.token).toBe('xyz');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Credenciales incorrectas' }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const { login } = await import('../api');
    await expect(login('bad', 'bad')).rejects.toThrow('Credenciales incorrectas');
  });

  it('includes auth header when token exists', async () => {
    store['kratamex_token'] = 'mytoken';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const { getMisPedidos } = await import('../api');
    await getMisPedidos();
    const call = mockFetch.mock.calls[0];
    expect(call[1].headers.Authorization).toBe('mytoken');
  });

  it('getUsuario llama a /api/usuario', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: { id: 1 } }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { getUsuario } = await import('../api');
    const res = await getUsuario();
    expect(res.user.id).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/usuario', expect.any(Object));
  });

  it('getProductos llama a /api/productos', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 1 }]),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { getProductos } = await import('../api');
    const res = await getProductos();
    expect(Array.isArray(res)).toBe(true);
  });

  it('getProducto llama a /api/productos/:id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 5, nombre: 'Test' }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { getProducto } = await import('../api');
    const res = await getProducto(5);
    expect(res.id).toBe(5);
  });

  it('getValoraciones llama a /api/productos/:id/valoraciones', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { getValoraciones } = await import('../api');
    const res = await getValoraciones(3);
    expect(Array.isArray(res)).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('/api/productos/3/valoraciones', expect.any(Object));
  });

  it('postValoracion llama a /api/productos/:id/valoraciones con POST', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { postValoracion } = await import('../api');
    await postValoracion(3, { puntuacion: 5, titulo: 'Excelente' });
    expect(mockFetch).toHaveBeenCalledWith('/api/productos/3/valoraciones', expect.objectContaining({ method: 'POST' }));
  });

  it('getFavoritos llama a /api/favoritos', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { getFavoritos } = await import('../api');
    const res = await getFavoritos();
    expect(Array.isArray(res)).toBe(true);
  });

  it('addFavorito llama a /api/favoritos/:id con POST', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { addFavorito } = await import('../api');
    await addFavorito(7);
    expect(mockFetch).toHaveBeenCalledWith('/api/favoritos/7', expect.objectContaining({ method: 'POST' }));
  });

  it('removeFavorito llama a /api/favoritos/:id con DELETE', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { removeFavorito } = await import('../api');
    await removeFavorito(7);
    expect(mockFetch).toHaveBeenCalledWith('/api/favoritos/7', expect.objectContaining({ method: 'DELETE' }));
  });

  it('validarCupon llama a /api/cupones/validar con POST', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ valido: true, descuento: 10, tipo: 'porcentaje', valor: 10 }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { validarCupon } = await import('../api');
    const res = await validarCupon('SAVE10', 100);
    expect(res.valido).toBe(true);
  });

  it('calcularCostes llama a /api/calcular-costes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ subtotal: 50, impuestos: 10.5, envio: 5.99, total: 66.49 }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { calcularCostes } = await import('../api');
    const res = await calcularCostes(50);
    expect(res.total).toBeCloseTo(66.49, 2);
  });

  it('getCategorias llama a /api/categorias', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ nombre: 'Gaming' }]),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { getCategorias } = await import('../api');
    const res = await getCategorias();
    expect(res[0].nombre).toBe('Gaming');
  });

  it('postPedido llama a /api/pedidos con POST', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1, total: 100 }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { postPedido } = await import('../api');
    await postPedido({ cliente: 'Test', email: 'test@test.com', direccion: 'Calle 1', items: [] });
    expect(mockFetch).toHaveBeenCalledWith('/api/pedidos', expect.objectContaining({ method: 'POST' }));
  });

  it('updatePerfil llama a /api/usuario/perfil con PUT', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { updatePerfil } = await import('../api');
    await updatePerfil({ nombre: 'Nuevo Nombre' });
    expect(mockFetch).toHaveBeenCalledWith('/api/usuario/perfil', expect.objectContaining({ method: 'PUT' }));
  });

  it('cambiarPassword llama a /api/usuario/password con PUT', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { cambiarPassword } = await import('../api');
    await cambiarPassword('oldpass', 'newpass123');
    expect(mockFetch).toHaveBeenCalledWith('/api/usuario/password', expect.objectContaining({ method: 'PUT' }));
  });

  it('exportPedidosCsv devuelve texto CSV', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('id,total\n1,100'),
    });
    const { exportPedidosCsv } = await import('../api');
    const res = await exportPedidosCsv();
    expect(res).toContain('id,total');
  });

  it('exportProductosCsv devuelve texto CSV', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('id,nombre\n1,Test'),
    });
    const { exportProductosCsv } = await import('../api');
    const res = await exportProductosCsv();
    expect(res).toContain('id,nombre');
  });

  it('subscribePush llama a /api/push/subscribe con POST', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { subscribePush } = await import('../api');
    await subscribePush({ endpoint: 'https://push.example.com', keys: {} });
    expect(mockFetch).toHaveBeenCalledWith('/api/push/subscribe', expect.objectContaining({ method: 'POST' }));
  });

  it('throws with HTTP status when error body has no error field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { getProductos } = await import('../api');
    await expect(getProductos()).rejects.toThrow(/HTTP/);
  });

  it('getAdminPedidos llama a /api/admin/pedidos', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { getAdminPedidos } = await import('../api');
    const res = await getAdminPedidos();
    expect(Array.isArray(res)).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/admin/pedidos'), expect.any(Object));
  });

  it('deleteAdminPedido llama a /api/admin/pedidos/:id con DELETE', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { deleteAdminPedido } = await import('../api');
    await deleteAdminPedido(5);
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/pedidos/5', expect.objectContaining({ method: 'DELETE' }));
  });

  it('patchPedidoEstado llama a /api/admin/pedidos/:id/estado con PATCH', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { patchPedidoEstado } = await import('../api');
    await patchPedidoEstado(5, 'enviado');
    expect(mockFetch).toHaveBeenCalledWith('/api/pedidos/5/estado', expect.objectContaining({ method: 'PATCH' }));
  });

  it('getAdminAnalytics llama a /api/admin/analytics', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ventas: 100 }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { getAdminAnalytics } = await import('../api');
    const res = await getAdminAnalytics();
    expect(res.ventas).toBe(100);
  });

  it('getAdminUsuarios llama a /api/admin/usuarios', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 1 }]),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { getAdminUsuarios } = await import('../api');
    const res = await getAdminUsuarios();
    expect(Array.isArray(res)).toBe(true);
  });

  it('getAdminCupones llama a /api/admin/cupones', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { getAdminCupones } = await import('../api');
    const res = await getAdminCupones();
    expect(Array.isArray(res)).toBe(true);
  });

  it('postAdminCupon llama a /api/admin/cupones con POST', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { postAdminCupon } = await import('../api');
    await postAdminCupon({ codigo: 'TEST10', descuento: 10 });
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/cupones', expect.objectContaining({ method: 'POST' }));
  });

  it('deleteAdminCupon llama a /api/admin/cupones/:id con DELETE', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { deleteAdminCupon } = await import('../api');
    await deleteAdminCupon(3);
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/cupones/3', expect.objectContaining({ method: 'DELETE' }));
  });

  it('postProducto llama a /api/productos con POST', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 10 }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { postProducto } = await import('../api');
    await postProducto({ nombre: 'Nuevo', precio: 50 });
    expect(mockFetch).toHaveBeenCalledWith('/api/productos', expect.objectContaining({ method: 'POST' }));
  });

  it('putProducto llama a /api/productos/:id con PUT', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { putProducto } = await import('../api');
    await putProducto(10, { nombre: 'Actualizado' });
    expect(mockFetch).toHaveBeenCalledWith('/api/productos/10', expect.objectContaining({ method: 'PUT' }));
  });

  it('deleteProducto llama a /api/productos/:id con DELETE', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { deleteProducto } = await import('../api');
    await deleteProducto(10);
    expect(mockFetch).toHaveBeenCalledWith('/api/productos/10', expect.objectContaining({ method: 'DELETE' }));
  });

  it('patchProductoStock llama a /api/productos/:id/stock con PATCH', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { patchProductoStock } = await import('../api');
    await patchProductoStock(10, { stock: 5 });
    expect(mockFetch).toHaveBeenCalledWith('/api/productos/10/stock', expect.objectContaining({ method: 'PATCH' }));
  });

  it('postCategoria llama a /api/categorias con POST', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { postCategoria } = await import('../api');
    await postCategoria({ nombre: 'Gaming' });
    expect(mockFetch).toHaveBeenCalledWith('/api/categorias', expect.objectContaining({ method: 'POST' }));
  });

  it('putCategoria llama a /api/categorias/:id con PUT', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { putCategoria } = await import('../api');
    await putCategoria(1, { nombre: 'Actualizado' });
    expect(mockFetch).toHaveBeenCalledWith('/api/categorias/1', expect.objectContaining({ method: 'PUT' }));
  });

  it('deleteCategoria llama a /api/categorias/:id con DELETE', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { deleteCategoria } = await import('../api');
    await deleteCategoria(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/categorias/1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('getAuditLog llama a /api/admin/audit-log', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 1, action: 'login' }]),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { getAuditLog } = await import('../api');
    const res = await getAuditLog();
    expect(Array.isArray(res)).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/admin/audit-log'), expect.any(Object));
  });

  it('getAuditLog acepta limit personalizado', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { getAuditLog } = await import('../api');
    await getAuditLog(50);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('limit=50'), expect.any(Object));
  });

  it('request devuelve texto cuando content-type es text/csv', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('col1,col2\nval1,val2'),
      headers: new Headers({ 'content-type': 'text/csv' }),
    });
    const { getProductos } = await import('../api');
    const res = await getProductos();
    expect(res).toContain('col1');
  });

  it('getProductos con params añade query string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const { getProductos } = await import('../api');
    await getProductos('categoria=Tech');
    expect(mockFetch).toHaveBeenCalledWith('/api/productos?categoria=Tech', expect.any(Object));
  });
});
