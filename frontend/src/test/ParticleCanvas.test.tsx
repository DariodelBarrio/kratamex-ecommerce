import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ParticleCanvas } from '../components/ParticleCanvas';

// Mock canvas context
const mockCtx = {
  clearRect:   vi.fn(),
  beginPath:   vi.fn(),
  arc:         vi.fn(),
  fill:        vi.fn(),
  moveTo:      vi.fn(),
  lineTo:      vi.fn(),
  stroke:      vi.fn(),
  fillStyle:   '',
  strokeStyle: '',
  lineWidth:   0,
};

const mockCanvas = {
  getContext:       vi.fn(() => mockCtx),
  getBoundingClientRect: vi.fn(() => ({ width: 800, height: 600 })),
  parentElement: null as HTMLElement | null,
  width:  0,
  height: 0,
};

// Mock ResizeObserver as a class constructor
const mockObserve    = vi.fn();
const mockDisconnect = vi.fn();
vi.stubGlobal('ResizeObserver', class {
  observe    = mockObserve;
  disconnect = mockDisconnect;
});

// Mock requestAnimationFrame / cancelAnimationFrame
vi.stubGlobal('requestAnimationFrame', vi.fn(() => 42));
vi.stubGlobal('cancelAnimationFrame', vi.fn());

// Mock crypto.getRandomValues
vi.stubGlobal('crypto', {
  getRandomValues: (arr: Uint32Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 0x100000000);
    return arr;
  },
});

describe('ParticleCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Patch HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as unknown as CanvasRenderingContext2D);
  });

  it('renderiza un elemento canvas', () => {
    const { container } = render(<ParticleCanvas />);
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('el canvas tiene la clase hero-particles', () => {
    const { container } = render(<ParticleCanvas />);
    expect(container.querySelector('.hero-particles')).toBeInTheDocument();
  });

  it('llama a getContext("2d") al montar', () => {
    render(<ParticleCanvas />);
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d');
  });

  it('cancela la animación al desmontar', () => {
    const { unmount } = render(<ParticleCanvas />);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('desconecta el ResizeObserver al desmontar', () => {
    const { unmount } = render(<ParticleCanvas />);
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
