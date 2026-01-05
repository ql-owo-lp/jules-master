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

  if (basicAuthUser && basicAuthPassword) {
    const authHeader = req.headers.get('authorization');

    if (authHeader) {
      try {
        const authValue = authHeader.split(' ')[1];
        if (!authValue) {
            throw new Error('Missing auth value');
        }

        // Create the expected Base64 string: "user:password"
        // In Node/Next.js Edge, btoa is available.
        const expectedValue = btoa(`${basicAuthUser}:${basicAuthPassword}`);

        if (secureCompare(authValue, expectedValue)) {
          return NextResponse.next();
        }
      } catch (e) {
        console.error('Basic Auth error:', e);
      }
    }

    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  return NextResponse.next();
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
