import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Child component mocks ─────────────────────────────────────────
vi.mock('../components/Admin/Admin', () => ({ default: () => <div data-testid="admin" /> }));
vi.mock('../components/SecurityDashboard', () => ({ default: () => <div data-testid="security-dashboard" /> }));
vi.mock('../components/ForgotPassword', () => ({ default: () => <div data-testid="forgot-password" /> }));
vi.mock('../components/ResetPassword',   () => ({ default: () => <div data-testid="reset-password" /> }));
vi.mock('../components/ProductoDetalle', () => ({ default: () => <div data-testid="producto-detalle" /> }));
vi.mock('../components/ParticleCanvas',  () => ({ ParticleCanvas: () => null }));
vi.mock('../components/OrderHistory',    () => ({ default: () => <div data-testid="order-history" /> }));
vi.mock('../components/UserProfile',     () => ({ default: () => <div data-testid="user-profile" /> }));
vi.mock('../components/SkeletonCard',    () => ({ SkeletonCard: () => <div data-testid="skeleton" /> }));
vi.mock('../components/SecurityBadge',   () => ({ SecurityBadge: () => <span>Secure</span> }));

// SplashScreen calls onDone immediately to skip it in most tests
vi.mock('../components/SplashScreen', () => ({
  SplashScreen: ({ onDone }: { onDone: () => void }) => {
    React.useEffect(() => { onDone(); }, []);
    return null;
  },
}));

// Auth mock — provides a login button to test handleAuth
vi.mock('../components/Auth', () => ({
  default: ({ onAuth }: { onAuth: (d: unknown) => void }) => (
    <div data-testid="auth">
      <button
        onClick={() => onAuth({ token: 'tok', user: { id: 1, username: 'testuser', role: 'standard' } })}
      >
        Login
      </button>
    </div>
  ),
}));

vi.mock('../components/ProductCard', () => ({
  ProductCard:    ({ producto }: { producto: { nombre: string } }) =>
    <div data-testid="product-card">{producto.nombre}</div>,
  BrandLogoSmall: () => <div />,
}));

// ── Framer-motion mock ──────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div:    ({ children, className, style, onClick }: React.HTMLAttributes<HTMLDivElement>) =>
      <div className={className} style={style} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onClick(e as unknown as React.MouseEvent<HTMLDivElement>); } : undefined}>{children}</div>, // NOSONAR
    button: ({ children, onClick, className, title }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      <button onClick={onClick} className={className} title={title}>{children}</button>,
    span:   ({ children, className }: React.HTMLAttributes<HTMLSpanElement>) =>
      <span className={className}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── React-query mock ────────────────────────────────────────────────
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...(actual as object),
    useQuery:    vi.fn().mockReturnValue({ data: [], isLoading: false, isError: false }),
    useMutation: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  };
});

// ── API mock ────────────────────────────────────────────────────────
vi.mock('../api', () => ({
  postPedido:      vi.fn(),
  validarCupon:    vi.fn(),
  addFavorito:     vi.fn(),
  removeFavorito:  vi.fn(),
}));

import React from 'react';
import App from '../App';

// ── Helpers ─────────────────────────────────────────────────────────
function renderApp(path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App — rutas y renderizado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renderiza la tienda (/) sin errores', () => {
    renderApp('/');
    // "Kratamex" aparece en el logo (link) y en el footer
    expect(screen.getByRole('link', { name: 'Kratamex' })).toBeInTheDocument();
  });

  it('muestra el badge de seguridad en la tienda', () => {
    renderApp('/');
    expect(screen.getByText('Secure')).toBeInTheDocument();
  });

  it('muestra el botón del carrito en la tienda', () => {
    renderApp('/');
    expect(screen.getByText('Carrito')).toBeInTheDocument();
  });

  it('muestra el link de login cuando no hay sesión', () => {
    renderApp('/');
    // Link to="/login" se renderiza cuando authUser es null
    expect(screen.getByTitle('Iniciar sesión')).toBeInTheDocument();
  });

  it('ruta /login muestra el componente Auth', () => {
    renderApp('/login');
    expect(screen.getByTestId('auth')).toBeInTheDocument();
  });

  it('ruta /forgot-password muestra ForgotPassword', () => {
    renderApp('/forgot-password');
    expect(screen.getByTestId('forgot-password')).toBeInTheDocument();
  });

  it('ruta /reset-password muestra ResetPassword', () => {
    renderApp('/reset-password');
    expect(screen.getByTestId('reset-password')).toBeInTheDocument();
  });

  it('ruta /admin muestra el panel de administración', () => {
    renderApp('/admin');
    expect(screen.getByTestId('admin')).toBeInTheDocument();
  });

  it('ruta /panel muestra el dashboard de seguridad', () => {
    renderApp('/panel');
    expect(screen.getByTestId('security-dashboard')).toBeInTheDocument();
  });

  it('ruta desconocida muestra la página 404', () => {
    renderApp('/ruta-que-no-existe');
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Página no encontrada')).toBeInTheDocument();
  });

  it('ruta /mis-pedidos sin autenticar redirige a /login', () => {
    renderApp('/mis-pedidos');
    expect(screen.getByTestId('auth')).toBeInTheDocument();
  });

  it('ruta /perfil sin autenticar redirige a /login', () => {
    renderApp('/perfil');
    expect(screen.getByTestId('auth')).toBeInTheDocument();
  });

  it('muestra categoría "Todos" en la barra de filtros', () => {
    renderApp('/');
    expect(screen.getByText('Todos')).toBeInTheDocument();
  });

  it('botón de toggle de tema existe', () => {
    renderApp('/');
    // Hay un botón de tema (light/dark)
    expect(screen.getByTitle(/modo/i)).toBeInTheDocument();
  });

  it('input de búsqueda existe en la tienda', () => {
    renderApp('/');
    expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument();
  });

  it('botón del carrito abre el panel lateral al hacer click', () => {
    renderApp('/');
    const cartBtn = screen.getByText('Carrito').closest('button')!;
    fireEvent.click(cartBtn);
    // El carrito abierto muestra "Tu Carrito"
    expect(screen.getByText('Tu Carrito')).toBeInTheDocument();
  });

  it('ruta /registro muestra Auth en modo registro', () => {
    renderApp('/registro');
    expect(screen.getByTestId('auth')).toBeInTheDocument();
  });

  it('handleAuth: al hacer login se muestra el enlace al perfil', () => {
    renderApp('/login');
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    // After auth, "Mi perfil" link appears
    expect(screen.getByTitle('Mi perfil')).toBeInTheDocument();
  });

  it('handleLogout: al cerrar sesión se muestra el botón de login', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    renderApp('/login');
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    const logoutBtn = screen.getByTitle(/cerrar sesión/i);
    fireEvent.click(logoutBtn);
    expect(screen.getByTitle('Iniciar sesión')).toBeInTheDocument();
  });
});
