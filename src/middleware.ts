import { NextRequest, NextResponse } from 'next/server';

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function middleware(req: NextRequest) {
  const basicAuthUser = process.env.BASIC_AUTH_USER;
  const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD;

  // Initialize response
  let response = NextResponse.next();

  if (basicAuthUser && basicAuthPassword) {
    const authHeader = req.headers.get('authorization');

    let authorized = false;

    if (authHeader) {
      try {
        const authValue = authHeader.split(' ')[1];
        if (authValue) {
            // Create the expected Base64 string: "user:password"
            // In Node/Next.js Edge, btoa is available.
            const expectedValue = btoa(`${basicAuthUser}:${basicAuthPassword}`);

            if (secureCompare(authValue, expectedValue)) {
              authorized = true;
            }
        }
      } catch (e) {
        console.error('Basic Auth error:', e);
      }
    }

    if (!authorized) {
        return new NextResponse('Authentication required', {
            status: 401,
            headers: {
                'WWW-Authenticate': 'Basic realm="Secure Area"',
            },
        });
    }
  }

  // Security Headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=()');

  // Content Security Policy
  // This is a starting point and might need adjustment based on the application's needs (e.g., specific scripts, images)
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
