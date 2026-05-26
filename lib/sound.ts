import { isRestTimerSoundEnabled } from './preferences';

// Beep synthétique via Web Audio API : pas de fichier à embarquer, pas de
// permission spéciale, fonctionne sur iOS Safari après une interaction user.
// Désactivable via la préférence utilisateur (page /settings).

let cachedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (cachedCtx) return cachedCtx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    cachedCtx = new Ctor();
    return cachedCtx;
  } catch {
    return null;
  }
}

// Joue un bref bip à 880 Hz si la préférence est activée. Fail silently.
export function playRestEndBeep(): void {
  if (!isRestTimerSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch {
    // Ignore : son est nice-to-have.
  }
}
