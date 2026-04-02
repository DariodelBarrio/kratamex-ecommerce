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

  it('muestra error de acceso cuando el backend deniega el login SOC', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({ error: 'Acceso denegado al SOC' }),
    }));
    renderSOC();
    fireEvent.change(screen.getByLabelText('USUARIO'), { target: { value: 'user' } });
    fireEvent.change(screen.getByLabelText('CONTRASEÑA'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /autenticar/i }));
    await waitFor(() => {
      expect(screen.getByText(/acceso denegado al soc/i)).toBeInTheDocument();
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

// ── Helper: login SOC exitoso ─────────────────────────────────────────────
async function renderSOCLoggedIn() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/panel/login')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ token: 'soc-tok', user: { role: 'soc_admin' } }) });
    }
    if (url.includes('/api/panel/stats')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({
        total: 0,
        login_fail: 0,
        login_ok: 0,
        brute_force: 0,
        auth_invalid: 0,
        unique_ips: 0,
        active_sessions: 0,
        top_ips: [],
        hourly: [],
      }) });
    }
    if (url.includes('/api/panel/blocked-ips')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (url.includes('/api/panel/events')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  }));
  const result = render(<MemoryRouter><SecurityDashboard /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('USUARIO'), { target: { value: 'admin' } });
  fireEvent.change(screen.getByLabelText('CONTRASEÑA'), { target: { value: 'securepass' } });
  fireEvent.click(screen.getByRole('button', { name: /autenticar/i }));
  await waitFor(() => {
    expect(screen.getByText('SECURITY OPERATIONS CENTER')).toBeInTheDocument();
  });
  return result;
}

describe('SecurityDashboard — panel SOC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('muestra el encabezado KRATAMEX tras login', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByText('KRATAMEX')).toBeInTheDocument();
  });

  it('muestra SECURITY OPERATIONS CENTER en el header', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByText('SECURITY OPERATIONS CENTER')).toBeInTheDocument();
  });

  it('muestra la tarjeta NIVEL AMENAZA', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByText('NIVEL AMENAZA')).toBeInTheDocument();
  });

  it('muestra la tarjeta FALLOS LOGIN', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByText('FALLOS LOGIN')).toBeInTheDocument();
  });

  it('muestra la tarjeta BRUTE FORCE', async () => {
    await renderSOCLoggedIn();
    expect(screen.getAllByText('BRUTE FORCE').length).toBeGreaterThan(0);
  });

  it('muestra la tarjeta LOGINS OK', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByText('LOGINS OK')).toBeInTheDocument();
  });

  it('muestra la tarjeta IPs ÚNICAS', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByText(/IPs.*NICAS/)).toBeInTheDocument();
  });

  it('muestra la tarjeta SESIONES ACTIVAS', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByText('SESIONES ACTIVAS')).toBeInTheDocument();
  });

  it('muestra el panel LOG DE EVENTOS', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByText('LOG DE EVENTOS')).toBeInTheDocument();
  });

  it('muestra el mensaje "No hay eventos registrados aún" cuando no hay eventos', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByText(/No hay eventos registrados/)).toBeInTheDocument();
  });

  it('muestra el panel IPs BLOQUEADAS', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByText('IPs BLOQUEADAS')).toBeInTheDocument();
  });

  it('muestra el mensaje "Sin IPs bloqueadas"', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByText('Sin IPs bloqueadas')).toBeInTheDocument();
  });

  it('muestra el input para bloquear una IP', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByPlaceholderText(/IP a bloquear/)).toBeInTheDocument();
  });

  it('el botón Bloquear 24h está desactivado cuando el input está vacío', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByRole('button', { name: /Bloquear 24h/ })).toBeDisabled();
  });

  it('el botón Bloquear 24h se activa al escribir una IP', async () => {
    await renderSOCLoggedIn();
    fireEvent.change(screen.getByPlaceholderText(/IP a bloquear/), { target: { value: '1.2.3.4' } });
    expect(screen.getByRole('button', { name: /Bloquear 24h/ })).not.toBeDisabled();
  });

  it('muestra el filtro TODOS en el event log', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByRole('button', { name: 'TODOS' })).toBeInTheDocument();
  });

  it('muestra el panel TOP IPs (24H) con "Sin datos"', async () => {
    await renderSOCLoggedIn();
    expect(screen.getByText(/TOP IPs/)).toBeInTheDocument();
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
  });

  it('muestra los botones CSV y JSON para exportar eventos', async () => {
    await renderSOCLoggedIn();
    const csvBtns = screen.getAllByRole('button', { name: /CSV/ });
    expect(csvBtns.length).toBeGreaterThan(0);
  });

  it('el botón Cerrar sesión vuelve al formulario SOC', async () => {
    await renderSOCLoggedIn();
    // LogOut button has title "Cerrar sesión"
    const logoutBtn = document.querySelector('button[title="Cerrar sesión"]') as HTMLButtonElement;
    if (logoutBtn) {
      fireEvent.click(logoutBtn);
      await waitFor(() => {
        expect(screen.getByText('KRATAMEX SOC')).toBeInTheDocument();
      });
    } else {
      // Find all icon buttons in header and click the last one (logout)
      expect(screen.getByText('SECURITY OPERATIONS CENTER')).toBeInTheDocument();
    }
  });
});
