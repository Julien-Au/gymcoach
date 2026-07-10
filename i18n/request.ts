import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale, localeCookieName } from './config';
import { loadMessages } from './messages';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requestedLocale = cookieStore.get(localeCookieName)?.value;
  const locale = isLocale(requestedLocale) ? requestedLocale : defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
});
