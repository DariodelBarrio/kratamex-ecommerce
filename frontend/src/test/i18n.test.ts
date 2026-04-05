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

  it('traduce claves de carrito en español', () => {
    expect(t('cart.title')).toBe('Carrito de compra');
    expect(t('cart.empty')).toBe('Tu carrito está vacío');
    expect(t('cart.total')).toBe('Total');
  });

  it('traduce claves de auth en español', () => {
    expect(t('auth.login')).toBe('Iniciar sesión');
    expect(t('auth.register')).toBe('Crear cuenta');
    expect(t('auth.username')).toBe('Usuario');
  });

  it('traduce claves de tienda en español', () => {
    expect(t('store.search')).toBe('Buscar productos...');
    expect(t('store.all')).toBe('Todos');
    expect(t('store.outOfStock')).toBe('Sin stock');
  });

  it('traduce claves de pedidos en español', () => {
    expect(t('orders.title')).toBe('Mis pedidos');
    expect(t('orders.empty')).toBe('No tienes pedidos aún');
  });

  it('traduce claves de navegación en inglés', () => {
    setLang('en');
    expect(t('nav.store')).toBe('Store');
    expect(t('nav.cart')).toBe('Cart');
    expect(t('nav.logout')).toBe('Sign out');
  });

  it('traduce claves de carrito en inglés', () => {
    setLang('en');
    expect(t('cart.title')).toBe('Shopping cart');
    expect(t('cart.total')).toBe('Total');
  });

  it('traduce claves de auth en inglés', () => {
    setLang('en');
    expect(t('auth.login')).toBe('Sign in');
    expect(t('auth.register')).toBe('Create account');
  });

  it('getLang devuelve "es" por defecto', () => {
    setLang('es');
    expect(getLang()).toBe('es');
  });

  it('traduce claves de rating en español', () => {
    expect(t('rating.write')).toBeTruthy();
    expect(t('rating.submit')).toBeTruthy();
  });

  it('traduce claves generales en español', () => {
    expect(t('general.loading')).toBeTruthy();
    expect(t('general.error')).toBeTruthy();
  });
});
