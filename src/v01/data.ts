import raw from './demoData.json';
import type { Priority } from './rules';

export interface Resident { id: string; room: number; name: string; info: string }
export interface Task {
  id: string; res: string[]; title: string; due: string; priority: Priority;
  status: 'open' | 'done' | 'handed' | 'flagged';
  overdue?: boolean; tags?: { kind: 'y' | 'g'; text: string }[];
  attempts?: number; place?: string; needsSecondStaff?: boolean; lastNote?: string; doneWith?: string;
}
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

export const STAFF = Object.fromEntries(raw.staff.map((s: any) => [s.id, s]));

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
