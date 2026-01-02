import { NextRequest, NextResponse } from 'next/server';

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

        const decoded = atob(authValue);
        const separatorIndex = decoded.indexOf(':');

        if (separatorIndex === -1) {
             throw new Error('Invalid format');
        }

        const user = decoded.substring(0, separatorIndex);
        const pwd = decoded.substring(separatorIndex + 1);

        if (user === basicAuthUser && pwd === basicAuthPassword) {
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
