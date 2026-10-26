/**
 * CareShift v0.0 Data Types
 */

export type TaskType = 'medication' | 'meal' | 'shower' | 'vitals' | 'reposition' | 'activity';

export type TaskStatus = 'planned' | 'done' | 'refused' | 'asleep' | 'agitated' | 'escalated';

export type StaffRole = 'RN' | 'PSW' | 'Charge' | 'Rec';

export interface StaffMember {
  id: string;
  name: string; // 'Sam', 'Priya', 'Jordan', 'Alex', 'Morgan'
  role: StaffRole;
}

export interface CareTask {
  id: string;
  residentId: string;
  type: TaskType;
  title: string;
  staff: string; // e.g. 'Priya', 'Jordan', 'Sam', 'Morgan'
  time: string; // HH:MM, e.g. "09:00"
  earliest: string; // HH:MM
  latest: string; // HH:MM
  durationMin: number;
  movable: boolean;
  status: TaskStatus;
  attemptCount: number;
  refusalReason?: string;
  notes?: string;
}

export type AutonomyAllowedAction = 'pills' | 'shower' | 'activities';

export interface ResidentHistoryDay {
  dayOffset: number; // -4, -3, -2, -1, 0 (0 is today)
  refusedTaskTypes: TaskType[];
  asleepTaskTypes?: TaskType[];
  agitatedTaskTypes?: TaskType[];
}

export interface ResidentDayRecord {
  dayOffset: number; // -6 to 0 (0 is today)
  dateLabel: string; // "Oct 21", "Oct 22", ... "Today"
  confusionMentions: number;
  mealIntakePercent: number; // e.g. 85, 75, 40
  refusalCount: number;
  requestCount: number;
}

export interface StructuredProgressNote {
  id: string;
  residentId: string;
  residentName: string;
  room: string;
  rawTranscript: string;
  cognition: string;
  intake: string;
  mood: string;
  mobility: string;
  other: string;
  confirmedAt: string;
  nurse: string;
}

export type TrendFollowUpType = 'physician review' | 'pharmacist medication review' | 'family care conference';

export interface TrendAnalysis {
  residentId: string;
  residentName: string;
  room: string;
  risingConfusion: boolean;
  confusionStart: number;
  confusionEnd: number;
  confusionDelta24h: number;
  urgentDeliriumAlert?: string;
  fallingMealIntake: boolean;
  mealStart: number;
  mealEnd: number;
  mealDropPercent: number;
  moreRefusals: boolean;
  refusalsStart: number;
  refusalsEnd: number;
  refusalIncrease: number;
  fewerRequests: boolean;
  requestsStart: number;
  requestsEnd: number;
  requestDrop: number;
  proposedFollowUp?: {
    type: TrendFollowUpType;
    title: string;
    reason: string;
    escalateTo: string;
  };
}

export interface Resident {
  id: string;
  name: string; // "Daniel D."
  firstName: string; // "Daniel"
  room: string;
  stage: 'mild' | 'moderate' | 'later stage';
  preferredStaff: string; // e.g. "Priya"
  assignedPsw: string; // e.g. "Priya" or "Jordan"
  allowedChoices: AutonomyAllowedAction[];
  careTip?: string;
  avatarUrl?: string;
  history: ResidentHistoryDay[];
  sevenDayHistory: ResidentDayRecord[];
  currentResponseStatus?: {
    message: string;
    type: 'pending' | 'accepted' | 'declined' | 'alternative';
    timestamp: string;
  };
}

export type ProposalType = 'retry' | 'request' | 'escalation' | 'trend_followup';

export type ProposalStatus = 'pending' | 'approved' | 'declined';

export interface ProposalOutcome {
  verdict: 'Fits' | 'FitsIfMoved' | 'CantHappen';
  description: string;
  suggestedTime?: string;
  suggestedStaff?: string;
  taskToMoveId?: string;
  taskToMoveNewTime?: string;
  alternativeSuggestion?: string;
}

export interface Proposal {
  id: string;
  residentId: string;
  type: ProposalType;
  taskId?: string; // If related to a task
  taskType?: TaskType;
  title: string;
  reason: string;
  proposedTime?: string;
  proposedStaff?: string;
  outcome?: ProposalOutcome;
  escalateTo?: string; // e.g. "Alex (Charge RN)"
  status: ProposalStatus;
  createdAtTime: string;
  resolvedAtTime?: string;
  resolutionNote?: string;
}

export interface AuditEvent {
  id: string;
  simulatedTime: string; // e.g. "08:45"
  realTime: string; // ISO string
  actor: string; // "Resident Daniel", "Nurse Sam", "Rules Engine", "Alex", etc.
  action: string;
  details: string;
  badgeType?: 'info' | 'success' | 'warning' | 'alert';
}

export interface UrgentAlert {
  id: string;
  residentId: string;
  residentName: string;
  room: string;
  time: string;
  acknowledged: boolean;
  resolved: boolean;
}

export interface ResidentChoiceOption {
  id: string;
  label: string;
  requestType: 'pills_ready' | 'pills_not_now' | 'shower_now' | 'shower_after_lunch' | 'activity_music' | 'activity_garden';
  details: string;
}

export interface ShiftSnapshot {
  simulatedTime: string;
  completedTasksCount: number;
  totalTasksCount: number;
  outstandingTasks: Array<{
    resident: string;
    type: TaskType;
    title: string;
    scheduledTime: string;
    status: TaskStatus;
    reason: string;
    earliest: string;
    latest: string;
  }>;
  escalations: Array<{
    resident: string;
    title: string;
    reason: string;
    time: string;
    escalateTo: string;
  }>;
  openRequests: Array<{
    resident: string;
    request: string;
    status: ProposalStatus;
  }>;
  flaggedPatterns: string[];
  watchForItems: Array<{
    resident: string;
    tip: string;
  }>;
  confirmedProgressNotes: StructuredProgressNote[];
  trendAnalyses: TrendAnalysis[];
}
