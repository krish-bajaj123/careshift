import { fmtMin } from './state';
import type { Assignment, Change, Constraint, CostBreakdown, PlanOption, PlanTask, ShiftState, SolveResult, Unplaced } from './types';

export const SLOT_MIN = 5;
export const WEIGHTS = { lateness: 1, reassignment: 10, timeMove: 1, balance: 2, prefer: 5 } as const;
export const UNPLACED_PENALTY = { essential: 10000, flexible: 200 } as const;

export interface SolveInput {
  state: ShiftState;
  constraints: Constraint[];
  exclude?: string[];
  keyTaskId?: string;
  maxOptions?: number;
  idPrefix?: string;
  nodeLimit?: number;
}

interface Cand {
  start: number;
  staff: string[];
  late: number;
  reassign: number;
  move: number;
  prefer: number;
  cost: number;
}

interface Leaf {
  seq: number;
  cost: CostBreakdown;
  assignments: Assignment[];
  dropped: string[];
}

const byId = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });
const units = (min: number) => Math.ceil(min / SLOT_MIN);


function candidatesFor(t: PlanTask, s: ShiftState, cons: Constraint[], grid0: number): Cand[] {
  const mine = cons.filter((c) => c.taskId === t.id);
  const avoid = new Set(mine.flatMap((c) => (c.type === 'avoid_staff' ? [c.staffId] : [])));
  const prefer = new Set(mine.flatMap((c) => (c.type === 'prefer_staff' ? [c.staffId] : [])));
  const notBefore = Math.max(grid0, ...mine.flatMap((c) => (c.type === 'not_before' ? [c.time] : [])));
  const lo = grid0 + Math.ceil((notBefore - grid0) / SLOT_MIN) * SLOT_MIN;
  const hi = Math.min(s.shiftEnd - t.durationMin, t.priority === 'essential' ? t.latest : Infinity);
  const eligible = s.staff.filter((m) => t.allowedRoles.includes(m.role) && !avoid.has(m.id)).map((m) => m.id).sort(byId);
  const combos = t.needsSecondStaff ? eligible.flatMap((a, i) => eligible.slice(i + 1).map((b) => [a, b])) : eligible.map((a) => [a]);
  const start0 = Math.max(t.due, grid0);
  const staff0 = new Set([t.assignee, t.secondAssignee].filter((x): x is string => !!x));
  const out: Cand[] = [];
  for (const staff of combos) {
    const reassign = staff.filter((x) => !staff0.has(x)).length * WEIGHTS.reassignment;
    const pref = -staff.filter((x) => prefer.has(x)).length * WEIGHTS.prefer;
    for (let start = lo; start <= hi; start += SLOT_MIN) {
      const end = start + t.durationMin;
      if (s.blocks.some((b) => staff.includes(b.staffId) && start < b.to && b.from < end)) continue;
      const late = t.priority === 'flexible' ? Math.max(0, units(start - t.due)) * WEIGHTS.lateness : 0;
      const move = units(Math.abs(start - start0)) * WEIGHTS.timeMove;
      out.push({ start, staff, late, reassign, move, prefer: pref, cost: late + reassign + move + pref });
    }
  }
  return out.sort((a, b) => a.cost - b.cost || byId(a.staff.join(), b.staff.join()) || a.start - b.start);
}

function unplacedReason(t: PlanTask, s: ShiftState, cons: Constraint[], grid0: number, cands: Cand[]): string {
  const avoid = cons.filter((c) => c.taskId === t.id && c.type === 'avoid_staff').map((c) => (c as { staffId: string }).staffId);
  const roles = s.staff.filter((m) => t.allowedRoles.includes(m.role));
  if (!roles.length) return `no on-shift staff with role ${t.allowedRoles.join('/')}`;
  if (!roles.some((m) => !avoid.includes(m.id))) return `every on-shift ${t.allowedRoles.join('/')} is excluded (${avoid.join(', ')})`;
  const nb = Math.max(grid0, ...cons.filter((c) => c.taskId === t.id && c.type === 'not_before').map((c) => (c as { time: number }).time));
  const hi = t.priority === 'essential' ? t.latest : s.shiftEnd - t.durationMin;
  if (nb > hi) return `earliest retry ${fmtMin(nb)} is after the latest safe start ${fmtMin(hi)}`;
  if (!cands.length) return `all eligible staff are busy until after ${fmtMin(hi)}`;
  return `no slot before ${fmtMin(hi)} without moving another essential task past its safe time`;
}

export function solve(input: SolveInput): SolveResult {
  const { state, constraints } = input;
  const K = input.maxOptions ?? 3;
  const nodeLimit = input.nodeLimit ?? 2_000_000;
  const prefix = input.idPrefix ?? 'opt-';
  const grid0 = Math.ceil(state.now / SLOT_MIN) * SLOT_MIN;
  const excluded = new Set(input.exclude ?? []);
  const tasks = state.tasks.filter((t) => !excluded.has(t.id)).sort((a, b) => a.latest - b.latest || byId(a.id, b.id));
  const n = tasks.length;
  const cands = tasks.map((t) => candidatesFor(t, state, constraints, grid0));
  const dropCost = tasks.map((t) => UNPLACED_PENALTY[t.priority]);
  const keyIdx = input.keyTaskId ? tasks.findIndex((t) => t.id === input.keyTaskId) : -1;

  const restMin = new Array<number>(n + 1).fill(0);
  const restDur = new Array<number>(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    restMin[i] = restMin[i + 1] + Math.min(dropCost[i], cands[i][0]?.cost ?? Infinity);
    restDur[i] = restDur[i + 1] + tasks[i].durationMin;
  }

  const staffIds = state.staff.map((m) => m.id);
  const load0 = new Map(staffIds.map((id) => [id, 0]));
  for (const t of tasks) {
    for (const id of new Set([t.assignee, t.secondAssignee])) if (id && load0.has(id)) load0.set(id, load0.get(id)! + t.durationMin);
  }
  const spread0 = units(Math.max(...load0.values()) - Math.min(...load0.values()));
  const balanceCost = (maxLoad: number, minLoad: number) => Math.max(0, units(maxLoad - minLoad) - spread0) * WEIGHTS.balance;
  const load = new Map(staffIds.map((id) => [id, 0]));
  const occ = new Map<string, [number, number][]>(staffIds.map((id) => [id, []]));
  const chosen: (Cand | null)[] = new Array(n).fill(null);
  const best = new Map<string, Leaf>();
  let seq = 0;
  let nodes = 0;
  let aborted = false;
  let curKey: string | undefined;

  const keyOf = (c: Cand | null) => (c ? `${c.start}|${c.staff.join('+')}` : 'unplaced');
  let kthVal = Infinity;
  const kth = () => kthVal;
  const keyBound = (key: string | undefined) => {
    const g = kth();
    const own = key !== undefined ? best.get(key)?.cost.total ?? Infinity : Infinity;
    return Math.min(g, own);
  };
  const balanceLB = (i: number) => {
    let max = -Infinity;
    let minReach = Infinity;
    for (const id of staffIds) {
      const l = load.get(id)!;
      max = Math.max(max, l);
      minReach = Math.min(minReach, l + restDur[i]);
    }
    return balanceCost(max, minReach);
  };
  const free = (c: Cand, dur: number) =>
    c.staff.every((id) => occ.get(id)!.every(([a, b]) => c.start >= b || a >= c.start + dur));

  const leaf = () => {
    let late = 0, reassign = 0, move = 0, prefer = 0, unplaced = 0;
    const assignments: Assignment[] = [];
    const dropped: string[] = [];
    chosen.forEach((c, i) => {
      if (!c) { unplaced += dropCost[i]; dropped.push(tasks[i].id); return; }
      late += c.late; reassign += c.reassign; move += c.move; prefer += c.prefer;
      assignments.push({ taskId: tasks[i].id, start: c.start, staff: c.staff });
    });
    const loads = [...load.values()];
    const balance = balanceCost(Math.max(...loads), Math.min(...loads));
    const total = late + reassign + move + prefer + unplaced + balance;
    const key = keyIdx >= 0 ? curKey! : assignments.map((a) => `${a.taskId}@${a.start}:${a.staff.join('+')}`).join(',') + `|${dropped.join(',')}`;
    const prev = best.get(key);
    if (prev && prev.cost.total <= total) return;
    best.set(key, { seq: seq++, cost: { lateness: late, reassignment: reassign, timeMoves: move, balance, preference: prefer, unplaced, total }, assignments, dropped });
    const sorted = [...best.entries()].sort((a, b) => a[1].cost.total - b[1].cost.total || a[1].seq - b[1].seq);
    if (keyIdx < 0) for (const [k] of sorted.slice(K)) best.delete(k);
    kthVal = sorted.length >= K ? sorted[K - 1][1].cost.total : Infinity;
  };

  const place = (i: number, c: Cand | null, partial: number) => {
    const t = tasks[i];
    if (c) {
      for (const id of c.staff) { occ.get(id)!.push([c.start, c.start + t.durationMin]); load.set(id, load.get(id)! + t.durationMin); }
    }
    chosen[i] = c;
    const prevKey = curKey;
    if (i === keyIdx) curKey = keyOf(c);
    dfs(i + 1, partial);
    curKey = prevKey;
    chosen[i] = null;
    if (c) {
      for (const id of c.staff) { occ.get(id)!.pop(); load.set(id, load.get(id)! - t.durationMin); }
    }
  };

  const dfs = (i: number, partial: number) => {
    if (aborted) return;
    if (i === n) { leaf(); return; }
    const balLB = balanceLB(i);
    const known = keyIdx >= 0 && i > keyIdx ? curKey : undefined;
    for (const c of cands[i]) {
      if (++nodes > nodeLimit) { aborted = true; return; }
      const lb = partial + c.cost + restMin[i + 1] + balLB;
      if (lb >= keyBound(known)) break;
      if (i === keyIdx && lb >= keyBound(keyOf(c))) continue;
      if (!free(c, tasks[i].durationMin)) continue;
      place(i, c, partial + c.cost);
      if (aborted) return;
    }
    const lb = partial + dropCost[i] + restMin[i + 1] + balLB;
    if (lb < keyBound(i === keyIdx ? 'unplaced' : known)) place(i, null, partial + dropCost[i]);
  };

  dfs(0, 0);

  const ranked = [...best.values()].sort((a, b) => a.cost.total - b.cost.total || a.seq - b.seq).slice(0, K);
  const options: PlanOption[] = ranked.map((l, k) => ({
    id: `${prefix}${String.fromCharCode(97 + k)}`,
    cost: l.cost,
    assignments: l.assignments,
    unplaced: l.dropped.map((id) => {
      const i = tasks.findIndex((t) => t.id === id);
      return { taskId: id, reason: unplacedReason(tasks[i], state, constraints, grid0, cands[i]) };
    }),
    constraints,
  }));
  const unplaced: Unplaced[] = options[0]?.unplaced ?? [];
  const essentialMissing = unplaced.filter((u) => state.tasks.find((t) => t.id === u.taskId)?.priority === 'essential');
  return { feasible: essentialMissing.length === 0, options, unplaced, nodes, exhaustive: !aborted };
}

export function diffPlan(state: ShiftState, option: PlanOption): Change[] {
  const grid0 = Math.ceil(state.now / SLOT_MIN) * SLOT_MIN;
  const out: Change[] = [];
  for (const a of option.assignments) {
    const t = state.tasks.find((x) => x.id === a.taskId)!;
    const start0 = Math.max(t.due, grid0);
    const staff0 = [t.assignee, t.secondAssignee].filter((x): x is string => !!x);
    const sameStaff = staff0.length === a.staff.length && a.staff.every((x) => staff0.includes(x));
    if (sameStaff && a.start === start0) continue;
    out.push({
      taskId: t.id,
      title: t.title,
      residentLabel: t.residentLabel,
      from: { time: fmtMin(t.due), assignee: t.assignee, ...(t.secondAssignee ? { second: t.secondAssignee } : {}) },
      to: { time: fmtMin(a.start), assignee: a.staff[0], ...(a.staff[1] ? { second: a.staff[1] } : {}) },
    });
  }
  return out;
}
