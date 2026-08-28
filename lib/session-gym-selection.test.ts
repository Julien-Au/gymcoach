import { describe, expect, it } from 'vitest';
import { liveSessionGymInclude } from '@/lib/session-gym-selection';

describe('live session gym selection', () => {
  it('selects only lightweight equipment fields and never the image blob', () => {
    const equipment = liveSessionGymInclude.equipment.select;

    expect(equipment).toEqual({
      id: true,
      name: true,
      exerciseLinks: { select: { exerciseId: true } },
    });
    expect('imageData' in equipment).toBe(false);
    expect('imageMimeType' in equipment).toBe(false);
  });
});
