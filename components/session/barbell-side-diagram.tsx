import type { ReactNode } from 'react';
import type { PlateLoad } from '@/lib/plates';

interface Props {
  load: PlateLoad;
  unitLabel: string;
  platesLabel: string;
  // The weight being previewed, exposed for the set-value picker's pending pick.
  targetWeight?: number;
  // Tighter sizing for the set-value picker, where the option wheel needs the height.
  compact?: boolean;
  // Caption rendered under the bar (per-side summary, achieved load, ...).
  children?: ReactNode;
}

// One side of a loaded barbell: the collar and each plate, heaviest first, with
// plate height scaled by denomination. Shared by the plate calculator and the
// set-value picker so both always draw the same load for the same PlateLoad.
export function BarbellSideDiagram({
  load,
  unitLabel,
  platesLabel,
  targetWeight,
  compact = false,
  children,
}: Props) {
  const plates = load.perSide.flatMap((group) =>
    Array.from({ length: group.count }, (_, index) => ({
      weight: group.plate,
      key: String(group.plate) + '-' + String(index),
    })),
  );
  const maxPlate = Math.max(...plates.map((plate) => plate.weight), 1);
  const minHeight = compact ? 22 : 26;
  const heightRange = compact ? 24 : 26;

  return (
    <div
      className={`rounded-md border bg-muted/20 ${compact ? 'px-3 py-2' : 'p-3'}`}
      data-testid="barbell-side-diagram"
      data-target-weight={targetWeight}
    >
      <div className="overflow-x-auto">
        <div
          className={`relative mx-auto grid w-max min-w-full max-w-sm grid-cols-[minmax(2.5rem,1fr)_max-content_minmax(1.25rem,0.6fr)] items-center ${
            compact ? 'min-h-12' : 'min-h-16'
          }`}
        >
          <div className="absolute inset-x-2 top-1/2 h-2 -translate-y-1/2 rounded-full bg-zinc-500" />
          <span aria-hidden />
          <div
            className={`relative z-10 flex items-center gap-0.5 ${compact ? 'h-12' : 'h-14'}`}
            aria-label={platesLabel}
          >
            <div
              className={`mr-0.5 w-3 shrink-0 rounded-sm bg-zinc-400 ${compact ? 'h-8' : 'h-10'}`}
              aria-hidden
            />
            {plates.map((plate) => (
              <div
                key={plate.key}
                data-testid="barbell-plate"
                className={`flex shrink-0 items-center justify-center rounded-sm border border-zinc-300 bg-zinc-700 font-bold text-white ${
                  compact ? 'w-4 text-[0.55rem]' : 'w-5 text-[0.6rem]'
                }`}
                style={{
                  height:
                    String(Math.round(minHeight + (plate.weight / maxPlate) * heightRange)) + 'px',
                }}
                title={String(plate.weight) + ' ' + unitLabel}
              >
                <span className="-rotate-90 whitespace-nowrap">{plate.weight}</span>
              </div>
            ))}
          </div>
          <span aria-hidden />
        </div>
      </div>
      {children}
    </div>
  );
}
