import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Framer-motion mock (shared) ────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div:    ({ children, className, style, onClick }: React.HTMLAttributes<HTMLDivElement>) => <div className={className} style={style} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onClick(e as unknown as React.MouseEvent<HTMLDivElement>); } : undefined}>{children}</div>, // NOSONAR
    span:   ({ children, className }: React.HTMLAttributes<HTMLSpanElement>) => <span className={className}>{children}</span>,
    p:      ({ children, className }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={className}>{children}</p>,
    input:  ({ style, type, value, onChange, placeholder }: React.InputHTMLAttributes<HTMLInputElement>) => <input style={style} type={type} value={value} onChange={onChange} placeholder={placeholder} />,
    button: ({ children, style, type, disabled, onClick }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button style={style} type={type} disabled={disabled} onClick={onClick}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...(actual as object),
    useQuery:       vi.fn().mockReturnValue({ data: undefined, isLoading: false, isError: false }),
    useMutation:    vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('../api', () => ({
  getValoraciones: vi.fn().mockResolvedValue([]),
  postValoracion:  vi.fn(),
  getUsuario:      vi.fn().mockResolvedValue({ user: {} }),
  updatePerfil:    vi.fn(),
  cambiarPassword: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────
import { SecurityBadge } from '../components/SecurityBadge';
import { SkeletonCard }  from '../components/SkeletonCard';
import { SplashScreen }  from '../components/SplashScreen';
import { StarRating }    from '../components/StarRating';
import UserProfile       from '../components/UserProfile';

const mockUser = {
  id: 1, username: 'test', email: 'test@test.com',
  nombre: 'Test User', role: 'standard', avatar: null,
  direccion: '', telefono: '', idioma: 'es' as const,
};

// ── SecurityBadge ──────────────────────────────────────────────────
describe('SecurityBadge', () => {
  it('renderiza "Secure"', () => {
    render(<SecurityBadge />);
    expect(screen.getByText('Secure')).toBeInTheDocument();
  });
  it('tiene el title correcto', () => {
    render(<SecurityBadge />);
    expect(screen.getByTitle(/TLS/i)).toBeInTheDocument();
  });
});

// ── SkeletonCard ───────────────────────────────────────────────────
describe('SkeletonCard', () => {
  it('renderiza el skeleton sin errores', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelector('.skeleton-card')).toBeInTheDocument();
  });
});

// ── SplashScreen ───────────────────────────────────────────────────
describe('SplashScreen', () => {
  it('muestra el nombre de la marca', () => {
    render(<SplashScreen onDone={vi.fn()} />);
    expect(screen.getByText('Kratamex')).toBeInTheDocument();
  });
  it('llama a onDone después del timeout', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<SplashScreen onDone={onDone} />);
    vi.advanceTimersByTime(2100);
    expect(onDone).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

// ── StarRating ─────────────────────────────────────────────────────
describe('StarRating', () => {
  it('renderiza 5 estrellas', () => {
    const { container } = render(<StarRating rating={3} />);
    // 5 span wrappers (one per star position)
    const spans = container.querySelectorAll('span[style*="position: relative"]');
    expect(spans.length).toBe(5);
  });
  it('acepta rating 0 sin errores', () => {
    expect(() => render(<StarRating rating={0} />)).not.toThrow();
  });
  it('acepta rating fuera de rango sin errores', () => {
    expect(() => render(<StarRating rating={10} />)).not.toThrow();
  });
  it('muestra count cuando se proporciona', () => {
    render(<StarRating rating={4} count={12} />);
    expect(screen.getByText('(12)')).toBeInTheDocument();
  });
});

// ── UserProfile ────────────────────────────────────────────────────
describe('UserProfile', () => {
  it('renderiza el perfil del usuario sin errores', () => {
    render(
      <MemoryRouter>
        <UserProfile user={mockUser} />
      </MemoryRouter>,
    );
    expect(document.body).toBeInTheDocument();
  });
  it('muestra el nombre del usuario', () => {
    render(
      <MemoryRouter>
        <UserProfile user={mockUser} />
      </MemoryRouter>,
    );
    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
  });
});
