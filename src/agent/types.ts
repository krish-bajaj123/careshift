export type Role = 'PSW' | 'RPN' | 'RN';
export type Priority = 'essential' | 'flexible';

export interface StaffMember {
  id: string;
  name: string;
  short: string;
  role: Role;
  chargeNurse: boolean;
}

export interface PlanTask {
  id: string;
  title: string;
  residents: string[];
  residentLabel: string;
  kind: string;
  priority: Priority;
  due: number;
  latest: number;
  durationMin: number;
  allowedRoles: Role[];
  assignee: string;
  secondAssignee?: string;
  needsSecondStaff: boolean;
  attempts: number;
}

export interface StaffBlock {
  staffId: string;
  from: number;
  to: number;
  reason: string;
}

export interface ShiftState {
  shiftId: string;
  now: number;
  shiftEnd: number;
  staff: StaffMember[];
  tasks: PlanTask[];
  blocks: StaffBlock[];
  nextShift: { id: string; staffId?: string };
}

export interface RefusalEvent {
  taskId: string;
  reasonChip?: string;
  note?: string;
  attempts: number;
  at?: string;
}

export type Constraint =
  | { type: 'not_before'; taskId: string; time: number; source: string }
  | { type: 'avoid_staff'; taskId: string; staffId: string; source: string }
  | { type: 'prefer_staff'; taskId: string; staffId: string; source: string };

export type Action =
  | 'retry_same_staff'
  | 'retry_different_staff'
  | 'retry_this_shift'
  | 'final_attempt'
  | 'flag_nurse'
  | 'hand_off'
  | 'escalate_charge_nurse'
  | 'log_missed';

export interface RulesResult {
  taskId: string;
  isMed: boolean;
  priority: Priority;
  attempts: number;
  allowedActions: Action[];
  hardConstraints: Constraint[];
  mustEscalate: boolean;
  escalateTo?: string;
  logAsMissed: boolean;
  handoff?: { toShift: string; toStaff?: string };
  excludeTarget: boolean;
  summary: string;
}

export interface Assignment {
  taskId: string;
  start: number;
  staff: string[];
}

export interface CostBreakdown {
  lateness: number;
  reassignment: number;
  timeMoves: number;
  balance: number;
  preference: number;
  unplaced: number;
  total: number;
}

export interface Unplaced {
  taskId: string;
  reason: string;
}

export interface PlanOption {
  id: string;
  cost: CostBreakdown;
  assignments: Assignment[];
  unplaced: Unplaced[];
  constraints: Constraint[];
}

export interface SolveResult {
  feasible: boolean;
  options: PlanOption[];
  unplaced: Unplaced[];
  nodes: number;
  exhaustive: boolean;
}

export interface Slot {
  time: string;
  assignee: string;
  second?: string;
}

export interface Change {
  taskId: string;
  title: string;
  residentLabel: string;
  from: Slot;
  to: Slot;
}

export interface TraceStep {
  step: string;
  detail: string;
}

export interface OptionSummary {
  id: string;
  cost: CostBreakdown;
  assignments: { taskId: string; start: string; staff: string[] }[];
  changes: Change[];
  unplaced: Unplaced[];
}

export interface PipelineResult {
  source: 'agent' | 'fallback';
  taskId: string;
  escalation?: { to: string; toName: string; reason: string; logAsMissed: boolean };
  handoff?: { taskId: string; toShift: string; toStaff?: string };
  allowedActions: Action[];
  options: OptionSummary[];
  chosen: OptionSummary;
  constraintsUsed: Constraint[];
  changes: Change[];
  explanation: string;
  notify: string[];
  trace: TraceStep[];
}

export interface ClientTask {
  id: string;
  due: string;
  status: string;
  assignee?: string;
  secondAssignee?: string;
  attempts?: number;
}
