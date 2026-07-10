import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/shared/theme-provider';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.metadata');

  return {
    title: 'GymCoach',
    description: t('description'),
    applicationName: 'GymCoach',
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'GymCoach',
    },
    icons: {
      icon: [
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: '/icons/apple-touch-icon.png',
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  // Dark mode by default (locker rooms), togglable via next-themes (/settings page
  // or button in the header).
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            {children}
            <Toaster richColors position="top-center" />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
