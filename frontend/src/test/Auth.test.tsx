import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ──────────────────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div:    ({ children, style }: React.HTMLAttributes<HTMLDivElement>) => <div style={style}>{children}</div>,
    button: ({ children, onClick, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      <button onClick={onClick} disabled={disabled}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../api', () => ({
  login:    vi.fn(),
  register: vi.fn(),
}));

import { login, register } from '../api';
import Auth from '../components/Auth';

// ── Helper ─────────────────────────────────────────────────────────
function renderAuth(props: Partial<React.ComponentProps<typeof Auth>> = {}) {
  return render(
    <MemoryRouter>
      <Auth onAuth={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────
describe('Auth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza el formulario de login por defecto', () => {
    renderAuth();
    expect(screen.getByPlaceholderText(/usuario/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/contraseña/i)).toBeInTheDocument();
  });

  it('renderiza en modo register cuando defaultMode="register"', () => {
    renderAuth({ defaultMode: 'register' });
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
  });

  it('muestra error cuando el login falla', async () => {
    vi.mocked(login).mockRejectedValueOnce(new Error('Credenciales incorrectas'));
    renderAuth();

    fireEvent.change(screen.getByPlaceholderText(/usuario/i), { target: { value: 'user' } });
    fireEvent.change(screen.getByPlaceholderText(/contraseña/i), { target: { value: 'pass' } });
    fireEvent.submit(screen.getByRole('button', { name: /iniciar|entrar|login/i }));

    await waitFor(() =>
      expect(screen.getByText('Credenciales incorrectas')).toBeInTheDocument(),
    );
  });

  it('llama a onAuth tras login exitoso', async () => {
    const onAuth = vi.fn();
    vi.mocked(login).mockResolvedValueOnce({ token: 'tok', user: { id: 1, username: 'admin', role: 'admin' } });
    renderAuth({ onAuth });

    fireEvent.change(screen.getByPlaceholderText(/usuario/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText(/contraseña/i), { target: { value: 'admin123' } });
    fireEvent.submit(screen.getByRole('button', { name: /iniciar|entrar|login/i }));

    await waitFor(() => expect(onAuth).toHaveBeenCalledWith({ token: 'tok', user: expect.any(Object) }));
  });

  it('cambia a modo register al hacer toggle', async () => {
    renderAuth();
    // El botón de toggle usa t('auth.registerHere') = "Regístrate aquí"
    const toggle = screen.getByRole('button', { name: /Regístrate/i });
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument());
  });

  it('muestra error genérico cuando el error no tiene mensaje', async () => {
    vi.mocked(login).mockRejectedValueOnce(new Error());
    renderAuth();

    fireEvent.change(screen.getByPlaceholderText(/usuario/i), { target: { value: 'u' } });
    fireEvent.change(screen.getByPlaceholderText(/contraseña/i), { target: { value: 'p' } });
    fireEvent.submit(screen.getByRole('button', { name: /iniciar|entrar|login/i }));

    await waitFor(() => expect(screen.getByText(/error/i)).toBeInTheDocument());
  });

  it('en modo register llama a register() con los datos del formulario', async () => {
    const onAuth = vi.fn();
    vi.mocked(register).mockResolvedValueOnce({ token: 'tok2', user: { id: 2, username: 'nuevo', role: 'standard' } });
    renderAuth({ defaultMode: 'register', onAuth });

    fireEvent.change(screen.getByPlaceholderText(/usuario/i), { target: { value: 'nuevo' } });
    fireEvent.change(screen.getByPlaceholderText(/contraseña/i), { target: { value: 'pass1234' } });
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'nuevo@test.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /crear|registr/i }));

    await waitFor(() => expect(onAuth).toHaveBeenCalled());
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ username: 'nuevo', email: 'nuevo@test.com' }));
  });
});
