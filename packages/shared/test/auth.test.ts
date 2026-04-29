import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  sessionExpiresAt,
} from '../src/auth/index.js';

describe('password utilities', () => {
  it('hashPassword returns a bcrypt hash with $2b$ prefix and 60 chars', async () => {
    const hash = await hashPassword('testpassword');
    expect(hash).toMatch(/^\$2b\$/);
    expect(hash).toHaveLength(60);
  });

  it('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('correctpassword');
    const result = await verifyPassword('correctpassword', hash);
    expect(result).toBe(true);
  });

  it('verifyPassword returns false for incorrect password', async () => {
    const hash = await hashPassword('correctpassword');
    const result = await verifyPassword('wrongpassword', hash);
    expect(result).toBe(false);
  });

  it('verifyPassword returns false for empty password against valid hash', async () => {
    const hash = await hashPassword('somepassword');
    const result = await verifyPassword('', hash);
    expect(result).toBe(false);
  });

  it('hashPassword handles empty string', async () => {
    const hash = await hashPassword('');
    expect(hash).toMatch(/^\$2b\$/);
    expect(hash).toHaveLength(60);
    const result = await verifyPassword('', hash);
    expect(result).toBe(true);
  });

  it('hashPassword handles unicode characters', async () => {
    const hash = await hashPassword('пароль🔒');
    expect(hash).toMatch(/^\$2b\$/);
    const result = await verifyPassword('пароль🔒', hash);
    expect(result).toBe(true);
  });
});

describe('session token utilities', () => {
  it('generateSessionToken returns a base64url string of exactly 43 characters', () => {
    const token = generateSessionToken();
    expect(token).toHaveLength(43);
    // base64url charset: A-Z, a-z, 0-9, -, _
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('two calls to generateSessionToken produce different tokens', () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();
    expect(token1).not.toBe(token2);
  });

  it('generateSessionToken does not include padding characters', () => {
    const token = generateSessionToken();
    expect(token).not.toContain('=');
  });

  it('generateSessionToken produces consistent length across multiple calls', () => {
    for (let i = 0; i < 10; i++) {
      const token = generateSessionToken();
      expect(token).toHaveLength(43);
    }
  });
});

describe('session expiry utilities', () => {
  it('sessionExpiresAt returns an ISO 8601 timestamp 30 days in the future by default', () => {
    const now = new Date();
    const expiry = sessionExpiresAt();
    const expiryDate = new Date(expiry);

    // Check it's a valid ISO string
    expect(expiry).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // Check it's approximately 30 days in the future (within 1 minute tolerance)
    const expectedMs = now.getTime() + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiryDate.getTime() - expectedMs)).toBeLessThan(60000);
  });

  it('sessionExpiresAt(7) returns an ISO 8601 timestamp 7 days in the future', () => {
    const now = new Date();
    const expiry = sessionExpiresAt(7);
    const expiryDate = new Date(expiry);

    // Check it's approximately 7 days in the future (within 1 minute tolerance)
    const expectedMs = now.getTime() + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiryDate.getTime() - expectedMs)).toBeLessThan(60000);
  });

  it('sessionExpiresAt(1) returns tomorrow', () => {
    const now = new Date();
    const expiry = sessionExpiresAt(1);
    const expiryDate = new Date(expiry);

    const expectedMs = now.getTime() + 1 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiryDate.getTime() - expectedMs)).toBeLessThan(60000);
  });

  it('sessionExpiresAt(0) returns approximately now', () => {
    const now = new Date();
    const expiry = sessionExpiresAt(0);
    const expiryDate = new Date(expiry);

    expect(Math.abs(expiryDate.getTime() - now.getTime())).toBeLessThan(60000);
  });
});
