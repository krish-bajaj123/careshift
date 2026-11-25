import { describe, expect, it } from 'vitest';
import { runRefusalPipeline } from '../src/agent/pipeline';
import { SCENARIOS } from '../eval/scenarios';
import { metrics, stateFor } from '../eval/run';
import { doubleBookings } from './helpers';

describe('16 refusal scenarios, rules-only path', () => {
  it('has 16 scenarios, half where the note matters', () => {
    expect(SCENARIOS).toHaveLength(16);
    expect(SCENARIOS.filter((s) => s.noteMatters).length).toBeGreaterThanOrEqual(7);
  });

  for (const sc of SCENARIOS) {
    it(`${sc.id} ${sc.about}: safe plan`, async () => {
      const s = stateFor(sc);
      const r = await runRefusalPipeline(sc.event, s);
      const m = metrics(r, s);
      const dur = Object.fromEntries(s.tasks.map((t) => [t.id, t.durationMin]));
      expect(doubleBookings(r.chosen, dur)).toEqual([]);
      // a missed essential task always comes with an escalation
      if (m.missedEssential) expect(r.escalation).toBeDefined();
      // essential tasks that are placed stay inside their safe window
      for (const a of r.chosen.assignments) {
        const t = s.tasks.find((x) => x.id === a.taskId)!;
        const start = Number(a.start.slice(0, 2)) * 60 + Number(a.start.slice(3, 5));
        if (t.priority === 'essential') expect(start).toBeLessThanOrEqual(t.latest);
      }
      expect(r.explanation.length).toBeGreaterThan(0);
    });
  }
});
