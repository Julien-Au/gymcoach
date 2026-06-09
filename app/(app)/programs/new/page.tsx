import Link from 'next/link';
import { ChevronLeft, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProgramCreateForm } from '@/components/programs/program-create-form';

export default function NewProgramPage() {
  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link href="/programs">
            <ChevronLeft className="size-4" />
            <span className="ml-1">Back</span>
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">New program</h1>

        <Card>
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div className="flex min-w-0 items-start gap-3">
              <LayoutTemplate className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Start from a template</p>
                <p className="text-xs text-muted-foreground">
                  Run an established program (5/3/1, GZCLP, nSuns, PPL, Upper/Lower)
                  as written.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="min-h-tap shrink-0">
              <Link href="/programs/new/template">Browse</Link>
            </Button>
          </CardContent>
        </Card>

        <ProgramCreateForm />
      </div>
    </main>
  );
}
