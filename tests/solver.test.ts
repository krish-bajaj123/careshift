import { describe, expect, it } from 'vitest';
import { evaluate, verifyOption } from '../src/agent/medRules';
import { solve } from '../src/agent/solver';
import { toMin } from '../src/agent/state';
import type { Constraint, ShiftState } from '../src/agent/types';
import { NURSES_BUSY_UNTIL_AFTER_11, state } from './helpers';

function run(s: ShiftState, taskId: string, attempts: number, extra: Constraint[] = []) {
  const rules = evaluate({ taskId, attempts }, s);
  const constraints = [...rules.hardConstraints, ...extra];
  const out = solve({ state: s, constraints, keyTaskId: rules.excludeTarget ? undefined : taskId, exclude: rules.excludeTarget ? [taskId] : [] });
  return { rules, constraints, out };
}

describe('solver', () => {
  it('re-plans a cold medication refusal inside the window with no double booking', () => {
    const s = state();
    const { rules, constraints, out } = run(s, 't8', 1, [{ type: 'not_before', taskId: 't8', time: s.now + 20, source: 'test' }]);
    expect(out.feasible).toBe(true);
    expect(out.exhaustive).toBe(true);
    expect(out.options.length).toBe(3);
    for (const o of out.options) {
      expect(verifyOption(s, o, constraints, rules)).toEqual([]);
      const t8 = o.assignments.find((a) => a.taskId === 't8')!;
      expect(t8.start).toBeGreaterThanOrEqual(toMin('10:25'));
      expect(t8.start).toBeLessThanOrEqual(toMin('11:00'));
      expect(['s3', 's4']).toContain(t8.staff[0]);
    }
    expect(out.options.map((o) => o.cost.total)).toEqual([...out.options.map((o) => o.cost.total)].sort((a, b) => a - b));
  });

  it('respects avoid_staff by giving the retry to the other nurse', () => {
    const s = state();
    const { out } = run(s, 't8', 1, [{ type: 'avoid_staff', taskId: 't8', staffId: 's3', source: 'test' }]);
    for (const o of out.options) expect(o.assignments.find((a) => a.taskId === 't8')!.staff).toEqual(['s4']);
  });

  it('reports t8 as infeasible when both nurses are busy past the window', () => {
    const s = state({}, NURSES_BUSY_UNTIL_AFTER_11);
    const { out } = run(s, 't8', 1);
    expect(out.feasible).toBe(false);
    expect(out.unplaced.map((u) => u.taskId)).toEqual(['t8']);
    expect(out.unplaced[0].reason).toMatch(/busy until after 11:00/);
    expect(out.options[0].assignments.map((a) => a.taskId)).toEqual(expect.arrayContaining(['t9', 't10']));
  });

  it('always gives the 2-person lift two distinct staff', () => {
    const cases: [string, number][] = [['t8', 1], ['t8', 2], ['t5', 1], ['t5', 2], ['t3', 1], ['t6', 1]];
    for (const [id, attempts] of cases) {
      const s = state();
      const { out } = run(s, id, attempts, [{ type: 'avoid_staff', taskId: 't4', staffId: 's2', source: 'test' }]);
      for (const o of out.options) {
        const lift = o.assignments.find((a) => a.taskId === 't4')!;
        expect(lift.staff).toHaveLength(2);
        expect(new Set(lift.staff).size).toBe(2);
      }
    }
  });

  it('is deterministic', () => {
    const a = run(state(), 't8', 1, [{ type: 'prefer_staff', taskId: 't8', staffId: 's4', source: 'test' }]).out;
    const b = run(state(), 't8', 1, [{ type: 'prefer_staff', taskId: 't8', staffId: 's4', source: 'test' }]).out;
    expect(JSON.stringify(b)).toEqual(JSON.stringify(a));
  });

  it('leaves the plan unchanged when a 2nd bath refusal is handed off', () => {
    const s = state();
    const { out } = run(s, 't5', 2);
    expect(out.options[0].cost.total).toBe(0);
    expect(out.options[0].assignments.some((a) => a.taskId === 't5')).toBe(false);
  });
});
