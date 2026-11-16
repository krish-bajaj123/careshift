import { AIMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';
import { buildShiftState, defaultClientTasks, toMin } from '../src/agent/state';
import type { ClientTask, OptionSummary, StaffBlock } from '../src/agent/types';

export function clientTasks(patch: Record<string, Partial<ClientTask>> = {}): ClientTask[] {
  return defaultClientTasks().map((t) => ({ ...t, ...patch[t.id] }));
}

export function state(patch: Record<string, Partial<ClientTask>> = {}, blocks: StaffBlock[] = []) {
  return buildShiftState(clientTasks(patch), blocks);
}

export const NURSES_BUSY_UNTIL_AFTER_11: StaffBlock[] = [
  { staffId: 's3', from: toMin('10:05'), to: toMin('11:05'), reason: 'code on another floor' },
  { staffId: 's4', from: toMin('10:05'), to: toMin('11:05'), reason: 'family meeting' },
];

export function doubleBookings(opt: OptionSummary, durations: Record<string, number>) {
  const seen: string[] = [];
  const spans = opt.assignments.flatMap((a) => a.staff.map((s) => ({ s, task: a.taskId, from: toMin(a.start), to: toMin(a.start) + durations[a.taskId] })));
  for (const x of spans) for (const y of spans) {
    if (x !== y && x.s === y.s && x.task < y.task && x.from < y.to && y.from < x.to) seen.push(`${x.s}: ${x.task} / ${y.task}`);
  }
  return seen;
}

export interface Script {
  extra?: Record<string, unknown>[];
  decision: (optionPrefix: string) => Record<string, unknown>;
}

export function scriptedAgent({ extra = [], decision }: Script) {
  return fakeModel()
    .respondWithTools([{ name: 'get_rules_result', args: {}, id: 'call-1' }])
    .respondWithTools([{ name: 'run_solver', args: { extraConstraints: extra }, id: 'call-2' }])
    .respond(new AIMessage(JSON.stringify(decision('opt-1'))));
}
