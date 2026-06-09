import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { TemplatePicker } from '@/components/programs/template-picker';
import { programTemplates } from '@/lib/programs/templates';

export default async function TemplateProgramPage() {
  await requireSession();

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link href="/programs/new">
            <ChevronLeft className="size-4" />
            <span className="ml-1">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Start from a template</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Instantiate a well-known program as written. The AI coach advises
            within it - it will not silently restructure your program.
          </p>
        </div>
        <TemplatePicker templates={programTemplates} />
      </div>
    </main>
  );
}
