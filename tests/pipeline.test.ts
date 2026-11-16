import { describe, expect, it } from 'vitest';
import { AIMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { runRefusalPipeline } from '../src/agent/pipeline';
import { toMin } from '../src/agent/state';
import type { PipelineResult } from '../src/agent/types';
import { doubleBookings, NURSES_BUSY_UNTIL_AFTER_11, scriptedAgent, state } from './helpers';

const COLD = { taskId: 't8', reasonChip: 'Said they were cold', note: 'cold, wants room warmer', attempts: 1, at: '10:05' };

function durations(s: ReturnType<typeof state>) {
  return Object.fromEntries(s.tasks.map((t) => [t.id, t.durationMin]));
}

function t8Of(r: PipelineResult) {
  return r.chosen.assignments.find((a) => a.taskId === 't8');
}

describe('runRefusalPipeline without a model (deterministic path)', () => {
  it('1st medication refusal: retry by a nurse between 10:25 and 11:00, no escalation', async () => {
    const s = state({ t8: { attempts: 1 } });
    const r = await runRefusalPipeline(COLD, s);
    expect(r.source).toBe('fallback');
    expect(r.escalation).toBeUndefined();
    const t8 = t8Of(r)!;
    expect(toMin(t8.start)).toBeGreaterThanOrEqual(toMin('10:25'));
    expect(toMin(t8.start)).toBeLessThanOrEqual(toMin('11:00'));
    expect(['s3', 's4']).toContain(t8.staff[0]);
    expect(doubleBookings(r.chosen, durations(s))).toEqual([]);
    expect(r.changes.find((c) => c.taskId === 't8')).toMatchObject({ from: { time: '10:00', assignee: 's3' } });
    expect(r.options.length).toBeLessThanOrEqual(3);
    expect(r.explanation).toMatch(/Emeka Okafor refused Morning medications/);
    expect(r.trace.map((t) => t.step)).toEqual(['state', 'rules', 'solver', 'agent', 'fallback', 'result']);
  });

  it('2nd medication refusal: escalates to s4, never hands off or marks done', async () => {
    const s = state({ t8: { attempts: 2 } });
    const r = await runRefusalPipeline({ ...COLD, attempts: 2 }, s);
    expect(r.escalation).toMatchObject({ to: 's4', logAsMissed: true });
    expect(r.escalation?.toName).toBe('Grace Liu, charge nurse');
    expect(r.notify).toContain('s4');
    expect(r.handoff).toBeUndefined();
    expect(r.allowedActions).not.toContain('hand_off');
    expect(JSON.stringify(r)).not.toMatch(/"status"/);
    expect(t8Of(r)).toBeDefined();
  });

  it('no feasible retry: escalates and lists t8 as unplaced', async () => {
    const s = state({}, NURSES_BUSY_UNTIL_AFTER_11);
    const r = await runRefusalPipeline(COLD, s);
    expect(r.chosen.unplaced.map((u) => u.taskId)).toEqual(['t8']);
    expect(r.escalation?.to).toBe('s4');
    expect(r.escalation?.logAsMissed).toBe(true);
    expect(r.explanation).toMatch(/No safe retry fits/);
  });

  it('2nd bath refusal suggests hand off to the evening shift', async () => {
    const r = await runRefusalPipeline({ taskId: 't5', reasonChip: 'Said they were cold', attempts: 2 }, state({ t5: { attempts: 2 } }));
    expect(r.handoff).toEqual({ taskId: 't5', toShift: 'eve-1110', toStaff: 's6' });
    expect(r.changes).toEqual([]);
    expect(r.escalation).toBeUndefined();
  });
});

describe('runRefusalPipeline with a fake LangChain model', () => {
  it('uses the agent when it picks a valid option', async () => {
    const model = scriptedAgent({
      extra: [{ type: 'not_before', minutesFromNow: 20 }],
      decision: (p) => ({ chosenOptionId: `${p}a`, constraintsUsed: [{ type: 'not_before', minutesFromNow: 20 }], explanation: 'Retry at 10:25 once the room is warmer.', notify: ['s3'] }),
    });
    const s = state();
    const r = await runRefusalPipeline(COLD, s, model);
    expect(r.source).toBe('agent');
    expect(r.chosen.id).toBe('opt-1a');
    expect(t8Of(r)?.start).toBe('10:25');
    expect(r.explanation).toBe('Retry at 10:25 once the room is warmer.');
    expect(r.constraintsUsed).toEqual([{ type: 'not_before', taskId: 't8', time: toMin('10:25'), source: 'agent' }]);
    expect(r.trace.map((t) => t.step)).toEqual(['state', 'rules', 'solver', 'tool:get_rules_result', 'tool:run_solver', 'agent', 'validate', 'result']);
  });

  it('avoid_staff from the note: retry goes to Grace, not Maria', async () => {
    const model = scriptedAgent({
      extra: [{ type: 'avoid_staff', staffId: 's3' }],
      decision: (p) => ({ chosenOptionId: `${p}a`, constraintsUsed: [{ type: 'avoid_staff', staffId: 's3' }], explanation: 'Grace will try instead.', notify: ['s4'] }),
    });
    const r = await runRefusalPipeline({ ...COLD, reasonChip: 'Other', note: "he doesn't want Maria" }, state(), model);
    expect(r.source).toBe('agent');
    expect(t8Of(r)?.staff).toEqual(['s4']);
    expect(r.notify).toContain('s4');
  });

  it('falls back when the agent picks an id the solver did not produce', async () => {
    const model = scriptedAgent({ decision: () => ({ chosenOptionId: 'opt-9z', constraintsUsed: [], explanation: 'x', notify: [] }) });
    const r = await runRefusalPipeline(COLD, state(), model);
    expect(r.source).toBe('fallback');
    expect(r.trace.find((t) => t.step === 'validate')?.detail).toMatch(/not returned by the solver/);
  });

  it('keeps the escalation when the agent omits notify on a 2nd refusal', async () => {
    const model = scriptedAgent({ decision: (p) => ({ chosenOptionId: `${p}a`, constraintsUsed: [], explanation: 'Try again later.', notify: [] }) });
    const r = await runRefusalPipeline({ ...COLD, attempts: 2 }, state({ t8: { attempts: 2 } }), model);
    expect(r.source).toBe('agent');
    expect(r.escalation?.to).toBe('s4');
    expect(r.notify).toContain('s4');
  });

  it('falls back when the agent drops an essential task with its own constraints', async () => {
    const model = scriptedAgent({
      extra: [{ type: 'avoid_staff', staffId: 's3' }, { type: 'avoid_staff', staffId: 's4' }],
      decision: (p) => ({ chosenOptionId: `${p}a`, constraintsUsed: [], explanation: 'Skip it.', notify: [] }),
    });
    const r = await runRefusalPipeline(COLD, state(), model);
    expect(r.source).toBe('fallback');
    expect(r.chosen.unplaced).toEqual([]);
  });

  it('falls back on malformed agent output', async () => {
    const model = fakeModel().respond(new AIMessage('I think 10:30 is fine.'));
    const r = await runRefusalPipeline(COLD, state(), model);
    expect(r.source).toBe('fallback');
  });

  it('falls back when the agent makes more than 4 tool calls', async () => {
    let m = fakeModel();
    for (let i = 0; i < 5; i++) m = m.respondWithTools([{ name: 'get_shift_state', args: {}, id: `c${i}` }]);
    const r = await runRefusalPipeline(COLD, state(), m);
    expect(r.source).toBe('fallback');
    expect(r.trace.find((t) => t.step === 'agent')?.detail).toMatch(/failed/);
  });

  it('falls back when the agent times out', async () => {
    const slow = new FakeListChatModel({ responses: ['{}'], sleep: 300 });
    const r = await runRefusalPipeline(COLD, state(), slow, { timeoutMs: 50 });
    expect(r.source).toBe('fallback');
    expect(r.trace.find((t) => t.step === 'agent')?.detail).toMatch(/timed out/);
  });
});
