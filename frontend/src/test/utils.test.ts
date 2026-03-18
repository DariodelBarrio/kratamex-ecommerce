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
});
