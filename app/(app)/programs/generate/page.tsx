import { Wand2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/auth';
import { ProgramGenerator } from '@/components/programs/program-generator';

export default async function GenerateProgramPage() {
  const t = await getTranslations('programs');
  await requireSession();

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <Wand2 className="size-6" />
          <h1 className="text-2xl font-bold tracking-tight">{t('aiProgram')}</h1>
        </div>
        <ProgramGenerator />
      </div>
    </main>
  );
}
