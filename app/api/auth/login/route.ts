import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { db } from '@/lib/db';
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Email ou mot de passe invalide.' }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const user = await db.user.findUnique({ where: { email } });

    // Message volontairement identique pour user inconnu et mauvais password
    // (évite l'énumération d'emails, même si on a 1 seul user).
    const invalid = NextResponse.json(
      { error: 'Identifiants invalides.' },
      { status: 401 },
    );

    if (!user) return invalid;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return invalid;

    const token = await signSession({ userId: user.id, email: user.email });
    cookies().set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[login] error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
