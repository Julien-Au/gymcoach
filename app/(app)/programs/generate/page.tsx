import { Wand2 } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { ProgramGenerator } from '@/components/programs/program-generator';

export default async function GenerateProgramPage() {
  await requireSession();

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <Wand2 className="size-6" />
          <h1 className="text-2xl font-bold tracking-tight">AI program</h1>
        </div>
        <ProgramGenerator />
      </div>
    </main>
  );
}
