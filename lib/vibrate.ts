import { isVibrationEnabled } from './preferences';

// Vibration API wrapper. Without support: no-op. Can be disabled via the
// user preference (page /settings).
// Standard patterns:
// - VALIDATE: 50ms (quick set validation)
// - REST_END: 300/100/300 (timer end, more pronounced)
// - WARNING: 100/50/100 (warning before the end)

export const VIBRATION_PATTERNS = {
  validate: 50,
  restEnd: [300, 100, 300] as number[],
  warning: [100, 50, 100] as number[],
} as const;

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  if (!isVibrationEnabled()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore: vibration is a nice-to-have.
  }
}
