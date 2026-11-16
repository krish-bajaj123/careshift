import { describe, expect, it } from 'vitest';
import raw from '../src/v01/demoData.json';
import { evaluate } from '../src/agent/medRules';
import { adviseOnRefusal } from '../src/v01/rules';
import { toMin } from '../src/agent/state';
import { state } from './helpers';

describe('medRules.evaluate', () => {
  it('1st medication refusal inside the window: retry allowed, no escalation, never hand off', () => {
    const r = evaluate({ taskId: 't8', attempts: 1 }, state());
    expect(r.isMed).toBe(true);
    expect(r.mustEscalate).toBe(false);
    expect(r.allowedActions).toEqual(['retry_same_staff', 'retry_different_staff', 'flag_nurse']);
    expect(r.allowedActions).not.toContain('hand_off');
    expect(r.hardConstraints).toEqual([{ type: 'not_before', taskId: 't8', time: toMin('10:20'), source: 'rules' }]);
  });

  it('2nd medication refusal: escalate to the charge nurse and log as missed', () => {
    const r = evaluate({ taskId: 't8', attempts: 2 }, state({ t8: { attempts: 2 } }));
    expect(r.mustEscalate).toBe(true);
    expect(r.escalateTo).toBe('s4');
    expect(r.logAsMissed).toBe(true);
    expect(r.allowedActions).not.toContain('hand_off');
    expect(r.allowedActions).toContain('final_attempt');
  });

  it('1st medication refusal after the window has closed escalates', () => {
    const s = state();
    s.tasks.find((t) => t.id === 't8')!.latest = toMin('10:15');
    const r = evaluate({ taskId: 't8', attempts: 1 }, s);
    expect(r.mustEscalate).toBe(true);
    expect(r.allowedActions).toEqual(['escalate_charge_nurse', 'log_missed']);
  });

  it('2nd bath refusal matches task1_expected_result: hand off to eve-1110 allowed', () => {
    const expected = raw.task1_expected_result;
    const r = evaluate({ taskId: expected.task, attempts: expected.attempts }, state());
    expect(r.isMed).toBe(false);
    expect(r.allowedActions).toContain('hand_off');
    expect(r.handoff?.toShift).toBe(expected.to_shift);
    expect(r.handoff?.toStaff).toBe('s6');
    expect(r.mustEscalate).toBe(false);
    expect(adviseOnRefusal('flexible', 2, 'Emeka Okafor').suggestion).toBe('hand_off');
  });

  it('essential non-medication refusal keeps the existing advice and no hand off', () => {
    const r = evaluate({ taskId: 't6', attempts: 1 }, state());
    expect(r.summary).toContain("can't wait for the next shift");
    expect(r.allowedActions).toEqual(['retry_this_shift', 'flag_nurse']);
  });
});
