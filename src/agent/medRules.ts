import { adviseOnMedRefusal, adviseOnRefusal, isMedication } from '../v01/rules';
import { fmtMin, residentName } from './state';
import type { Action, Constraint, PlanOption, PlanTask, RefusalEvent, RulesResult, ShiftState } from './types';

export const MIN_RETRY_GAP_MIN = 15;

export function chargeNurse(state: ShiftState) {
  return state.staff.find((s) => s.chargeNurse);
}

function floorNurse(state: ShiftState) {
  return state.staff.find((s) => !s.chargeNurse && (s.role === 'RPN' || s.role === 'RN'));
}

export function targetTask(event: RefusalEvent, state: ShiftState): PlanTask {
  const t = state.tasks.find((x) => x.id === event.taskId);
  if (!t) throw new Error(`Task ${event.taskId} is not an open task on this shift`);
  return t;
}

export function evaluate(event: RefusalEvent, state: ShiftState): RulesResult {
  const task = targetTask(event, state);
  const attempts = Math.max(1, event.attempts);
  const retryFrom = state.now + MIN_RETRY_GAP_MIN;
  const retry: Constraint = { type: 'not_before', taskId: task.id, time: retryFrom, source: 'rules' };
  const name = residentName(task.residents[0]);
  const base = { taskId: task.id, priority: task.priority, attempts, excludeTarget: false };

  if (isMedication(task)) {
    const windowOpen = retryFrom <= task.latest;
    const advice = adviseOnMedRefusal(attempts, windowOpen, name);
    const escalateTo = chargeNurse(state)?.id;
    if (advice.suggestion === 'escalate_charge_nurse') {
      const actions: Action[] = windowOpen ? ['final_attempt', 'escalate_charge_nurse', 'log_missed'] : ['escalate_charge_nurse', 'log_missed'];
      return {
        ...base,
        isMed: true,
        allowedActions: actions,
        hardConstraints: [retry],
        mustEscalate: true,
        escalateTo,
        logAsMissed: true,
        summary: `${advice.title} ${advice.detail}`,
      };
    }
    return {
      ...base,
      isMed: true,
      allowedActions: ['retry_same_staff', 'retry_different_staff', 'flag_nurse'],
      hardConstraints: [retry],
      mustEscalate: false,
      escalateTo,
      logAsMissed: false,
      summary: `${advice.title} ${advice.detail} Safe window closes at ${fmtMin(task.latest)}.`,
    };
  }

  const advice = adviseOnRefusal(task.priority, attempts, name);
  const common = { ...base, isMed: false, mustEscalate: false, escalateTo: floorNurse(state)?.id, logAsMissed: false, summary: `${advice.title} ${advice.detail}` };
  if (advice.suggestion === 'hand_off') {
    return {
      ...common,
      allowedActions: ['hand_off', 'retry_this_shift', 'flag_nurse'],
      hardConstraints: [],
      handoff: { toShift: state.nextShift.id, toStaff: state.nextShift.staffId },
      excludeTarget: true,
    };
  }
  return {
    ...common,
    allowedActions: task.priority === 'essential' ? ['retry_this_shift', 'flag_nurse'] : ['retry_this_shift', 'flag_nurse', 'hand_off'],
    hardConstraints: [retry],
  };
}

export function verifyOption(state: ShiftState, option: PlanOption, constraints: Constraint[], rules: RulesResult): string[] {
  const v: string[] = [];
  const staff = new Map(state.staff.map((s) => [s.id, s]));
  const tasks = new Map(state.tasks.map((t) => [t.id, t]));
  const busy = new Map<string, [number, number, string][]>();
  for (const b of state.blocks) busy.set(b.staffId, [...(busy.get(b.staffId) ?? []), [b.from, b.to, b.reason]]);

  const covered = new Set([...option.assignments.map((a) => a.taskId), ...option.unplaced.map((u) => u.taskId)]);
  for (const t of state.tasks) {
    if (rules.excludeTarget && t.id === rules.taskId) continue;
    if (!covered.has(t.id)) v.push(`${t.id} missing from plan`);
  }
  if (rules.excludeTarget && covered.has(rules.taskId)) v.push(`${rules.taskId} should be handed off, not re-planned`);

  for (const a of option.assignments) {
    const t = tasks.get(a.taskId);
    if (!t) { v.push(`${a.taskId} is not an open task`); continue; }
    const need = t.needsSecondStaff ? 2 : 1;
    if (a.staff.length !== need || new Set(a.staff).size !== need) v.push(`${t.id} needs ${need} distinct staff`);
    for (const sid of a.staff) {
      const s = staff.get(sid);
      if (!s) v.push(`${t.id}: ${sid} is not on shift`);
      else if (!t.allowedRoles.includes(s.role)) v.push(`${t.id}: ${s.role} may not do ${t.kind}`);
    }
    if (a.start < state.now) v.push(`${t.id} starts before now`);
    if (a.start + t.durationMin > state.shiftEnd) v.push(`${t.id} runs past shift end`);
    if (t.priority === 'essential' && a.start > t.latest) v.push(`${t.id} starts after its latest safe time`);
    for (const c of constraints) {
      if (c.taskId !== t.id) continue;
      if (c.type === 'not_before' && a.start < c.time) v.push(`${t.id} starts before ${fmtMin(c.time)}`);
      if (c.type === 'avoid_staff' && a.staff.includes(c.staffId)) v.push(`${t.id} assigned to avoided staff ${c.staffId}`);
    }
    for (const sid of a.staff) {
      const list = busy.get(sid) ?? [];
      for (const [from, to, what] of list) {
        if (a.start < to && from < a.start + t.durationMin) v.push(`${sid} double-booked: ${t.id} overlaps ${what}`);
      }
      busy.set(sid, [...list, [a.start, a.start + t.durationMin, t.id]]);
    }
  }
  return v;
}
