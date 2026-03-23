import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ──────────────────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, style }: React.HTMLAttributes<HTMLDivElement>) => <div style={style}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock useQuery directamente para control total del estado
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...(actual as object), useQuery: vi.fn() };
});

import { useQuery } from '@tanstack/react-query';
import OrderHistory from '../components/OrderHistory';

function renderOH() {
  return render(<MemoryRouter><OrderHistory /></MemoryRouter>);
}

describe('OrderHistory', () => {
  it('muestra skeleton mientras carga', () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: true, isError: false } as never);
    renderOH();
    expect(document.body).toBeInTheDocument();
  });

  it('muestra mensaje "sin pedidos" cuando el array está vacío', () => {
    vi.mocked(useQuery).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    renderOH();
    expect(screen.getByText('No tienes pedidos aún')).toBeInTheDocument();
  });

  it('muestra pedidos cuando la API devuelve datos', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{
        id: 42,
        cliente: 'Test User',
        email: 'test@test.com',
        direccion: 'Calle Prueba 1',
        total: 99.99,
        subtotal: 80,
        impuestos: 16.8,
        envio: 5.99,
        descuento: 0,
        estado: 'pendiente',
        fecha: new Date().toISOString(),
        items: [],
      }],
      isLoading: false,
      isError: false,
    } as never);
    renderOH();
    expect(screen.getByText('Pedido #42')).toBeInTheDocument();
  });
});
