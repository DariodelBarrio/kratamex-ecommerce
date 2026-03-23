import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ForgotPassword from '../components/ForgotPassword';

// ── Setup fetch mock ───────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function renderFP() {
  return render(<MemoryRouter><ForgotPassword /></MemoryRouter>);
}

describe('ForgotPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza el formulario correctamente', () => {
    renderFP();
    expect(screen.getByPlaceholderText(/correo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument();
  });

  it('muestra error si se envía con email vacío', async () => {
    renderFP();
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    // Error exact text: 'Introduce tu email' (distinto del subtítulo que tiene más texto)
    await waitFor(() => expect(screen.getByText('Introduce tu email')).toBeInTheDocument());
  });

  it('muestra la pantalla de éxito tras envío correcto', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn() });
    renderFP();

    fireEvent.change(screen.getByPlaceholderText(/correo/i), { target: { value: 'test@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(screen.getByText(/enviado/i)).toBeInTheDocument());
  });

  it('muestra error cuando la API responde con error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: 'Error al enviar' }),
    });
    renderFP();

    fireEvent.change(screen.getByPlaceholderText(/correo/i), { target: { value: 'test@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(screen.getByText('Error al enviar')).toBeInTheDocument());
  });

  it('muestra error de conexión cuando fetch falla', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    renderFP();

    fireEvent.change(screen.getByPlaceholderText(/correo/i), { target: { value: 'test@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(screen.getByText(/conexión/i)).toBeInTheDocument());
  });

  it('envía también al pulsar Enter en el input', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn() });
    renderFP();

    const input = screen.getByPlaceholderText(/correo/i);
    fireEvent.change(input, { target: { value: 'test@test.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  });
});
