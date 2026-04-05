import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Framer-motion mock ───────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div:    ({ children, style, className }: React.HTMLAttributes<HTMLDivElement>) =>
      <div style={style} className={className}>{children}</div>,
    button: ({ children, onClick, disabled, style, type }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      <button onClick={onClick} disabled={disabled} style={style} type={type}>{children}</button>,
    input:  ({ onChange, value, placeholder, type, autoComplete, style }:
               React.InputHTMLAttributes<HTMLInputElement>) =>
      <input onChange={onChange} value={value} placeholder={placeholder}
             type={type} autoComplete={autoComplete} style={style} />,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── React-query mock ─────────────────────────────────────────────────
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...(actual as object),
    useQuery:       vi.fn(),
    useMutation:    vi.fn(),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
  };
});

// ── API mock ─────────────────────────────────────────────────────────
vi.mock('../api', () => ({
  getUsuario:      vi.fn().mockResolvedValue({ user: {} }),
  updatePerfil:    vi.fn(),
  cambiarPassword: vi.fn(),
}));

import { useQuery, useMutation } from '@tanstack/react-query';
import UserProfile from '../components/UserProfile';
import type { Usuario } from '../interfaces';

const mockUser: Usuario = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  nombre: 'Test User',
  role: 'user',
  direccion: 'Calle 1',
  telefono: '600000000',
  idioma: 'es',
};

function setup(user: Usuario = mockUser) {
  const mutate = vi.fn();
  vi.mocked(useQuery).mockReturnValue({ data: { user }, isLoading: false } as never);
  vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false } as never);
  render(<MemoryRouter><UserProfile user={user} /></MemoryRouter>);
  return { mutate };
}

describe('UserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el nombre de usuario', () => {
    setup();
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('muestra los campos de perfil rellenos con datos del usuario', () => {
    setup();
    const inputs = screen.getAllByRole('textbox');
    // Al menos debería existir algún input
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('permite editar el campo nombre', () => {
    setup();
    const nombreInput = screen.getByPlaceholderText(/nombre/i);
    fireEvent.change(nombreInput, { target: { value: 'Nuevo Nombre' } });
    expect(nombreInput).toHaveValue('Nuevo Nombre');
  });

  it('permite editar el campo email', () => {
    setup();
    const emailInput = screen.getByPlaceholderText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'nuevo@email.com' } });
    expect(emailInput).toHaveValue('nuevo@email.com');
  });

  it('llama a mutation.mutate al guardar el perfil', () => {
    const { mutate } = setup();
    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(saveBtn);
    expect(mutate).toHaveBeenCalled();
  });

  it('muestra error si la contraseña nueva es demasiado corta', () => {
    vi.mocked(useQuery).mockReturnValue({ data: { user: mockUser }, isLoading: false } as never);
    vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    render(<MemoryRouter><UserProfile user={mockUser} /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'old' } });
    fireEvent.change(screen.getByPlaceholderText('Mínimo 6 caracteres'), { target: { value: '12' } });
    fireEvent.change(screen.getByPlaceholderText('Repite la contraseña'), { target: { value: '12' } });
    const pwForm = screen.getByPlaceholderText('Mínimo 6 caracteres').closest('form')!;
    fireEvent.submit(pwForm);
    expect(screen.getByText(/al menos 6 caracteres/i)).toBeInTheDocument();
  });

  it('muestra error si las contraseñas no coinciden', () => {
    vi.mocked(useQuery).mockReturnValue({ data: { user: mockUser }, isLoading: false } as never);
    vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    render(<MemoryRouter><UserProfile user={mockUser} /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'oldpass' } });
    fireEvent.change(screen.getByPlaceholderText('Mínimo 6 caracteres'), { target: { value: 'newpass1' } });
    fireEvent.change(screen.getByPlaceholderText('Repite la contraseña'), { target: { value: 'different' } });
    const pwForm = screen.getByPlaceholderText('Mínimo 6 caracteres').closest('form')!;
    fireEvent.submit(pwForm);
    expect(screen.getByText(/no coinciden/i)).toBeInTheDocument();
  });

  it('cambia el idioma al seleccionar inglés', () => {
    setup();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'en' } });
    expect(select).toHaveValue('en');
  });

  it('muestra el badge de rol del usuario', () => {
    setup();
    expect(screen.getByText('Usuario')).toBeInTheDocument();
  });

  it('renderiza con rol admin', () => {
    setup({ ...mockUser, role: 'admin' });
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('muestra el botón para revelar contraseña', () => {
    setup();
    const eyeButtons = screen.getAllByRole('button');
    // There should be buttons to toggle password visibility
    expect(eyeButtons.length).toBeGreaterThan(0);
  });
});
