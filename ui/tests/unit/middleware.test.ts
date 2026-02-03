
import { describe, it, expect, vi } from 'vitest';
import { middleware } from '../../src/middleware';
import { NextRequest } from 'next/server';

// Mock process.env
process.env.BASIC_AUTH_USER = 'admin';
process.env.BASIC_AUTH_PASSWORD = 'password123';

describe('Middleware Basic Auth', () => {
  it('should allow access with correct credentials', async () => {
    const req = new NextRequest('http://localhost/', {
      headers: {
        authorization: 'Basic ' + btoa('admin:password123'),
      },
    });

    const res = await middleware(req);
    // NextResponse.next() returns a response with status 200 (usually, or it continues).
    // Actually middleware returns a response object.
    // If it allows, it returns NextResponse.next() which usually has a status but it's a bit special.
    // Let's check if it returns 401.
    expect(res.status).not.toBe(401);
  });

  it('should deny access with incorrect password', async () => {
    const req = new NextRequest('http://localhost/', {
      headers: {
        authorization: 'Basic ' + btoa('admin:wrong'),
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(401);
  });

  it('should deny access with incorrect username', async () => {
    const req = new NextRequest('http://localhost/', {
      headers: {
        authorization: 'Basic ' + btoa('wrong:password123'),
      },
    });

    const res = await middleware(req);
    expect(res.status).toBe(401);
  });

  it('should deny access with malformed header', async () => {
    const req = new NextRequest('http://localhost/', {
        headers: {
          authorization: 'Basic notbase64',
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(401);
  });

  it('should set security headers', async () => {
    const req = new NextRequest('http://localhost/', {
      headers: {
        authorization: 'Basic ' + btoa('admin:password123'),
      },
    });

    const res = await middleware(req);
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
    expect(res.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=(), browsing-topics=()');

    const csp = res.headers.get('Content-Security-Policy') || '';
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });
});
