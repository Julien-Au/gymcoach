import { cookies } from 'next/headers';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// Helpers JWT côté serveur (jose, edge-compatible).
// Le middleware tourne sur l'edge runtime donc Prisma est inutilisable
// directement : la vérif de session ne fait que valider la signature
// et lit les claims (userId, email). Toute lookup en DB se fait côté
// server components / API routes (Node runtime).

export const SESSION_COOKIE = 'gymcoach-session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET manquant ou trop court (min 32 chars).');
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

// À appeler dans les server components / API routes (Node runtime).
export async function getCurrentSession(): Promise<SessionClaims | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
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

// Raccourci utile dans les API routes : retourne le userId ou null.
// Le middleware bloque déjà les routes protégées avec un 401 JSON,
// mais on garde cette défense côté handler pour les cas edge (token expiré
// entre la vérif middleware et l'arrivée ici, ou route oubliée du matcher).
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
