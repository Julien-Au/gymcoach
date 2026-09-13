import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/locale/route';

function request(url: string, locale: string, forwardedProtocol?: string) {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(forwardedProtocol ? { 'x-forwarded-proto': forwardedProtocol } : {}),
    },
    body: JSON.stringify({ locale }),
  });
}

describe('POST /api/locale', () => {
  it('sets a non-secure cookie for the local HTTP panel', async () => {
    const response = await POST(request('http://gymcoach.local:3030/api/locale', 'ru'));
    const cookie = response.headers.get('set-cookie');

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(cookie).toContain('gymcoach.locale=ru');
    expect(cookie).not.toContain('Secure');
  });

  it('sets a secure cookie behind the public HTTPS proxy', async () => {
    const response = await POST(
      request('http://gymcoach.internal:3030/api/locale', 'en', 'https'),
    );
    const cookie = response.headers.get('set-cookie');

    expect(response.status).toBe(200);
    expect(cookie).toContain('gymcoach.locale=en');
    expect(cookie).toContain('Secure');
  });

  it('rejects malformed JSON without setting a locale cookie', async () => {
    const response = await POST(
      new NextRequest('https://gymcoach.example/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects unsupported locales', async () => {
    const response = await POST(request('https://gymcoach.example/api/locale', 'de'));
    expect(response.status).toBe(400);
  });
});
