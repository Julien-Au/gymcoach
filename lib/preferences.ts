// User preferences stored locally (not in the DB).
// Everything is single-user, so localStorage is enough. SSR-safe reads.

const STORAGE_KEY = 'gymcoach.prefs.v1';

export interface UserPreferences {
  vibration: boolean;
  restTimerSound: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  vibration: true,
  restTimerSound: false,
};

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable: silently accept.
  }
}

// Targeted helpers (read without requiring the full signature).
export function isVibrationEnabled(): boolean {
  return loadPreferences().vibration;
}

export function isRestTimerSoundEnabled(): boolean {
  return loadPreferences().restTimerSound;
}
