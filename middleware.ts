import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';

// Routes reachable without a valid session.
// /api/auth/logout is public: replaying it without a cookie does nothing
// harmful and lets the client clear state even if the JWT has expired.
const PUBLIC_PATHS = new Set([
  '/login',
  '/signup',
  '/mcp',
  '/mcp/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (isPublic) {
    // Already signed in and visiting /login or /signup: send to the dashboard.
    if (session && (pathname === '/login' || pathname === '/signup')) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!session) {
    // API: 401 JSON. Pages: redirect to /login.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Exclude static resources and PWA assets.
    '/((?!_next/static|_next/image|icons|manifest.json|favicon.ico|sw.js|workbox-).*)',
  ],
};
