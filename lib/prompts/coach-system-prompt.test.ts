import { describe, it, expect } from 'vitest';
import { COACH_SYSTEM_PROMPT } from './coach-system-prompt';
import { PROGRAM_GEN_SYSTEM_PROMPT } from './program-system-prompt';

// Issue #40: the coach must advise WITHIN the user's program and explain why,
// never silently restructure it. These tests pin the positioning into the
// stable system prompts so a future edit cannot quietly drop it.

describe('coach system prompt positioning', () => {
  it('instructs the coach to advise within the active program, not replace it', () => {
    expect(COACH_SYSTEM_PROMPT).toMatch(/advise WITHIN the user's active program/i);
    expect(COACH_SYSTEM_PROMPT).toMatch(/Do NOT redesign the program/i);
  });

  it('requires every suggestion to explain its "why"', () => {
    expect(COACH_SYSTEM_PROMPT).toMatch(/explain its "why"/i);
    expect(COACH_SYSTEM_PROMPT).toMatch(/fill the "rationale"/i);
  });

  it('forbids adding, removing or swapping exercises in an adjustment', () => {
    expect(COACH_SYSTEM_PROMPT).toMatch(
      /Never propose adding, removing or swapping an exercise/i,
    );
  });

  it('states adjustments are user-accepted, never auto-applied', () => {
    expect(COACH_SYSTEM_PROMPT).toMatch(/never applied\s+automatically/i);
  });

  it('still defines the <adjustments> output contract (unchanged)', () => {
    // Guardrail: the audit must not have altered the output contract.
    expect(COACH_SYSTEM_PROMPT).toContain('<adjustments>');
    expect(COACH_SYSTEM_PROMPT).toContain('"exerciseName"');
    expect(COACH_SYSTEM_PROMPT).toContain('"suggestedRepsMin"');
    expect(COACH_SYSTEM_PROMPT).toContain('"suggestedRestSec"');
  });

  // Issue #101: goals and fatigue signals are INPUT-side guidance only.
  it('tells the coach how to use the goals payload and forbids inventing goals', () => {
    expect(COACH_SYSTEM_PROMPT).toMatch(/"goals" lists each per-exercise target/i);
    expect(COACH_SYSTEM_PROMPT).toMatch(/NEVER invent a goal that is not in the\s+payload/i);
  });

  it('tells the coach to prefer recovery over load increases on a deload recommendation', () => {
    expect(COACH_SYSTEM_PROMPT).toMatch(/fatigue\.stalledExercises/);
    expect(COACH_SYSTEM_PROMPT).toMatch(
      /deloadRecommended is true, prefer recovery-oriented advice/i,
    );
  });
});

describe('program generation prompt positioning', () => {
  it('frames the program as a user-controlled, editable draft', () => {
    expect(PROGRAM_GEN_SYSTEM_PROMPT).toMatch(/draft/i);
    expect(PROGRAM_GEN_SYSTEM_PROMPT).toMatch(/Honor any structure.*the user states/i);
  });
});
