import raw from './demoData.json';
import type { Priority } from './rules';
import { durationFor } from '../agent/durations';

export interface Resident { id: string; room: number; name: string; info: string }
export interface Task {
  id: string; res: string[]; title: string; due: string; priority: Priority;
  status: 'open' | 'done' | 'handed' | 'flagged';
  overdue?: boolean; tags?: { kind: 'y' | 'g'; text: string }[];
  attempts?: number; place?: string; needsSecondStaff?: boolean; lastNote?: string; doneWith?: string;
  assignee: string; secondAssignee?: string; kind?: string;
  /** Passed by a coworker; waiting for the receiver to accept */
  incoming?: { from: string; why: string; at: string };
  /** Waiting for the charge nurse to approve a move */
  waiting?: string;
  allowedRoles?: string[];
  /** Created from an "I Noticed" slip or form */
  fromNoticed?: string;
}

export interface Approval {
  id: string; taskId: string; from: string; to: string; why: string; reason: string; kind: 'pass' | 'plan'; plan?: unknown;
  status: 'pending' | 'approved' | 'denied' | 'stale';
  /** Task state when the request was made; approving is blocked if it changed since (TC2) */
  snapshot: string;
}
/** What has to stay the same between asking and approving. */
export const taskVersion = (t: Task) => [t.status, t.assignee, t.due, t.secondAssignee ?? ''].join('|');

/** One hand-off rule for every button and save (TC2): essential tasks and meds never wait for the next shift. */
export const canHandOff = (t: Pick<Task, 'priority' | 'kind'>) => t.priority !== 'essential' && t.kind !== 'med';

/** "I Noticed" observation from the paper slip (scanned in a batch) or the QR form. */
export interface Noticed {
  id: string; res: string; category: string; detail: string; when: string; where: string; see: string;
  nurseNow: boolean; by: string; source: 'slip' | 'form'; received: string;
  status: 'new' | 'task' | 'handoff' | 'reviewed'; outcome?: string;
}
const toNoticed = (n: any, received?: string): Noticed => ({
  id: n.id, res: n.resident, category: n.category, detail: n.detail, when: n.when, where: n.where, see: n.see,
  nurseNow: n.nurse_now, by: n.by, source: n.source, received: received ?? n.received, status: 'new',
});
export const initialNoticed = (): Noticed[] => (raw as any).noticed.map((n: any) => toNoticed(n));
/** Paper slips waiting in the locked box until the reviewer scans them. */
export const slipsInBox = (received: string): Noticed[] => (raw as any).noticed_box.map((n: any) => toNoticed(n, received));
export const NOTICE_CATEGORIES = ['Eating / drinking', 'Mood', 'Sleep', 'Mobility', 'Pain / discomfort', 'Other'];
export const NOTICE_SEE = ['Nurse', 'Dietitian', 'Recreation', 'Not sure'];
export interface AuditRow { at: string; text: string }

/** Learned duration for the task (median of logged times, 80th percentile for planning). */
export const taskDuration = (t: Pick<Task, 'res' | 'kind'>) => durationFor(t.res.length === 1 ? t.res[0] : undefined, t.kind);
export const onShiftStaff = () => raw.staff.filter((x: any) => x.shift === shiftNow.id);
export const isCharge = (id: string) => !!STAFF[id]?.charge_nurse;
export interface Note { res: string; text: string; src: string }
export interface WeekDay { day: string; mood: 'bright' | 'okay' | 'low' | 'none'; sleep: string; meals: string; fluids: string; activities: string }

const infoFor = (r: any) =>
  [`${cap(r.dementia_stage)} dementia`, r.mobility, r.transfer, r.continence, r.diet, r.prefers && `prefers ${r.prefers}`]
    .filter(Boolean).join(' · ');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (hhmm: string) => hhmm.replace(/^0/, '');

export const RESIDENTS: Record<string, Resident> = Object.fromEntries(
  raw.residents.map((r: any) => [r.id, { id: r.id, room: r.room, name: r.name, info: infoFor(r) }]),
);

export const STAFF: Record<string, any> = Object.fromEntries(raw.staff.map((s: any) => [s.id, s]));

export const staffShort = (id: string) => {
  const [first, last] = (STAFF[id]?.name ?? id).split(' ');
  return last ? `${first} ${last[0]}.` : first;
};

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const ampm = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
};
const nowMin = toMin(raw.meta.demo_now.slice(11, 16));
const shiftNow = raw.shifts.find((s) => toMin(s.start.slice(11, 16)) <= nowMin && nowMin < toMin(s.end.slice(11, 16)))!;
const shiftEnd = toMin(shiftNow.end.slice(11, 16));
export const SHIFT_MIN = { now: nowMin, end: shiftEnd };

export const SHIFT = {
  unit: raw.meta.unit,
  label: `${cap(shiftNow.type)} shift ${ampm(toMin(shiftNow.start.slice(11, 16)))} – ${ampm(shiftEnd)}`,
  now: ampm(nowMin),
  left: `${Math.floor((shiftEnd - nowMin) / 60)} h ${(shiftEnd - nowMin) % 60} m left`,
};

export function initialTasks(): Task[] {
  return raw.tasks_today.map((t: any) => {
    const tags: Task['tags'] = [];
    if (t.tags) t.tags.forEach((x: string) => tags.push({ kind: 'y', text: x }));
    if (t.carried_over) tags.push({ kind: 'g', text: 'Carried over · refused at 6 am' });
    return {
      id: t.id,
      res: Array.isArray(t.resident) ? t.resident : [t.resident],
      title: t.title,
      due: fmt(t.due),
      priority: t.priority,
      status: t.status === 'done' ? 'done' : 'open',
      overdue: t.status === 'overdue',
      tags,
      attempts: t.carried_over?.attempts ?? 0,
      place: t.location,
      needsSecondStaff: t.needs_second_staff,
      assignee: t.assignee ?? 's1',
      secondAssignee: t.second_assignee,
      kind: t.kind,
      allowedRoles: t.allowed_roles ?? ['PSW', 'RPN', 'RN'],
    } as Task;
  });
}

export function initialNotes(): Note[] {
  return raw.handoff_notes.map((h: any) => ({
    res: h.resident,
    text: h.text,
    src: h.source.startsWith('voice') ? "From Joanne's voice memo (she reviewed it)" : h.source === 'typed' ? 'Typed note' : 'Family portal booking',
  }));
}

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const KAMALA_WEEK: WeekDay[] = raw.kamala_week.map((d: any, i: number) => ({
  day: DAY[i],
  mood: d.mood ?? 'none',
  sleep: d.sleep ? cap(d.sleep.replace('restless (woke ', 'restless — woke ').replace('x)', '×')) : 'Not logged yet',
  meals: d.meal_intake_pct ? `${d.meal_intake_pct.breakfast}/${d.meal_intake_pct.lunch}/${d.meal_intake_pct.dinner}%` : '—',
  fluids: d.fluids ? cap(d.fluids) : '—',
  activities: d.activities.length ? cap(d.activities.join(', ')) : '—',
}));

export const resLabel = (ids: string[]) =>
  ids.map((x) => `Rm ${RESIDENTS[x].room}`).join(', ') + (ids.length === 1 ? ` · ${RESIDENTS[ids[0]].name}` : '');
