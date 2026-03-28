import { describe, it, expect } from 'vitest';
import { sanitize } from '../utils';

describe('sanitize', () => {
  it('should return empty string for null input', () => {
    expect(sanitize(null)).toBe('');
  });

  it('should return empty string for undefined input', () => {
    expect(sanitize(undefined)).toBe('');
  });

  it('should return the string as is when no HTML tags', () => {
    expect(sanitize('Hello World')).toBe('Hello World');
  });

  it('should remove HTML tags', () => {
    expect(sanitize('<script>alert("xss")</script>Hello')).toBe('Hello');
  });

  it('should handle mixed content', () => {
    expect(sanitize('<b>Hello</b> World')).toBe('Hello World');
  });

  it('should escape ampersands', () => {
    expect(sanitize('a & b')).toBe('a &amp; b');
  });

  it('should escape double quotes', () => {
    expect(sanitize('"hello"')).toBe('&quot;hello&quot;');
  });

  it('should escape single quotes', () => {
    expect(sanitize("it's")).toBe('it&#039;s');
  });

  it('should escape < not followed by >', () => {
    expect(sanitize('a < b')).toBe('a &lt; b');
  });

  it('should escape > not preceded by <', () => {
    expect(sanitize('a > b')).toBe('a &gt; b');
  });

  it('should remove script tags with content', () => {
    expect(sanitize('<script src="x.js">evil()</script>clean')).toBe('clean');
  });

  it('should return empty string for empty string', () => {
    expect(sanitize('')).toBe('');
  });
});
