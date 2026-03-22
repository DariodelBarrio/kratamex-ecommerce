import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
});

describe('API module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(store).forEach(k => delete store[k]);
  });

  it('login calls /api/login with POST', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'abc', user: { id: 1, username: 'admin' } }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const { login } = await import('../api');
    const result = await login('admin', 'admin123');
    expect(result.token).toBe('abc');
    expect(mockFetch).toHaveBeenCalledWith('/api/login', expect.objectContaining({ method: 'POST' }));
  });

  it('register calls /api/register with POST', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'xyz', user: { id: 2, username: 'newuser' } }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const { register } = await import('../api');
    const result = await register({ username: 'newuser', password: 'pass123', email: 'test@test.com' });
    expect(result.token).toBe('xyz');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Credenciales incorrectas' }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const { login } = await import('../api');
    await expect(login('bad', 'bad')).rejects.toThrow('Credenciales incorrectas');
  });

  it('includes auth header when token exists', async () => {
    store['kratamex_token'] = 'mytoken';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const { getMisPedidos } = await import('../api');
    await getMisPedidos();
    const call = mockFetch.mock.calls[0];
    expect(call[1].headers.Authorization).toBe('mytoken');
  });
});
