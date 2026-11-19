/**
 * Learned task durations (deterministic statistics, no AI).
 *
 * Each completed task logs a start and finish time. For every resident and task
 * kind we keep a typical duration (median) and a planning duration (80th
 * percentile) so the plan allows for slower days. With fewer than MIN_SAMPLES
 * logs we fall back to the default for that kind.
 */
import raw from '../v01/demoData.json';

export const MIN_SAMPLES = 3;

export const DEFAULT_MIN: Record<string, number> = {
  bath: 30, transfer: 15, continence: 15, reposition: 15, hygiene: 15, meal: 20, recreation: 10, med: 10, wound: 15, other: 15,
};

export interface LearnedDuration {
  resident: string;
  kind: string;
  samples: number;
  typicalMin: number;
  planMin: number;
  learned: boolean;
}

interface LogRow { resident: string; kind: string; start: string; end: string }

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function learnFrom(rows: LogRow[]): Map<string, LearnedDuration> {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    const d = toMin(r.end) - toMin(r.start);
    if (d <= 0 || d > 240) continue;
    const k = `${r.resident}|${r.kind}`;
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  const out = new Map<string, LearnedDuration>();
  for (const [k, ds] of groups) {
    const [resident, kind] = k.split('|');
    const s = [...ds].sort((a, b) => a - b);
    out.set(k, {
      resident,
      kind,
      samples: s.length,
      typicalMin: Math.round(quantile(s, 0.5)),
      planMin: Math.round(quantile(s, 0.8)),
      learned: s.length >= MIN_SAMPLES,
    });
  }
  return out;
}

const TABLE = learnFrom(((raw as { task_log?: LogRow[] }).task_log ?? []) as LogRow[]);

/** Duration the planner should use for this resident and task kind. */
export function durationFor(resident: string | undefined, kind: string | undefined, fallback?: number): LearnedDuration {
  const k = kind ?? 'other';
  const hit = resident ? TABLE.get(`${resident}|${k}`) : undefined;
  if (hit && hit.learned) return hit;
  const def = fallback ?? DEFAULT_MIN[k] ?? DEFAULT_MIN.other;
  return { resident: resident ?? '', kind: k, samples: hit?.samples ?? 0, typicalMin: def, planMin: def, learned: false };
}
