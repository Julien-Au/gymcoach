import {
  type LlmCompletionRequest,
  type LlmCompletionResult,
  type LlmProvider,
} from './types';

// ============================================================
// Demo provider (LLM_PROVIDER=demo)
// ============================================================
// Returns canned but realistic responses so the AI screens (weekly debrief,
// chat coach, program generation) can be tried, screenshotted and recorded
// without any API key or cost. Picks the response from markers in the system
// prompt. Handy for contributors who want to see the UI before wiring a key.

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const DEBRIEF = `## Weekly recap

Solid week: 3 sessions logged, total working volume up about 4% versus last week.

**Progressing**
- Barbell bench press: 70 kg x 8 at RIR 2 on the top set, estimated 1RM up again.
- Pronated pull-ups: clean reps across all sets, ready for added load.

**Goal check**
- Barbell bench press: 92% of the way to your 80 kg x 8 target on the estimated-1RM scale. One more clean progression and it should fall.

**Watch (possible plateau)**
- Cable lateral raises are flagged as stalled: estimated 1RM flat over the last 3 sessions at the same load and reps.

**Fatigue signals**
- RIR is holding around 2 and no deload is recommended this week, so keep pushing.

**Suggestions for next week**
- Push bench to 72.5 kg for the first working sets - that lines up with your stated goal.
- Bias a little more side-delt volume.

**Points of attention**
- Nothing flagged in your session notes.

<adjustments>
[
  {
    "exerciseName": "Barbell bench press",
    "summary": "Add a set and nudge the load up",
    "rationale": "Top-set reps have sat at the top of the range at RIR 2 for two weeks.",
    "suggestedRepsMin": 6,
    "suggestedRepsMax": 8,
    "suggestedSets": 5,
    "suggestedRIR": 2,
    "suggestedRestSec": 150,
    "currentLoad": 70,
    "suggestedLoad": 72.5
  },
  {
    "exerciseName": "Cable lateral raises",
    "summary": "Hold the load, chase reps and add a set",
    "rationale": "Side delts are lagging and the lift has stalled; bias volume here.",
    "suggestedRepsMin": 12,
    "suggestedRepsMax": 20,
    "suggestedSets": 4,
    "suggestedRIR": 1,
    "suggestedRestSec": 60
  }
]
</adjustments>`;

// In-session chat (issue #111): canned answer keyed to the live-session
// context so the no-key flow demonstrates mid-workout coaching.
const CHAT_IN_SESSION = `Got it - looking at your live session.

- **Right now**: your logged sets are at or above target reps, so the load is well chosen. Keep it for the remaining sets and stop at RIR 2.
- **Shoulder caution**: if a press feels off, drop the load about 10% for the next set or swap to the next exercise in your plan and come back; never push through joint pain.
- **Rest**: take the full programmed rest before the next set - rushing it costs reps.

Log how the next set feels and ask me again if it does not improve.`;

const CHAT = `Short version: your bench is moving and your chest volume is in a good spot.

- **Bench press**: estimated 1RM is trending up (about +6% over the last 8 weeks) while your RIR stays around 2, so the stimulus is sustainable. Keep adding ~2.5 kg once you hit the top of the rep range on all sets.
- **Chest volume**: you are around 13-15 hard sets per week, solidly in the productive 10-20 range for most lifters (Schoenfeld). No need to add more yet.
- **Next session**: aim for the top of the range on incline dumbbell press, and only add a fly set if recovery feels easy.

Want me to turn this into concrete load targets for your next push day?`;

const DEMO_PROGRAM = {
  name: 'Push / Pull / Legs - Hypertrophy',
  description:
    'A 3-day PPL split focused on hypertrophy, compounds first, 10 to 20 hard sets per muscle per week.',
  phase: 'Hypertrophy',
  workouts: [
    {
      name: 'Push',
      dayOfWeek: 1,
      exercises: [
        { name: 'Barbell bench press', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 4, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 2, restSec: 150 },
        { name: 'Seated dumbbell overhead press', muscleGroup: 'SHOULDERS_FRONT', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
        { name: 'Incline dumbbell press (30 deg)', muscleGroup: 'CHEST', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
        { name: 'Cable lateral raises', muscleGroup: 'SHOULDERS_LATERAL', category: 'ISOLATION', targetSets: 4, targetRepsMin: 12, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
        { name: 'Triceps pushdown (rope)', muscleGroup: 'TRICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
      ],
    },
    {
      name: 'Pull',
      dayOfWeek: 3,
      exercises: [
        { name: 'Pronated pull-ups (weighted if possible)', muscleGroup: 'BACK_WIDTH', category: 'COMPOUND', targetSets: 4, targetRepsMin: 6, targetRepsMax: 10, targetRIR: 2, restSec: 120 },
        { name: 'Bent-over barbell row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
        { name: 'Lat pulldown (wide grip)', muscleGroup: 'BACK_WIDTH', category: 'COMPOUND', targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetRIR: 1, restSec: 90 },
        { name: 'Machine rear delt fly', muscleGroup: 'SHOULDERS_REAR', category: 'ISOLATION', targetSets: 3, targetRepsMin: 12, targetRepsMax: 20, targetRIR: 1, restSec: 60 },
        { name: 'EZ-bar curl', muscleGroup: 'BICEPS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 75 },
      ],
    },
    {
      name: 'Legs',
      dayOfWeek: 5,
      exercises: [
        { name: 'Machine squat (or Hack squat)', muscleGroup: 'QUADS', category: 'COMPOUND', targetSets: 4, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 150 },
        { name: 'Dumbbell Romanian Deadlift', muscleGroup: 'HAMSTRINGS', category: 'COMPOUND', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRIR: 2, restSec: 120 },
        { name: 'Leg extension', muscleGroup: 'QUADS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1, restSec: 75 },
        { name: 'Seated leg curl', muscleGroup: 'HAMSTRINGS', category: 'ISOLATION', targetSets: 3, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 75 },
        { name: 'Standing calf raise (or machine)', muscleGroup: 'CALVES', category: 'ISOLATION', targetSets: 4, targetRepsMin: 10, targetRepsMax: 15, targetRIR: 1, restSec: 60 },
      ],
    },
  ],
};

// Detect the use case from a phrase unique to each *system prompt* (not the
// payload: the chat context also contains "workouts", which fooled an earlier
// heuristic).
function cannedResponse(system: string): string {
  if (system.includes('<adjustments>')) return DEBRIEF; // weekly debrief prompt
  if (system.includes('SINGLE JSON object')) return JSON.stringify(DEMO_PROGRAM, null, 2); // program generation prompt
  // In-session chat: the appended payload JSON carries a "currentSession" key
  // only when a live session is attached (the quoted form cannot appear in the
  // stable prompt text, which mentions currentSession without quotes).
  if (system.includes('"currentSession"')) return CHAT_IN_SESSION;
  return CHAT; // conversational coach
}

export class DemoProvider implements LlmProvider {
  readonly id = 'demo' as const;
  readonly label = 'Demo';
  readonly apiKeyEnvVar = 'LLM_PROVIDER';
  readonly model = 'demo';

  isConfigured(): boolean {
    return true;
  }

  async complete(req: LlmCompletionRequest): Promise<LlmCompletionResult> {
    await delay(500);
    return { text: cannedResponse(req.system), modelUsed: 'demo' };
  }

  async *stream(req: LlmCompletionRequest): AsyncIterable<string> {
    const text = cannedResponse(req.system);
    for (const token of text.split(/(\s+)/)) {
      await delay(22);
      yield token;
    }
  }
}
