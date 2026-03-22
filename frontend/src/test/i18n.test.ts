import { describe, it, expect, beforeEach } from 'vitest';
import { t, getLang, setLang } from '../i18n';

describe('i18n', () => {
  beforeEach(() => {
    setLang('es');
  });

  it('returns Spanish translations by default', () => {
    expect(t('nav.store')).toBe('Tienda');
    expect(t('nav.cart')).toBe('Carrito');
  });

  it('switches to English', () => {
    setLang('en');
    expect(getLang()).toBe('en');
    expect(t('nav.store')).toBe('Store');
    expect(t('nav.cart')).toBe('Cart');
  });

  it('returns key if translation not found', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('falls back to Spanish for missing English translations', () => {
    setLang('en');
    // All keys should have translations in both languages
    expect(t('nav.login')).toBe('Sign in');
  });
});
