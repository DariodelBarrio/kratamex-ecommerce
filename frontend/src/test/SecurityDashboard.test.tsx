import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Lucide-react mock ───────────────────────────────────────────────
vi.mock('lucide-react', () => ({
  Shield:        () => <span data-testid="icon-shield" />,
  AlertTriangle: () => <span />, CheckCircle: () => <span />,
  XCircle:       () => <span />, Activity:    () => <span />,
  Users:         () => <span />, Wifi:         () => <span />,
  Lock:          () => <span />, RefreshCw:   () => <span />,
  LogOut:        () => <span />, Terminal:    () => <span />,
  Eye:           () => <span data-testid="icon-eye" />,
  EyeOff:        () => <span data-testid="icon-eyeoff" />,
  Globe:         () => <span />, Search:      () => <span />,
  Download:      () => <span />, Ban:         () => <span />,
  Trash2:        () => <span />,
}));

// ── Recharts mock ───────────────────────────────────────────────────
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null, XAxis: () => null, YAxis: () => null,
  CartesianGrid: () => null, Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ── CSS Module mock ─────────────────────────────────────────────────
vi.mock('../components/SecurityDashboard.module.css', () => ({
  default: new Proxy({}, { get: (_t, k) => String(k) }),
}));

import SecurityDashboard from '../components/SecurityDashboard';

function renderSOC() {
  return render(
    <MemoryRouter>
      <SecurityDashboard />
    </MemoryRouter>,
  );
}

describe('SecurityDashboard — formulario de login SOC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: 'Credenciales inválidas' }),
    }));
  });

  it('muestra el logo KRATAMEX SOC', () => {
    renderSOC();
    expect(screen.getByText('KRATAMEX SOC')).toBeInTheDocument();
  });

  it('renderiza los campos USUARIO y CONTRASEÑA', () => {
    renderSOC();
    expect(screen.getByLabelText('USUARIO')).toBeInTheDocument();
    expect(screen.getByLabelText('CONTRASEÑA')).toBeInTheDocument();
  });

  it('muestra el botón AUTENTICAR', () => {
    renderSOC();
    expect(screen.getByRole('button', { name: /autenticar/i })).toBeInTheDocument();
  });

  it('muestra error cuando las credenciales son inválidas', async () => {
    renderSOC();
    fireEvent.change(screen.getByLabelText('USUARIO'), { target: { value: 'soc' } });
    fireEvent.change(screen.getByLabelText('CONTRASEÑA'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /autenticar/i }));
    await waitFor(() => {
      expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument();
    });
  });

  it('muestra error "Acceso denegado" cuando el rol no es admin', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ token: 'tok', user: { role: 'standard' } }),
    }));
    renderSOC();
    fireEvent.change(screen.getByLabelText('USUARIO'), { target: { value: 'user' } });
    fireEvent.change(screen.getByLabelText('CONTRASEÑA'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /autenticar/i }));
    await waitFor(() => {
      expect(screen.getByText(/acceso denegado/i)).toBeInTheDocument();
    });
  });

  it('muestra error de conexión cuando fetch falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network')));
    renderSOC();
    fireEvent.change(screen.getByLabelText('USUARIO'), { target: { value: 'soc' } });
    fireEvent.change(screen.getByLabelText('CONTRASEÑA'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /autenticar/i }));
    await waitFor(() => {
      expect(screen.getByText(/error de conexi/i)).toBeInTheDocument();
    });
  });

  it('alterna la visibilidad de la contraseña', () => {
    renderSOC();
    const passInput = screen.getByLabelText('CONTRASEÑA');
    expect(passInput).toHaveAttribute('type', 'password');
    // The toggle button is inside the passWrap div alongside the password input
    const passWrapper = passInput.parentElement!;
    const toggleBtn = passWrapper.querySelector('button')!;
    fireEvent.click(toggleBtn);
    expect(passInput).toHaveAttribute('type', 'text');
    fireEvent.click(toggleBtn);
    expect(passInput).toHaveAttribute('type', 'password');
  });

  it('envía el formulario al pulsar Enter en el campo USUARIO', async () => {
    renderSOC();
    fireEvent.change(screen.getByLabelText('USUARIO'), { target: { value: 'soc' } });
    fireEvent.change(screen.getByLabelText('CONTRASEÑA'), { target: { value: 'pass' } });
    fireEvent.keyDown(screen.getByLabelText('USUARIO'), { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument();
    });
  });

  it('envía el formulario al pulsar Enter en la contraseña', async () => {
    renderSOC();
    fireEvent.change(screen.getByLabelText('USUARIO'), { target: { value: 'soc' } });
    fireEvent.change(screen.getByLabelText('CONTRASEÑA'), { target: { value: 'pass' } });
    fireEvent.keyDown(screen.getByLabelText('CONTRASEÑA'), { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument();
    });
  });
});
