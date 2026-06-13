import { cookies } from 'next/headers';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// Server-side JWT helpers (jose, edge-compatible).
// The middleware runs on the edge runtime so Prisma cannot be used
// directly: session verification only validates the signature
// and reads the claims (userId, email). Any DB lookup happens in
// server components / API routes (Node runtime).

export const SESSION_COOKIE = 'gymcoach-session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET missing or too short (min 32 chars).');
  }
  return new TextEncoder().encode(secret);
}

export interface SessionClaims extends JWTPayload {
  userId: string;
  email: string;
}

export async function signSession(claims: { userId: string; email: string }): Promise<string> {
  return new SignJWT({ userId: claims.userId, email: claims.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.userId !== 'string' || typeof payload.email !== 'string') {
      return null;
    }
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

// To be called in server components / API routes (Node runtime).
export async function getCurrentSession(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireSession(): Promise<SessionClaims> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

// Handy shortcut in the API routes: returns the userId or null.
// The middleware already blocks protected routes with a 401 JSON,
// but we keep this handler-side guard for edge cases (token expired
// between the middleware check and arriving here, or a route missing
// from the matcher).
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.userId ?? null;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
  secure: process.env.NODE_ENV === 'production',
};
