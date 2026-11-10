import raw from '../v01/demoData.json';
import type { ClientTask, PlanTask, Priority, Role, ShiftState, StaffBlock, StaffMember } from './types';

const ALL_ROLES: Role[] = ['PSW', 'RPN', 'RN'];

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const fmtMin = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const clock = (iso: string) => iso.slice(11, 16);

interface RawTask {
  id: string;
  resident: string | string[];
  title: string;
  due: string;
  priority: Priority;
  status: string;
  assignee?: string;
  second_assignee?: string;
  duration_min?: number;
  latest?: string;
  allowed_roles?: string[];
  kind?: string;
  needs_second_staff?: boolean;
  carried_over?: { attempts: number };
}

const RAW_TASKS = raw.tasks_today as RawTask[];
const residents = new Map(raw.residents.map((r) => [r.id, r]));

export const DEMO_NOW = toMin(clock(raw.meta.demo_now));

function currentShift(now: number) {
  return raw.shifts.find((s) => {
    const start = toMin(clock(s.start));
    const end = toMin(clock(s.end));
    return start < end ? now >= start && now < end : now >= start || now < end;
  })!;
}

export function residentLabel(ids: string[]) {
  const rooms = ids.map((id) => `Rm ${residents.get(id)?.room ?? id}`).join(', ');
  return ids.length === 1 ? `${rooms} · ${residents.get(ids[0])?.name ?? ids[0]}` : rooms;
}

export function residentName(id: string) {
  return residents.get(id)?.name ?? id;
}

const shortName = (name: string) => {
  const [first, last] = name.split(' ');
  return last ? `${first} ${last[0]}.` : first;
};

export function allStaff(): StaffMember[] {
  return raw.staff.map((s) => ({
    id: s.id,
    name: s.name,
    short: shortName(s.name),
    role: s.role as Role,
    chargeNurse: 'charge_nurse' in s && !!s.charge_nurse,
  }));
}

export function staffById(id: string): StaffMember | undefined {
  return allStaff().find((s) => s.id === id);
}

export function defaultClientTasks(): ClientTask[] {
  return RAW_TASKS.map((t) => ({
    id: t.id,
    due: t.due,
    status: t.status === 'overdue' ? 'open' : t.status,
    assignee: t.assignee,
    secondAssignee: t.second_assignee,
    attempts: t.carried_over?.attempts ?? 0,
  }));
}

function toPlanTask(t: RawTask, c: ClientTask): PlanTask {
  const due = toMin(c.due);
  const res = Array.isArray(t.resident) ? t.resident : [t.resident];
  return {
    id: t.id,
    title: t.title,
    residents: res,
    residentLabel: residentLabel(res),
    kind: t.kind ?? 'other',
    priority: t.priority,
    due,
    latest: t.latest ? Math.max(toMin(t.latest), due) : t.priority === 'essential' ? due + 30 : -1,
    durationMin: t.duration_min ?? 15,
    allowedRoles: (t.allowed_roles as Role[] | undefined) ?? ALL_ROLES,
    assignee: c.assignee ?? t.assignee ?? 's1',
    secondAssignee: c.secondAssignee ?? t.second_assignee,
    needsSecondStaff: !!t.needs_second_staff,
    attempts: c.attempts ?? t.carried_over?.attempts ?? 0,
  };
}

export function buildShiftState(clientTasks: ClientTask[] = defaultClientTasks(), blocks: StaffBlock[] = []): ShiftState {
  const now = DEMO_NOW;
  const shift = currentShift(now);
  const shiftEnd = toMin(clock(shift.end));
  const next = raw.shifts.find((s) => s.start === shift.end);
  const staff = allStaff().filter((s) => raw.staff.find((r) => r.id === s.id)!.shift === shift.id);
  const byId = new Map(RAW_TASKS.map((t) => [t.id, t]));
  const tasks = clientTasks
    .filter((c) => c.status === 'open' && byId.has(c.id))
    .map((c) => toPlanTask(byId.get(c.id)!, c))
    .map((t) => (t.latest < 0 ? { ...t, latest: shiftEnd } : t));
  return {
    shiftId: shift.id,
    now,
    shiftEnd,
    staff,
    tasks,
    blocks,
    nextShift: { id: next?.id ?? '', staffId: raw.staff.find((s) => next && s.shift === next.id && s.role === 'PSW')?.id },
  };
}
