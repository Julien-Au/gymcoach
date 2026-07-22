'use server';

import { cookies } from 'next/headers';
import {
  isLocale,
  localeCookieMaxAge,
  localeCookieName,
  type Locale,
} from './config';

export async function setUserLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) {
    throw new Error('Unsupported locale');
  }

  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, locale, {
    path: '/',
    maxAge: localeCookieMaxAge,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}
