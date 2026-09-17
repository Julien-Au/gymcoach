'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { EquipmentType, WeightUnit } from '@/lib/prisma-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fromDisplayWeight, roundWeight, toDisplayWeight } from '@/lib/units';

export interface LiveEquipmentOption {
  id: string;
  name: string;
  equipmentType: EquipmentType;
  weightOptions: number[];
  exerciseLinks: { exerciseId: string }[];
}

interface Props {
  open: boolean;
  gymId: string;
  equipment: LiveEquipmentOption;
  unit: WeightUnit;
  onOpenChange: (open: boolean) => void;
  onSaved: (equipment: LiveEquipmentOption) => void;
}

export function LiveEquipmentWeightEditor({
  open,
  gymId,
  equipment,
  unit,
  onOpenChange,
  onSaved,
}: Props) {
  const t = useTranslations('session.editableSets.weightEditor');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(
      equipment.weightOptions
        .map((weight) => roundWeight(toDisplayWeight(weight, unit), 2))
        .join(', '),
    );
  }, [equipment.id, equipment.weightOptions, open, unit]);

  async function save() {
    if (saving) return;
    const displayWeights = parseDisplayWeightList(value);
    if (displayWeights.length > 200) {
      toast.error(t('tooManyWeights'));
      return;
    }
    const weightOptions = uniqueSorted(
      displayWeights.map((weight) => roundWeight(fromDisplayWeight(weight, unit), 2)),
    );

    setSaving(true);
    try {
      const response = await fetch('/api/gyms/' + gymId + '/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: equipment.id,
          name: equipment.name,
          equipmentType: equipment.equipmentType,
          weightOptions,
        }),
      });
      if (!response.ok) throw new Error('save failed');
      onSaved({ ...equipment, weightOptions });
      onOpenChange(false);
      toast.success(t('saved'));
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>{t('title', { name: equipment.name })}</DialogTitle>
        <DialogDescription>{t('description')}</DialogDescription>
        <div className="space-y-2">
          <Label htmlFor="live-equipment-weights">{t('weights', { unit })}</Label>
          <Input
            id="live-equipment-weights"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            inputMode="decimal"
            placeholder={t('placeholder')}
            disabled={saving}
          />
        </div>
        <Button type="button" onClick={save} disabled={saving} className="w-full">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          <span className="ml-2">{t('save')}</span>
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function parseDisplayWeightList(raw: string): number[] {
  return uniqueSorted(
    raw
      .split(/[;,\n]/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => roundWeight(value, 2)),
  );
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}
