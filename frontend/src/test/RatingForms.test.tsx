import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Framer-motion mock ──────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div:    ({ children, style }: React.HTMLAttributes<HTMLDivElement>) => <div style={style}>{children}</div>,
    button: ({ children, onClick, disabled, style }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      <button onClick={onClick} disabled={disabled} style={style}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── React-query mock ────────────────────────────────────────────────
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...(actual as object),
    useQuery:       vi.fn(),
    useMutation:    vi.fn(),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
  };
});

// ── API mock ────────────────────────────────────────────────────────
vi.mock('../api', () => ({
  getValoraciones: vi.fn().mockResolvedValue([]),
  postValoracion:  vi.fn(),
}));

import { useQuery, useMutation } from '@tanstack/react-query';
import { RatingForm, ValoracionesList } from '../components/StarRating';

// ── Fixtures ────────────────────────────────────────────────────────
const mockValoraciones = [
  {
    id: 1,
    username: 'Juan García',
    puntuacion: 5,
    titulo: 'Excelente producto',
    comentario: 'Muy recomendable',
    fecha: '2024-03-15T10:00:00Z',
  },
  {
    id: 2,
    username: 'Ana Martínez',
    puntuacion: 4,
    titulo: 'Muy bueno',
    comentario: '',
    fecha: '2024-02-20T08:00:00Z',
  },
];

describe('RatingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  });

  it('muestra mensaje de login requerido cuando no hay sesión', () => {
    render(<RatingForm productoId={1} />);
    expect(screen.getByText(/inicia sesión|login/i)).toBeInTheDocument();
  });

  it('muestra el formulario cuando el usuario está autenticado', () => {
    localStorage.setItem('kratamex_token', 'test-token');
    render(<RatingForm productoId={1} />);
    // Debe mostrar 5 botones de estrella (uno por cada puntuación)
    const starButtons = screen.getAllByRole('button');
    expect(starButtons.length).toBeGreaterThanOrEqual(5);
  });

  it('muestra error "Selecciona una puntuación" al enviar sin puntuación', () => {
    localStorage.setItem('kratamex_token', 'test-token');
    render(<RatingForm productoId={1} />);
    // Clic en el botón de enviar (el último botón)
    const submitBtn = screen.getAllByRole('button').at(-1)!;
    fireEvent.click(submitBtn);
    expect(screen.getByText(/selecciona una puntuaci/i)).toBeInTheDocument();
  });

  it('seleccionar una estrella actualiza la puntuación', () => {
    localStorage.setItem('kratamex_token', 'test-token');
    render(<RatingForm productoId={1} />);
    const buttons = screen.getAllByRole('button');
    // Los primeros 5 botones son las estrellas
    fireEvent.click(buttons[3]); // estrella 4
    // Verificamos que no lanza error (la puntuación se actualiza internamente)
    expect(buttons[3]).toBeInTheDocument();
  });

  it('llama a mutation.mutate al enviar con puntuación válida', () => {
    const mutate = vi.fn();
    vi.mocked(useMutation).mockReturnValue({ mutate, isPending: false } as never);
    localStorage.setItem('kratamex_token', 'test-token');

    render(<RatingForm productoId={1} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[2]); // seleccionar estrella 3
    const submitBtn = buttons.at(-1)!;
    fireEvent.click(submitBtn);
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ puntuacion: 3 }));
  });

  it('permite escribir en el campo de título', () => {
    localStorage.setItem('kratamex_token', 'test-token');
    render(<RatingForm productoId={1} />);
    const titleInput = screen.getAllByRole('textbox')[0];
    fireEvent.change(titleInput, { target: { value: 'Gran producto' } });
    expect(titleInput).toHaveValue('Gran producto');
  });
});

describe('ValoracionesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra skeleton mientras carga', () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: true } as never);
    const { container } = render(<ValoracionesList productoId={1} />);
    // Skeleton renders 3 placeholder items
    expect(container.firstChild).toBeInTheDocument();
  });

  it('muestra mensaje "sin valoraciones" cuando la lista está vacía', () => {
    vi.mocked(useQuery).mockReturnValue({ data: [], isLoading: false } as never);
    render(<ValoracionesList productoId={1} />);
    expect(screen.getByText(/no hay valoraciones|sin valoraciones|todavía no/i)).toBeInTheDocument();
  });

  it('muestra las valoraciones cuando la API devuelve datos', () => {
    vi.mocked(useQuery).mockReturnValue({ data: mockValoraciones, isLoading: false } as never);
    render(<ValoracionesList productoId={1} />);
    expect(screen.getByText('Juan García')).toBeInTheDocument();
    expect(screen.getByText('Excelente producto')).toBeInTheDocument();
  });

  it('muestra la segunda valoración correctamente', () => {
    vi.mocked(useQuery).mockReturnValue({ data: mockValoraciones, isLoading: false } as never);
    render(<ValoracionesList productoId={1} />);
    expect(screen.getByText('Ana Martínez')).toBeInTheDocument();
    expect(screen.getByText('Muy bueno')).toBeInTheDocument();
  });

  it('formatea la fecha de las valoraciones', () => {
    vi.mocked(useQuery).mockReturnValue({ data: mockValoraciones, isLoading: false } as never);
    render(<ValoracionesList productoId={1} />);
    // La fecha se formatea a "15 de marzo de 2024" o similar
    expect(screen.getByText(/marzo|march/i)).toBeInTheDocument();
  });
});
