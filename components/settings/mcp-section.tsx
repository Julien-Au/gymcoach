'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, KeyRound, Loader2, Plug, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export interface McpTokenSummary {
  id: string;
  name: string;
  tokenPrefix: string;
  canWrite: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Props {
  initialTokens: McpTokenSummary[];
}

export function McpSection({ initialTokens }: Props) {
  const t = useTranslations('settings.mcp');
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState('ChatGPT');
  const [canWrite, setCanWrite] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [connectorUrl, setConnectorUrl] = useState<string | null>(null);

  async function createToken() {
    setCreating(true);
    try {
      const res = await fetch('/api/mcp-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, canWrite }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        token?: McpTokenSummary;
        connectorUrl?: string;
      };
      if (!res.ok || !body.token || !body.connectorUrl) {
        throw new Error(body.error ?? t('createError'));
      }
      setTokens((current) => [body.token!, ...current]);
      setConnectorUrl(body.connectorUrl);
      toast.success(t('created'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('createError'));
    } finally {
      setCreating(false);
    }
  }

  async function revokeToken(id: string) {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/mcp-tokens/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(t('revokeError'));
      setTokens((current) => current.filter((token) => token.id !== id));
      toast.success(t('revoked'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('revokeError'));
    } finally {
      setRevokingId(null);
    }
  }

  async function copyConnectorUrl() {
    if (!connectorUrl) return;
    await navigator.clipboard.writeText(connectorUrl);
    toast.success(t('copied'));
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Plug className="size-4" />
          {t('title')}
        </h2>
        <p className="text-xs text-muted-foreground">{t('description')}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t('keyName')}</span>
            <Input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
          </label>
          <Button onClick={createToken} disabled={creating || name.trim().length === 0}>
            {creating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            <span className="ml-2">{t('create')}</span>
          </Button>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">{t('writeAccess')}</p>
            <p className="text-xs text-muted-foreground">{t('writeAccessDescription')}</p>
          </div>
          <Switch checked={canWrite} onCheckedChange={setCanWrite} />
        </label>

        {connectorUrl && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3">
            <p className="text-sm font-medium">{t('readyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('readyDescription')}</p>
            <div className="mt-3 flex gap-2">
              <Input value={connectorUrl} readOnly className="min-w-0 font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyConnectorUrl}
                title={t('copy')}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <p className="text-sm font-medium">{t('activeKeys')}</p>
          {tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noKeys')}</p>
          ) : (
            tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{token.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{token.tokenPrefix}</p>
                  <p className="text-xs text-muted-foreground">
                    {token.canWrite ? t('readWrite') : t('readOnly')}
                    {token.lastUsedAt
                      ? ` · ${t('lastUsed', { date: new Date(token.lastUsedAt).toLocaleDateString() })}`
                      : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => revokeToken(token.id)}
                  disabled={revokingId === token.id}
                  title={t('revoke')}
                >
                  {revokingId === token.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
