import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Lucide-react mock ───────────────────────────────────────────────
vi.mock('lucide-react', () => ({
  Lock:          () => <span data-testid="icon-lock" />,
  Eye:           () => <span data-testid="icon-eye" />,
  EyeOff:        () => <span data-testid="icon-eyeoff" />,
  Package:       () => <span />, TrendingUp:    () => <span />,
  LayoutDashboard: () => <span />, Trash2:        () => <span />,
  ShoppingBag:   () => <span />, DollarSign:    () => <span />,
  Users:         () => <span />, Upload:        () => <span />,
  X:             () => <span />, ImageIcon:     () => <span />,
  Star:          () => <span />, MessageSquare: () => <span />,
  Tag:           () => <span />, Download:      () => <span />,
  AlertCircle:   () => <span />, CheckCircle:   () => <span />,
  ClipboardList: () => <span />,
}));

// ── Recharts mock ───────────────────────────────────────────────────
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null, XAxis: () => null, YAxis: () => null,
  CartesianGrid: () => null, Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
}));

// ── CSS Module mock ─────────────────────────────────────────────────
vi.mock('../components/Admin/Admin.module.css', () => ({ default: new Proxy({}, { get: (_t, k) => String(k) }) }));

// ── PasswordStrength mock ───────────────────────────────────────────
vi.mock('../components/PasswordStrength', () => ({
  PasswordStrength: () => <div data-testid="password-strength" />,
}));

// ── API mock ────────────────────────────────────────────────────────
vi.mock('../api', () => ({
  patchPedidoEstado:  vi.fn().mockResolvedValue({}),
  getAdminAnalytics:  vi.fn().mockResolvedValue({}),
  getAdminUsuarios:   vi.fn().mockResolvedValue([]),
  getAdminCupones:    vi.fn().mockResolvedValue([]),
  postAdminCupon:     vi.fn().mockResolvedValue({}),
  deleteAdminCupon:   vi.fn().mockResolvedValue({}),
  exportPedidosCsv:   vi.fn().mockResolvedValue(''),
  exportProductosCsv: vi.fn().mockResolvedValue(''),
  patchProductoStock: vi.fn().mockResolvedValue({}),
  getAuditLog:        vi.fn().mockResolvedValue([]),
}));

import Admin from '../components/Admin/Admin';

function renderAdmin() {
  return render(
    <MemoryRouter>
      <Admin />
    </MemoryRouter>,
  );
}

describe('Admin — formulario de login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: 'Credenciales incorrectas' }),
    }));
  });

  it('muestra el formulario de acceso con título correcto', () => {
    renderAdmin();
    expect(screen.getByText('Acceso Administrador')).toBeInTheDocument();
  });

  it('renderiza los campos usuario y contraseña', () => {
    renderAdmin();
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });

  it('muestra error cuando los campos están vacíos al enviar', async () => {
    renderAdmin();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
    await waitFor(() => {
      expect(screen.getByText('Usuario y contraseña son requeridos')).toBeInTheDocument();
    });
  });

  it('muestra error de credenciales cuando el servidor responde 401', async () => {
    renderAdmin();
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
    await waitFor(() => {
      expect(screen.getByText('Credenciales incorrectas')).toBeInTheDocument();
    });
  });

  it('muestra error de conexión cuando fetch lanza excepción', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    renderAdmin();
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
    await waitFor(() => {
      expect(screen.getByText('Error al conectar con el servidor')).toBeInTheDocument();
    });
  });

  it('envía el formulario al pulsar Enter en el campo usuario', async () => {
    renderAdmin();
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'pass' } });
    fireEvent.keyDown(screen.getByLabelText('Usuario'), { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('Credenciales incorrectas')).toBeInTheDocument();
    });
  });

  it('envía el formulario al pulsar Enter en el campo contraseña', async () => {
    renderAdmin();
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'pass' } });
    fireEvent.keyDown(screen.getByLabelText('Contraseña'), { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('Credenciales incorrectas')).toBeInTheDocument();
    });
  });

  it('alterna la visibilidad de la contraseña', () => {
    renderAdmin();
    const passInput = screen.getByLabelText('Contraseña');
    expect(passInput).toHaveAttribute('type', 'password');
    // The toggle button lives inside the password-input-wrapper div (parentElement)
    const toggleBtn = passInput.parentElement!.querySelector('button')!;
    fireEvent.click(toggleBtn);
    expect(passInput).toHaveAttribute('type', 'text');
    fireEvent.click(toggleBtn);
    expect(passInput).toHaveAttribute('type', 'password');
  });

  it('tras login correcto muestra el panel de administración', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ token: 'tok-admin', user: { id: 1, role: 'admin' } }),
      })
      .mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      }),
    );
    renderAdmin();
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'securepass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
    await waitFor(() => {
      expect(screen.getByText('Panel de Administración')).toBeInTheDocument();
    });
  });

  it('tras login correcto aparece la pestaña Auditoría', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ token: 'tok-admin', user: { id: 1, role: 'admin' } }),
      })
      .mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      }),
    );
    renderAdmin();
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'securepass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
    await waitFor(() => {
      expect(screen.getByText('Auditoría')).toBeInTheDocument();
    });
  });
});

// ── Helper para entrar al panel ─────────────────────────────────────────────
async function renderAdminLoggedIn() {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ token: 'tok-admin', user: { id: 1, role: 'admin' } }),
    })
    .mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    }),
  );
  const result = render(<MemoryRouter><Admin /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'securepass' } });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));
  await waitFor(() => {
    expect(screen.getByText('Panel de Administración')).toBeInTheDocument();
  });
  return result;
}

describe('Admin — panel de administración', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('muestra el título del panel tras login', async () => {
    await renderAdminLoggedIn();
    expect(screen.getByText('Panel de Administración')).toBeInTheDocument();
  });

  it('muestra los 7 botones de pestañas', async () => {
    await renderAdminLoggedIn();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Productos')).toBeInTheDocument();
    expect(screen.getByText('Pedidos')).toBeInTheDocument();
    expect(screen.getByText('Reseñas')).toBeInTheDocument();
    expect(screen.getByText('Cupones')).toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
    expect(screen.getByText('Auditoría')).toBeInTheDocument();
  });

  it('el dashboard muestra las tarjetas de métricas', async () => {
    await renderAdminLoggedIn();
    expect(screen.getByText('Total Pedidos')).toBeInTheDocument();
    expect(screen.getByText('Ingresos Totales')).toBeInTheDocument();
    expect(screen.getByText('Ticket Medio')).toBeInTheDocument();
    expect(screen.getByText('Clientes Únicos')).toBeInTheDocument();
    expect(screen.getByText('Productos en Catálogo')).toBeInTheDocument();
  });

  it('el dashboard muestra los botones de exportar CSV', async () => {
    await renderAdminLoggedIn();
    expect(screen.getByText('Exportar pedidos CSV')).toBeInTheDocument();
    expect(screen.getByText('Exportar productos CSV')).toBeInTheDocument();
  });

  it('el dashboard muestra la sección Compras de Clientes', async () => {
    await renderAdminLoggedIn();
    expect(screen.getByText(/Compras de Clientes/)).toBeInTheDocument();
  });

  it('el dashboard muestra "No hay pedidos todavía" cuando no hay pedidos', async () => {
    await renderAdminLoggedIn();
    expect(screen.getByText('No hay pedidos todavía')).toBeInTheDocument();
  });

  it('navega a la pestaña Productos', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Productos/ }));
    await waitFor(() => {
      expect(screen.getByText('Nuevo Producto')).toBeInTheDocument();
    });
  });

  it('la pestaña Productos muestra el formulario de producto', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Productos/ }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nombre *')).toBeInTheDocument();
    });
  });

  it('la pestaña Productos tiene el campo Precio', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Productos/ }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Precio *')).toBeInTheDocument();
    });
  });

  it('la pestaña Productos muestra el checkbox "activo"', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Productos/ }));
    await waitFor(() => {
      expect(screen.getByText(/Producto activo/)).toBeInTheDocument();
    });
  });

  it('la pestaña Productos muestra el botón Crear producto', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Productos/ }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Crear producto/ })).toBeInTheDocument();
    });
  });

  it('navega a la pestaña Pedidos', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Pedidos/ }));
    await waitFor(() => {
      expect(screen.getByText('Exportar CSV')).toBeInTheDocument();
    });
  });

  it('la pestaña Pedidos muestra "No hay pedidos"', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Pedidos/ }));
    await waitFor(() => {
      expect(screen.getByText('No hay pedidos')).toBeInTheDocument();
    });
  });

  it('navega a la pestaña Reseñas', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Reseñas/ }));
    await waitFor(() => {
      expect(screen.getByText('Reseñas de clientes')).toBeInTheDocument();
    });
  });

  it('la pestaña Reseñas muestra "No hay reseñas todavía"', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Reseñas/ }));
    await waitFor(() => {
      expect(screen.getByText('No hay reseñas todavía')).toBeInTheDocument();
    });
  });

  it('navega a la pestaña Cupones', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Cupones/ }));
    await waitFor(() => {
      expect(screen.getByText('Nuevo cupón')).toBeInTheDocument();
    });
  });

  it('la pestaña Cupones tiene el campo Código', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Cupones/ }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Código/)).toBeInTheDocument();
    });
  });

  it('la pestaña Cupones muestra "No hay cupones"', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Cupones/ }));
    await waitFor(() => {
      expect(screen.getByText('No hay cupones')).toBeInTheDocument();
    });
  });

  it('navega a la pestaña Usuarios', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Usuarios/ }));
    await waitFor(() => {
      expect(screen.getByText('No hay usuarios')).toBeInTheDocument();
    });
  });

  it('la pestaña Usuarios muestra cabeceras de tabla', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Usuarios/ }));
    await waitFor(() => {
      expect(screen.getByText('Rol')).toBeInTheDocument();
      expect(screen.getByText('Registro')).toBeInTheDocument();
    });
  });

  it('navega a la pestaña Auditoría', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Auditoría/ }));
    await waitFor(() => {
      expect(screen.getByText('Registro de Auditoría')).toBeInTheDocument();
    });
  });

  it('la pestaña Auditoría muestra el botón Actualizar', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Auditoría/ }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    });
  });

  it('la pestaña Auditoría muestra las cabeceras de la tabla', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Auditoría/ }));
    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Acción')).toBeInTheDocument();
      expect(screen.getByText('Entidad')).toBeInTheDocument();
    });
  });

  it('el botón Cerrar Sesión vuelve al formulario de login', async () => {
    await renderAdminLoggedIn();
    fireEvent.click(screen.getByRole('button', { name: /Cerrar Sesión/ }));
    await waitFor(() => {
      expect(screen.getByText('Acceso Administrador')).toBeInTheDocument();
    });
  });
});
