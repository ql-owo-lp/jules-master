import { NextRequest, NextResponse } from 'next/server';

export async function secureCompare(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);

  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', aBuf),
    crypto.subtle.digest('SHA-256', bBuf)
  ]);

  const aView = new DataView(aHash);
  const bView = new DataView(bHash);

  let mismatch = 0;
  // SHA-256 is always 32 bytes
  for (let i = 0; i < aView.byteLength; i++) {
    mismatch |= aView.getUint8(i) ^ bView.getUint8(i);
  }

  return mismatch === 0;
}

export async function middleware(req: NextRequest) {
  const nonce = crypto.randomUUID();
  const basicAuthUser = process.env.BASIC_AUTH_USER;
  const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD;

  // Content Security Policy
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: https:;
    font-src 'self' https://fonts.gstatic.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  // Initialize response
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

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

            if (await secureCompare(authValue, expectedValue)) {
              authorized = true;
            }
        }
      } catch (e) {
        console.error('Basic Auth error:', e);
      }
    }

    if (!authorized) {
        response = new NextResponse('Authentication required', {
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
