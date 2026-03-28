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
