import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from '../components/ResetPassword';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function renderRP(token?: string) {
  const url = token ? `/reset-password?token=${token}` : '/reset-password';
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ResetPassword />
    </MemoryRouter>,
  );
}

describe('ResetPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra "Enlace inválido" cuando no hay token en la URL', () => {
    renderRP();
    expect(screen.getByText(/enlace inválido/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /solicitar/i })).toBeInTheDocument();
  });

  it('muestra el formulario de nueva contraseña cuando hay token', () => {
    renderRP('abc123');
    expect(screen.getByPlaceholderText(/nueva contraseña/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/confirmar/i)).toBeInTheDocument();
  });

  it('muestra error si la contraseña está vacía', async () => {
    renderRP('abc123');
    fireEvent.click(screen.getByRole('button', { name: /establecer/i }));
    await waitFor(() => expect(screen.getByText('Introduce una contraseña')).toBeInTheDocument());
  });

  it('muestra error si la contraseña es menor de 8 caracteres', async () => {
    renderRP('abc123');
    fireEvent.change(screen.getByPlaceholderText(/nueva contraseña/i), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /establecer/i }));
    await waitFor(() => expect(screen.getByText('Mínimo 8 caracteres')).toBeInTheDocument());
  });

  it('muestra error si las contraseñas no coinciden', async () => {
    renderRP('abc123');
    fireEvent.change(screen.getByPlaceholderText(/nueva contraseña/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText(/confirmar/i), { target: { value: 'different456' } });
    fireEvent.click(screen.getByRole('button', { name: /establecer/i }));
    await waitFor(() => expect(screen.getByText(/no coinciden/i)).toBeInTheDocument());
  });

  it('muestra pantalla de éxito al restablecer correctamente', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) });
    renderRP('valid-token');

    fireEvent.change(screen.getByPlaceholderText(/nueva contraseña/i), { target: { value: 'nuevapass123' } });
    fireEvent.change(screen.getByPlaceholderText(/confirmar/i), { target: { value: 'nuevapass123' } });
    fireEvent.click(screen.getByRole('button', { name: /establecer/i }));

    await waitFor(() => expect(screen.getByText(/actualizada/i)).toBeInTheDocument());
  });

  it('muestra error cuando la API responde con error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: 'Enlace expirado' }),
    });
    renderRP('expired-token');

    fireEvent.change(screen.getByPlaceholderText(/nueva contraseña/i), { target: { value: 'nuevapass123' } });
    fireEvent.change(screen.getByPlaceholderText(/confirmar/i), { target: { value: 'nuevapass123' } });
    fireEvent.click(screen.getByRole('button', { name: /establecer/i }));

    await waitFor(() => expect(screen.getByText('Enlace expirado')).toBeInTheDocument());
  });

  it('muestra error de conexión cuando fetch falla', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network'));
    renderRP('tok');

    fireEvent.change(screen.getByPlaceholderText(/nueva contraseña/i), { target: { value: 'nuevapass123' } });
    fireEvent.change(screen.getByPlaceholderText(/confirmar/i), { target: { value: 'nuevapass123' } });
    fireEvent.click(screen.getByRole('button', { name: /establecer/i }));

    await waitFor(() => expect(screen.getByText(/conexión/i)).toBeInTheDocument());
  });

  it('envía al pulsar Enter en el campo confirmar', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ ok: true }) });
    renderRP('tok');

    fireEvent.change(screen.getByPlaceholderText(/nueva contraseña/i), { target: { value: 'nuevapass123' } });
    const confirm = screen.getByPlaceholderText(/confirmar/i);
    fireEvent.change(confirm, { target: { value: 'nuevapass123' } });
    fireEvent.keyDown(confirm, { key: 'Enter' });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  });
});
