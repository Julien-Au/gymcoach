import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}

// Friendly placeholder shown when a page has no data yet. Keeps the Shadcn Card
// look and offers an optional call-to-action.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn(className)}>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        {Icon && (
          <div className="rounded-full bg-muted p-3 text-muted-foreground">
            <Icon className="size-6" />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <p className="text-base font-medium">{title}</p>
          {description && (
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action && (
          <Button asChild className="min-h-tap mt-1">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
