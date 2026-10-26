/**
 * CareShift v0.0 - State Store & Event Log Layer
 * Append-only audit log, immutable state transitions, rapid-click guards.
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  CareTask,
  Resident,
  Proposal,
  AuditEvent,
  UrgentAlert,
  ResidentChoiceOption,
  TaskStatus,
  StructuredProgressNote,
} from '../types';
import {
  INITIAL_SIMULATED_TIME,
  INITIAL_RESIDENTS,
  INITIAL_TASKS,
  INITIAL_PROPOSALS,
} from './syntheticData';
import {
  addMinutes,
  handleTaskRefusal,
  checkMissedMedicationWindows,
  evaluateResidentRequest,
  detectRefusalPatterns,
} from './rulesEngine';

interface CareShiftContextType {
  simulatedTime: string;
  residents: Resident[];
  activeResidentId: string;
  tasks: CareTask[];
  proposals: Proposal[];
  auditEvents: AuditEvent[];
  urgentAlerts: UrgentAlert[];
  flaggedPatterns: string[];
  confirmedProgressNotes: StructuredProgressNote[];

  // Progress Notes
  saveConfirmedProgressNote: (note: StructuredProgressNote) => void;

  // Clock Actions
  advanceClock: (minutes: number) => void;
  resetSimulation: () => void;

  // Resident Selection
  setActiveResidentId: (id: string) => void;

  // Task Actions (Nurse)
  markTaskStatus: (taskId: string, newStatus: TaskStatus) => void;

  // Proposal Actions (Nurse)
  approveProposal: (proposalId: string) => void;
  declineProposal: (proposalId: string, reason: string) => void;
  offerAlternativeProposal: (proposalId: string) => void;

  // Resident Actions (Bedside Tablet)
  submitResidentRequest: (residentId: string, choice: ResidentChoiceOption) => void;
  triggerHelp: (residentId: string) => void;

  // Alert Actions (Nurse)
  acknowledgeAlert: (alertId: string) => void;
  resolveAlert: (alertId: string) => void;
}

const CareShiftContext = createContext<CareShiftContextType | null>(null);

// Initial audit events to seed the shift history
const SEED_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'evt_init_1',
    simulatedTime: '07:00',
    realTime: new Date(Date.now() - 105 * 60000).toISOString(),
    actor: 'Simulated Clock',
    action: 'Day Shift Commenced',
    details: 'Shift 07:00–15:00 started. RN Sam on duty with PSWs Priya & Jordan.',
    badgeType: 'info',
  },
  {
    id: 'evt_init_2',
    simulatedTime: '08:00',
    realTime: new Date(Date.now() - 45 * 60000).toISOString(),
    actor: 'Priya (PSW)',
    action: 'Breakfast Completed',
    details: 'Breakfast trays delivered and completed for Daniel, Kamala, Pauline.',
    badgeType: 'success',
  },
  {
    id: 'evt_init_3',
    simulatedTime: '08:00',
    realTime: new Date(Date.now() - 45 * 60000).toISOString(),
    actor: 'Jordan (PSW)',
    action: 'Assisted Feeding Completed',
    details: 'Breakfast completed for Leon, Samuel, and Teresa.',
    badgeType: 'success',
  },
  {
    id: 'evt_init_4',
    simulatedTime: '08:42',
    realTime: new Date(Date.now() - 3 * 60000).toISOString(),
    actor: 'Resident Daniel',
    action: 'Bedside Choice Submitted',
    details: 'Daniel selected: "Shower after lunch (12:45)". Pending Nurse Sam approval.',
    badgeType: 'info',
  },
  {
    id: 'evt_init_5',
    simulatedTime: '08:45',
    realTime: new Date().toISOString(),
    actor: 'Rules Engine',
    action: 'Care Rules Initialized',
    details: 'Deterministic rules engine online. Medication windows set to ±60m.',
    badgeType: 'info',
  },
];

export const CareShiftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [simulatedTime, setSimulatedTime] = useState<string>(INITIAL_SIMULATED_TIME);
  const [residents, setResidents] = useState<Resident[]>(INITIAL_RESIDENTS);
  const [activeResidentId, setActiveResidentId] = useState<string>('res_daniel');
  const [tasks, setTasks] = useState<CareTask[]>(INITIAL_TASKS);
  const [proposals, setProposals] = useState<Proposal[]>(INITIAL_PROPOSALS);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(SEED_AUDIT_EVENTS);
  const [urgentAlerts, setUrgentAlerts] = useState<UrgentAlert[]>([]);
  const [confirmedProgressNotes, setConfirmedProgressNotes] = useState<StructuredProgressNote[]>([]);

  // Rapid click protection lock
  const actionLockRef = useRef<Set<string>>(new Set());

  // Append-only audit logger
  const logEvent = useCallback(
    (actor: string, action: string, details: string, badgeType: AuditEvent['badgeType'] = 'info') => {
      const newEvent: AuditEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        simulatedTime,
        realTime: new Date().toISOString(),
        actor,
        action,
        details,
        badgeType,
      };
      setAuditEvents((prev) => [newEvent, ...prev]);
    },
    [simulatedTime]
  );

  // Save confirmed progress note (Unconfirmed notes never reach here)
  const saveConfirmedProgressNote = useCallback(
    (note: StructuredProgressNote) => {
      setConfirmedProgressNotes((prev) => [note, ...prev]);
      logEvent(
        'Nurse Sam',
        'Progress Note Confirmed',
        `Confirmed note for ${note.residentName} (${note.room}) · Cognition: "${note.cognition || 'Baseline'}" · Intake: "${note.intake || 'As charted'}" · Mood: "${note.mood || 'Calm'}" · Mobility: "${note.mobility || 'Baseline'}"`,
        'success'
      );
    },
    [logEvent]
  );

  // Clock Advancement
  const advanceClock = useCallback(
    (minutes: number) => {
      const newTime = addMinutes(simulatedTime, minutes);
      setSimulatedTime(newTime);
      logEvent('Simulated Clock', `Clock Advanced +${minutes}m`, `Shift time is now ${newTime}.`, 'info');

      // Check if advancing the clock passes any medication's window while not given
      setTasks((prevTasks) => {
        const { updatedTasks, newEscalations } = checkMissedMedicationWindows(prevTasks, newTime, residents);
        if (newEscalations.length > 0) {
          setProposals((prevProposals) => [...newEscalations, ...prevProposals]);
          newEscalations.forEach((esc) => {
            logEvent(
              'Rules Engine',
              'Auto-Escalation to Alex',
              `${esc.title}: ${esc.reason}`,
              'alert'
            );
          });
        }
        return updatedTasks;
      });
    },
    [simulatedTime, residents, logEvent]
  );

  // Reset simulation back to initial synthetic state
  const resetSimulation = useCallback(() => {
    actionLockRef.current.clear();
    setSimulatedTime(INITIAL_SIMULATED_TIME);
    setResidents(INITIAL_RESIDENTS);
    setActiveResidentId('res_daniel');
    setTasks(INITIAL_TASKS);
    setProposals(INITIAL_PROPOSALS);
    setUrgentAlerts([]);
    setConfirmedProgressNotes([]);
    setAuditEvents([
      {
        id: `evt_reset_${Date.now()}`,
        simulatedTime: INITIAL_SIMULATED_TIME,
        realTime: new Date().toISOString(),
        actor: 'Nurse Sam',
        action: 'Simulation Reset',
        details: `Simulation state reset to ${INITIAL_SIMULATED_TIME} baseline.`,
        badgeType: 'warning',
      },
      ...SEED_AUDIT_EVENTS,
    ]);
  }, []);

  // Nurse marks a task: Done, Refused, Asleep, Agitated
  const markTaskStatus = useCallback(
    (taskId: string, newStatus: TaskStatus) => {
      // Rapid-click guard
      const lockKey = `task_action_${taskId}`;
      if (actionLockRef.current.has(lockKey)) return;
      actionLockRef.current.add(lockKey);
      setTimeout(() => actionLockRef.current.delete(lockKey), 600);

      const targetTask = tasks.find((t) => t.id === taskId);
      if (!targetTask) return;

      const resident = residents.find((r) => r.id === targetTask.residentId);
      const resName = resident ? resident.firstName : 'Resident';

      // Rule 4: Only "Done" changes the plan without approval
      if (newStatus === 'done') {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: 'done', attemptCount: t.attemptCount + 1 } : t))
        );
        logEvent(
          'Nurse Sam',
          'Task Marked Done',
          `${targetTask.title} for ${resName} completed at ${simulatedTime}.`,
          'success'
        );
        return;
      }

      // If marked Refused, Asleep, or Agitated:
      // Use Rules Engine to safely re-plan or escalate
      const { updatedTask, proposal } = handleTaskRefusal(
        targetTask,
        newStatus as 'refused' | 'asleep' | 'agitated',
        simulatedTime,
        resident || {
          id: targetTask.residentId,
          name: resName,
          firstName: resName,
          room: '',
          stage: 'mild',
          preferredStaff: 'Priya',
          assignedPsw: 'Priya',
          allowedChoices: [],
          history: [],
          sevenDayHistory: [],
        },
        tasks
      );

      // Update task state
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));

      // Check if duplicate proposal already exists
      setProposals((prev) => {
        const isDuplicate = prev.some(
          (p) => p.taskId === taskId && p.status === 'pending' && p.proposedTime === proposal.proposedTime
        );
        if (isDuplicate) return prev;
        return [proposal, ...prev];
      });

      if (proposal.type === 'escalation') {
        logEvent(
          'Rules Engine',
          'Escalation Generated',
          `${proposal.title} — ${proposal.reason}`,
          'alert'
        );
      } else {
        logEvent(
          'Rules Engine',
          'Retry Proposed',
          `Task marked ${newStatus}. Proposed retry at ${proposal.proposedTime} with ${proposal.proposedStaff}.`,
          'warning'
        );
      }
    },
    [tasks, residents, simulatedTime, logEvent]
  );

  // Nurse Approves a Proposal
  const approveProposal = useCallback(
    (proposalId: string) => {
      // Rapid-click guard
      const lockKey = `proposal_${proposalId}`;
      if (actionLockRef.current.has(lockKey)) return;
      actionLockRef.current.add(lockKey);
      setTimeout(() => actionLockRef.current.delete(lockKey), 600);

      const prop = proposals.find((p) => p.id === proposalId);
      if (!prop || prop.status !== 'pending') return;

      const resident = residents.find((r) => r.id === prop.residentId);
      const resName = resident ? resident.firstName : 'Resident';

      // 1. Mark proposal approved
      setProposals((prev) =>
        prev.map((p) =>
          p.id === proposalId
            ? { ...p, status: 'approved', resolvedAtTime: simulatedTime, resolutionNote: 'Approved by Nurse Sam' }
            : p
        )
      );

      // 2. Apply schedule changes to tasks
      if (prop.type === 'retry' && prop.taskId && prop.proposedTime) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === prop.taskId
              ? {
                  ...t,
                  time: prop.proposedTime!,
                  staff: prop.proposedStaff || t.staff,
                  status: 'planned',
                }
              : t
          )
        );
        logEvent(
          'Nurse Sam',
          'Retry Proposal Approved',
          `Approved retry for ${prop.title}. Rescheduled to ${prop.proposedTime} with ${prop.proposedStaff}.`,
          'success'
        );
      } else if (prop.type === 'request') {
        // Handle Resident Request Approval
        if (prop.taskType === 'shower' && prop.proposedTime) {
          // Move shower to proposed time (e.g. Daniel 12:45 with Priya)
          setTasks((prev) => {
            let nextTasks = prev.map((t) => {
              if (t.residentId === prop.residentId && t.type === 'shower') {
                return {
                  ...t,
                  time: prop.proposedTime!,
                  staff: prop.proposedStaff || t.staff,
                  status: 'planned' as TaskStatus,
                };
              }
              return t;
            });

            // If an outcome required moving another task (e.g., vitals moved to 13:30)
            if (prop.outcome?.taskToMoveId && prop.outcome?.taskToMoveNewTime) {
              nextTasks = nextTasks.map((t) =>
                t.id === prop.outcome?.taskToMoveId
                  ? { ...t, time: prop.outcome.taskToMoveNewTime! }
                  : t
              );
            }
            return nextTasks;
          });

          // Update Resident Bedside Screen plain-language answer:
          // "Yes, shower after lunch with Priya."
          setResidents((prev) =>
            prev.map((r) =>
              r.id === prop.residentId
                ? {
                    ...r,
                    currentResponseStatus: {
                      message: `Yes, shower after lunch with ${prop.proposedStaff || 'Priya'}.`,
                      type: 'accepted',
                      timestamp: simulatedTime,
                    },
                  }
                : r
            )
          );

          logEvent(
            'Nurse Sam',
            'Resident Request Approved',
            `Approved shower at ${prop.proposedTime} with ${prop.proposedStaff} for ${resName}. Resident tablet updated.`,
            'success'
          );
        } else {
          // Other requests (e.g., Activity or Pills ready)
          setResidents((prev) =>
            prev.map((r) =>
              r.id === prop.residentId
                ? {
                    ...r,
                    currentResponseStatus: {
                      message: `Yes, ${prop.title.toLowerCase()} approved with ${prop.proposedStaff || 'staff'}.`,
                      type: 'accepted',
                      timestamp: simulatedTime,
                    },
                  }
                : r
            )
          );

          logEvent(
            'Nurse Sam',
            'Request Approved',
            `Approved ${prop.title} for ${resName}.`,
            'success'
          );
        }
      } else if (prop.type === 'escalation') {
        logEvent(
          'Nurse Sam',
          'Escalation Acknowledged',
          `Nurse Sam signed off on escalation to Alex for ${resName}.`,
          'info'
        );
      } else if (prop.type === 'trend_followup') {
        logEvent(
          'Nurse Sam',
          'Trend Follow-Up Approved',
          `Approved ${prop.title} — ${prop.reason}. Escalated to ${prop.escalateTo || 'Specialist'}.`,
          'success'
        );
      }
    },
    [proposals, residents, simulatedTime, logEvent]
  );

  // Nurse Declines a Proposal with a structured reason
  const declineProposal = useCallback(
    (proposalId: string, reason: string) => {
      // Rapid-click guard
      const lockKey = `proposal_${proposalId}`;
      if (actionLockRef.current.has(lockKey)) return;
      actionLockRef.current.add(lockKey);
      setTimeout(() => actionLockRef.current.delete(lockKey), 600);

      const prop = proposals.find((p) => p.id === proposalId);
      if (!prop || prop.status !== 'pending') return;

      const resident = residents.find((r) => r.id === prop.residentId);
      const resName = resident ? resident.firstName : 'Resident';

      setProposals((prev) =>
        prev.map((p) =>
          p.id === proposalId
            ? { ...p, status: 'declined', resolvedAtTime: simulatedTime, resolutionNote: reason }
            : p
        )
      );

      // Trend follow-up proposals are internal clinical actions; don't post to resident bedside screen
      if (prop.type === 'trend_followup') {
        logEvent(
          'Nurse Sam',
          'Trend Follow-Up Declined',
          `Declined ${prop.title}. Reason: ${reason}.`,
          'warning'
        );
        return;
      }

      // Provide plain-language no-dead-end response to resident
      let residentMessage = '';
      if (prop.outcome?.suggestedTime) {
        residentMessage = `Not right now. How about ${prop.outcome.suggestedTime}?`;
      } else {
        residentMessage = `${prop.proposedStaff || 'Staff'} is with another resident right now. We'll assist you very soon.`;
      }

      setResidents((prev) =>
        prev.map((r) =>
          r.id === prop.residentId
            ? {
                ...r,
                currentResponseStatus: {
                  message: residentMessage,
                  type: 'declined',
                  timestamp: simulatedTime,
                },
              }
            : r
        )
      );

      logEvent(
        'Nurse Sam',
        'Proposal Declined',
        `Declined "${prop.title}" for ${resName}. Reason: ${reason}. Resident notified gently.`,
        'warning'
      );
    },
    [proposals, residents, simulatedTime, logEvent]
  );

  // Nurse Offers Alternative Time to Resident
  const offerAlternativeProposal = useCallback(
    (proposalId: string) => {
      const prop = proposals.find((p) => p.id === proposalId);
      if (!prop || prop.status !== 'pending') return;

      const altTime = prop.outcome?.suggestedTime || '14:00';
      const altStaff = prop.outcome?.suggestedStaff || prop.proposedStaff || 'Priya';

      setProposals((prev) =>
        prev.map((p) =>
          p.id === proposalId
            ? {
                ...p,
                status: 'approved',
                resolvedAtTime: simulatedTime,
                resolutionNote: `Offered alternative: ${altTime} with ${altStaff}`,
              }
            : p
        )
      );

      // Plain language answer for resident: "Not right now. How about 2:00?"
      const formattedTime = altTime === '14:00' ? '2:00' : altTime;
      setResidents((prev) =>
        prev.map((r) =>
          r.id === prop.residentId
            ? {
                ...r,
                currentResponseStatus: {
                  message: `Not right now. How about ${formattedTime}?`,
                  type: 'alternative',
                  timestamp: simulatedTime,
                },
              }
            : r
        )
      );

      logEvent(
        'Nurse Sam',
        'Alternative Offered',
        `Offered ${altTime} to ${prop.residentId}. Resident screen updated with suggestion.`,
        'info'
      );
    },
    [proposals, simulatedTime, logEvent]
  );

  // Resident submits a choice on bedside tablet
  const submitResidentRequest = useCallback(
    (residentId: string, choice: ResidentChoiceOption) => {
      // Rapid-click guard
      const lockKey = `resident_req_${residentId}_${choice.requestType}`;
      if (actionLockRef.current.has(lockKey)) return;
      actionLockRef.current.add(lockKey);
      setTimeout(() => actionLockRef.current.delete(lockKey), 600);

      const resident = residents.find((r) => r.id === residentId);
      if (!resident) return;

      // 1. Immediately show "Asking Sam…" on bedside tablet
      setResidents((prev) =>
        prev.map((r) =>
          r.id === residentId
            ? {
                ...r,
                currentResponseStatus: {
                  message: 'Asking Sam…',
                  type: 'pending',
                  timestamp: simulatedTime,
                },
              }
            : r
        )
      );

      // 2. Rules engine evaluates request against schedule and staff availability
      const { outcome, proposedTime, proposedStaff, title, reason } = evaluateResidentRequest(
        resident,
        choice.requestType,
        simulatedTime,
        tasks.filter((t) => t.residentId === residentId),
        tasks
      );

      // 3. Create Proposal in Nurse's "Needs your approval"
      const newProposal: Proposal = {
        id: `prop_req_${residentId}_${Date.now()}`,
        residentId,
        type: choice.requestType === 'pills_not_now' ? 'retry' : 'request',
        taskType:
          choice.requestType.startsWith('shower')
            ? 'shower'
            : choice.requestType.startsWith('pills')
            ? 'medication'
            : 'activity',
        title,
        reason,
        proposedTime,
        proposedStaff,
        outcome,
        status: 'pending',
        createdAtTime: simulatedTime,
      };

      setProposals((prev) => [newProposal, ...prev]);

      logEvent(
        `Resident ${resident.firstName}`,
        'Bedside Choice Submitted',
        `Selected "${choice.label}". Rules Engine evaluated outcome: ${outcome.verdict}.`,
        'info'
      );
    },
    [residents, simulatedTime, tasks, logEvent]
  );

  // Resident presses Help button
  const triggerHelp = useCallback(
    (residentId: string) => {
      // Rapid-click guard
      const lockKey = `help_${residentId}`;
      if (actionLockRef.current.has(lockKey)) return;
      actionLockRef.current.add(lockKey);
      setTimeout(() => actionLockRef.current.delete(lockKey), 1000);

      const resident = residents.find((r) => r.id === residentId);
      const resName = resident ? resident.firstName : 'Resident';
      const room = resident ? resident.room : 'Unit Bed';

      // 1. Immediately reassure resident on tablet
      setResidents((prev) =>
        prev.map((r) =>
          r.id === residentId
            ? {
                ...r,
                currentResponseStatus: {
                  message: 'Someone is coming to help you.',
                  type: 'pending',
                  timestamp: simulatedTime,
                },
              }
            : r
        )
      );

      // 2. Add Urgent Alert to nurse's view (bypasses approvals)
      const newAlert: UrgentAlert = {
        id: `alert_${residentId}_${Date.now()}`,
        residentId,
        residentName: resident ? resident.name : resName,
        room,
        time: simulatedTime,
        acknowledged: false,
        resolved: false,
      };

      setUrgentAlerts((prev) => [newAlert, ...prev]);

      logEvent(
        `Resident ${resName}`,
        'URGENT HELP CALLED',
        `${resName} in ${room} pressed the bedside Help button at ${simulatedTime}. Bypassed approvals.`,
        'alert'
      );
    },
    [residents, simulatedTime, logEvent]
  );

  // Nurse acknowledges alert
  const acknowledgeAlert = useCallback(
    (alertId: string) => {
      setUrgentAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
      );
      logEvent('Nurse Sam', 'Help Alert Acknowledged', 'Nurse Sam on the way to resident room.', 'info');
    },
    [logEvent]
  );

  // Nurse marks alert resolved
  const resolveAlert = useCallback(
    (alertId: string) => {
      const alert = urgentAlerts.find((a) => a.id === alertId);
      setUrgentAlerts((prev) => prev.filter((a) => a.id !== alertId));
      if (alert) {
        logEvent('Nurse Sam', 'Help Call Cleared', `Resolved help call for ${alert.residentName} (${alert.room}).`, 'success');
      }
    },
    [urgentAlerts, logEvent]
  );

  // Calculate flagged patterns dynamically
  const flaggedPatterns = detectRefusalPatterns(residents, tasks);

  return (
    <CareShiftContext.Provider
      value={{
        simulatedTime,
        residents,
        activeResidentId,
        tasks,
        proposals,
        auditEvents,
        urgentAlerts,
        flaggedPatterns,
        confirmedProgressNotes,
        saveConfirmedProgressNote,
        advanceClock,
        resetSimulation,
        setActiveResidentId,
        markTaskStatus,
        approveProposal,
        declineProposal,
        offerAlternativeProposal,
        submitResidentRequest,
        triggerHelp,
        acknowledgeAlert,
        resolveAlert,
      }}
    >
      {children}
    </CareShiftContext.Provider>
  );
};

export function useCareShift() {
  const context = useContext(CareShiftContext);
  if (!context) {
    throw new Error('useCareShift must be used within a CareShiftProvider');
  }
  return context;
}
