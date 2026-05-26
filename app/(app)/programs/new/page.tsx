import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        <ProgramCreateForm />
      </div>
    </main>
  );
}
