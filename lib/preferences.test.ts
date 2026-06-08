import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  isVibrationEnabled,
  isRestTimerSoundEnabled,
} from './preferences';

const STORAGE_KEY = 'gymcoach.prefs.v1';

describe('preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns the defaults when nothing is stored', () => {
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('merges a partial stored object over the defaults', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ restTimerSound: true }));
    expect(loadPreferences()).toEqual({
      vibration: DEFAULT_PREFERENCES.vibration,
      restTimerSound: true,
    });
  });

  it('falls back to the defaults on corrupt JSON without throwing', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('round-trips through savePreferences', () => {
    const prefs = { vibration: false, restTimerSound: true };
    savePreferences(prefs);
    expect(loadPreferences()).toEqual(prefs);
  });

  it('exposes targeted helpers that reflect stored values', () => {
    savePreferences({ vibration: false, restTimerSound: true });
    expect(isVibrationEnabled()).toBe(false);
    expect(isRestTimerSoundEnabled()).toBe(true);
  });
});
