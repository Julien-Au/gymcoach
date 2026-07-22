import type { EquipmentType } from '@/lib/prisma-client';

export interface GymLoadConstraints {
  equipmentType: EquipmentType;
  isAvailable?: boolean;
  dumbbellWeights?: number[];
  plateWeights?: number[];
  barWeights?: number[];
  weightOptions?: number[];
}

export function constrainGymWeight(
  targetWeight: number,
  referenceWeight: number,
  constraints?: GymLoadConstraints | null,
): number {
  if (!constraints || constraints.isAvailable === false || targetWeight <= 0) {
    return round(targetWeight);
  }

  let options: number[] = [];
  switch (constraints.equipmentType) {
    case 'DUMBBELL':
      options = constraints.dumbbellWeights ?? [];
      break;
    case 'BARBELL':
      options = constructibleBarbellWeights(
        constraints.barWeights ?? [],
        constraints.plateWeights ?? [],
        Math.max(targetWeight, referenceWeight),
      );
      break;
    case 'MACHINE':
    case 'CABLE':
      options = constraints.weightOptions ?? [];
      break;
    case 'BODYWEIGHT':
    case 'CARDIO':
      return round(targetWeight);
    default:
      break;
  }

  const normalized = uniquePositive(options);
  if (normalized.length === 0) return round(targetWeight);
  return selectDirectionalWeight(normalized, targetWeight, referenceWeight);
}

export function constructibleBarbellWeights(
  barWeights: number[],
  plateWeights: number[],
  targetCeiling: number,
): number[] {
  const bars = uniquePositive(barWeights);
  const plates = uniquePositive(plateWeights);
  if (bars.length === 0 || plates.length === 0) return bars;

  const maxPlate = plates.at(-1) ?? 0;
  const maxTotal = Math.min(5000, Math.max(...bars, targetCeiling + maxPlate * 4 + 50));
  const plateUnits = plates.map(toUnits);
  const divisor = plateUnits.reduce(gcd);
  const scaledPlates = [...new Set(plateUnits.map((value) => value / divisor))];
  const totals = new Set<number>(bars);

  for (const bar of bars) {
    const maxPerSideUnits = Math.max(0, Math.floor(toUnits((maxTotal - bar) / 2) / divisor));
    const reachable = new Uint8Array(maxPerSideUnits + 1);
    reachable[0] = 1;
    for (let current = 0; current <= maxPerSideUnits; current += 1) {
      if (!reachable[current]) continue;
      for (const plate of scaledPlates) {
        const next = current + plate;
        if (next <= maxPerSideUnits) reachable[next] = 1;
      }
    }
    for (let perSide = 0; perSide <= maxPerSideUnits; perSide += 1) {
      if (reachable[perSide]) totals.add(round(bar + (perSide * divisor * 2) / 100));
    }
  }

  return [...totals].sort((a, b) => a - b);
}

function selectDirectionalWeight(options: number[], target: number, reference: number): number {
  if (target < reference) {
    const lower = options.filter((value) => value < reference);
    if (lower.length === 0) return round(reference);
    return round(nearest(lower, target));
  }
  if (target > reference) {
    const higher = options.filter((value) => value > reference);
    if (higher.length === 0) return round(reference);
    return round(nearest(higher, target));
  }
  return round(nearest(options, target));
}

function nearest(options: number[], target: number): number {
  return options.reduce((best, value) => {
    const distance = Math.abs(value - target);
    const bestDistance = Math.abs(best - target);
    return distance < bestDistance || (distance === bestDistance && value < best) ? value : best;
  }, options[0]!);
}

function uniquePositive(values: number[]): number[] {
  return [
    ...new Set(values.filter((value) => Number.isFinite(value) && value > 0).map(round)),
  ].sort((a, b) => a - b);
}

function toUnits(value: number): number {
  return Math.round(value * 100);
}

function gcd(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left || 1;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
