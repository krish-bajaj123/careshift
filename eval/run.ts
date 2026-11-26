/**
 * Agent vs rules-only on the 16 scenarios. Writes eval/results.csv.
 *   npx tsx eval/run.ts          (rules only)
 *   GEMINI_API_KEY=... npx tsx eval/run.ts   (both paths)
 * We compute the numbers ourselves so the results don't depend on an LLM.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { runRefusalPipeline } from '../src/agent/pipeline';
import { buildShiftState, defaultClientTasks } from '../src/agent/state';
import type { PipelineResult } from '../src/agent/types';
import { SCENARIOS, type Scenario } from './scenarios';

export function metrics(r: PipelineResult, s: ReturnType<typeof buildShiftState>) {
  const essential = new Set(s.tasks.filter((t) => t.priority === 'essential').map((t) => t.id));
  const missedEssential = r.chosen.unplaced.filter((u) => essential.has(u.taskId)).length;
  const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const lateMin = r.chosen.assignments.reduce((n, a) => {
    const t = s.tasks.find((x) => x.id === a.taskId)!;
    return n + Math.max(0, toMin(a.start) - Math.max(t.due, s.now));
  }, 0);
  const moved = r.changes.length;
  const othersMoved = r.changes.filter((c) => c.taskId !== r.taskId).length;
  return { missedEssential, lateMin, moved, othersMoved, escalated: r.escalation ? 1 : 0 };
}

export function stateFor(sc: Scenario) {
  return buildShiftState(defaultClientTasks().map((t) => ({ ...t, ...sc.patch?.[t.id] })), sc.blocks ?? []);
}

async function main() {
  const key = process.env.GEMINI_API_KEY;
  const model = key ? (await import('../src/agent/agent')).createGeminiModels(key) : undefined;
  const rows = ['scenario,about,note_matters,path,source,missed_essential,late_min,tasks_moved,others_moved,escalated,explanation'];
  for (const sc of SCENARIOS) {
    for (const path of model ? ['rules', 'agent'] : ['rules']) {
      const s = stateFor(sc);
      const r = await runRefusalPipeline(sc.event, s, path === 'agent' ? model : undefined);
      const m = metrics(r, s);
      rows.push([sc.id, sc.about, sc.noteMatters, path, r.source, m.missedEssential, m.lateMin, m.moved, m.othersMoved, m.escalated, JSON.stringify(r.explanation)].join(','));
    }
  }
  writeFileSync(new URL('./results.csv', import.meta.url), rows.join('\n') + '\n');
  console.log(rows.join('\n'));
  if (!model) console.log('\n(no GEMINI_API_KEY, so only the rules-only path ran)');
}

if (process.argv[1]?.endsWith('run.ts')) main();
