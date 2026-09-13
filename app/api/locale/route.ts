import { NextRequest, NextResponse } from 'next/server';
import { isLocale, localeCookieMaxAge, localeCookieName, type Locale } from '@/i18n/config';

function requestUsesHttps(request: NextRequest): boolean {
  const forwardedProtocol = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase();

  return forwardedProtocol ? forwardedProtocol === 'https' : request.nextUrl.protocol === 'https:';
}

export async function POST(request: NextRequest) {
  let body: { locale?: Locale };
  try {
    body = (await request.json()) as { locale?: Locale };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  if (!isLocale(body.locale)) {
    return NextResponse.json({ error: 'Unsupported locale.' }, { status: 400 });
  }

  const response = NextResponse.json(
    { locale: body.locale },
    { headers: { 'Cache-Control': 'no-store' } },
  );
  response.cookies.set(localeCookieName, body.locale, {
    path: '/',
    maxAge: localeCookieMaxAge,
    sameSite: 'lax',
    secure: requestUsesHttps(request),
  });

  return response;
}
