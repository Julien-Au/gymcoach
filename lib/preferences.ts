// Préférences utilisateur stockées localement (pas en DB).
// Tout est mono-utilisateur, donc localStorage suffit. Lecture safe SSR.

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
    // localStorage indisponible : on accepte silencieusement.
  }
}

// Helpers ciblés (lecture sans rendre la signature complète obligatoire).
export function isVibrationEnabled(): boolean {
  return loadPreferences().vibration;
}

export function isRestTimerSoundEnabled(): boolean {
  return loadPreferences().restTimerSound;
}
