
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { middleware } from '../src/middleware';
import { NextRequest } from 'next/server';

describe('Middleware Security Headers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return security headers on success', () => {
    const req = new NextRequest('http://localhost:3000/');
    const res = middleware(req);

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Security-Policy')).toBeDefined();
  });

  it('should return 401 and security headers when Basic Auth fails', () => {
    process.env.BASIC_AUTH_USER = 'admin';
    process.env.BASIC_AUTH_PASSWORD = 'password';

    const req = new NextRequest('http://localhost:3000/');
    // No Authorization header
    const res = middleware(req);

    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe('Basic realm="Secure Area"');

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Content-Security-Policy')).toBeDefined();
  });
});
