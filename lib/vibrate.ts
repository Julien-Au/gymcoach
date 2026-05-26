import { isVibrationEnabled } from './preferences';

// Wrapper vibration API. Sans support : no-op. Désactivable via la
// préférence utilisateur (page /settings).
// Patterns standards :
// - VALIDATE: 50ms (validation rapide série)
// - REST_END: 300/100/300 (fin de chrono, plus marqué)
// - WARNING: 100/50/100 (avertissement avant fin)

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
    // Ignore : la vibration est un nice-to-have.
  }
}
