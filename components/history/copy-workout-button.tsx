'use client';

import { useTranslations } from 'next-intl';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface Props {
  text: string;
}

// The Clipboard API needs a secure context, which a self-hosted instance
// reached over plain http on a LAN is not; the hidden-textarea copy still
// works there (issue #405).
function legacyCopy(text: string): boolean {
  // Selecting the textarea moves focus to it; give it back afterwards so a
  // keyboard or screen-reader user stays on the button.
  const previousFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '0';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  // iOS Safari ignores select() on a readonly textarea.
  area.setSelectionRange(0, text.length);
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
    previousFocus?.focus();
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or insecure context: fall through to the legacy path.
  }
  return legacyCopy(text);
}

export function CopyWorkoutButton({ text }: Props) {
  const t = useTranslations('history.copy');

  async function handleCopy() {
    if (await copyText(text)) toast.success(t('copied'));
    else toast.error(t('error'));
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      <Copy className="size-4" />
      <span className="ml-1">{t('button')}</span>
    </Button>
  );
}
