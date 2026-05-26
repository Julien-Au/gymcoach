import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';

// Routes accessibles sans session valide.
// /api/auth/logout est public : rejouer la requête sans cookie ne fait rien
// de méchant et permet de purger côté client même si le JWT a expiré.
const PUBLIC_PATHS = new Set(['/login', '/api/auth/login', '/api/auth/logout']);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (isPublic) {
    // Si déjà connecté et qu'on visite /login, on renvoie sur le dashboard.
    if (session && pathname === '/login') {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!session) {
    // API : 401 JSON. Pages : redirect vers /login.
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
    // On exclut les ressources statiques et les assets PWA.
    '/((?!_next/static|_next/image|icons|manifest.json|favicon.ico|sw.js|workbox-).*)',
  ],
};
