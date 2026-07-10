import { LanguageSelector } from '@/components/shared/language-selector';

// Layout for authentication routes: no navbar, fullscreen.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="absolute right-3 top-3 z-10">
        <LanguageSelector showLabel />
      </div>
      {children}
    </div>
  );
}
