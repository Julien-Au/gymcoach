import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  isVibrationEnabled,
  isRestTimerSoundEnabled,
  plateConfigForUnit,
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
      ...DEFAULT_PREFERENCES,
      restTimerSound: true,
    });
  });

  it('falls back to the defaults on corrupt JSON without throwing', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('round-trips through savePreferences', () => {
    const prefs = { ...DEFAULT_PREFERENCES, vibration: false, restTimerSound: true };
    savePreferences(prefs);
    expect(loadPreferences()).toEqual(prefs);
  });

  it('exposes targeted helpers that reflect stored values', () => {
    savePreferences({ ...DEFAULT_PREFERENCES, vibration: false, restTimerSound: true });
    expect(isVibrationEnabled()).toBe(false);
    expect(isRestTimerSoundEnabled()).toBe(true);
  });

  it('returns the plate config for the active unit', () => {
    expect(plateConfigForUnit('KG')).toEqual({
      barWeight: DEFAULT_PREFERENCES.barWeightKg,
      plates: DEFAULT_PREFERENCES.platesKg,
    });
    expect(plateConfigForUnit('LB')).toEqual({
      barWeight: DEFAULT_PREFERENCES.barWeightLb,
      plates: DEFAULT_PREFERENCES.platesLb,
    });
  });

  it('reflects a customized plate config', () => {
    savePreferences({ ...DEFAULT_PREFERENCES, barWeightKg: 15, platesKg: [20, 10] });
    expect(plateConfigForUnit('KG')).toEqual({ barWeight: 15, plates: [20, 10] });
  });
});
