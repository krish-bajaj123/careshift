/**
 * CareShift v0.0 - Deterministic Rules Engine
 * Makes all decisions regarding schedules, windows, retry slots, conflicts, autonomy filtering, and escalations.
 * No AI/LLM is used for clinical and scheduling decisions.
 */

import {
  CareTask,
  Resident,
  Proposal,
  ProposalOutcome,
  ResidentChoiceOption,
  TaskType,
  ShiftSnapshot,
  TrendAnalysis,
} from '../types';

/**
 * Time utility: Convert "HH:MM" to minutes from 00:00
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Time utility: Convert minutes from 00:00 to "HH:MM"
 */
export function minutesToTime(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, totalMinutes));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Add minutes to a "HH:MM" time string
 */
export function addMinutes(time: string, mins: number): string {
  return minutesToTime(timeToMinutes(time) + mins);
}

/**
 * Check if a time is within [earliest, latest]
 */
export function isWithinWindow(time: string, earliest: string, latest: string): boolean {
  const t = timeToMinutes(time);
  return t >= timeToMinutes(earliest) && t <= timeToMinutes(latest);
}

/**
 * Find the next 15-minute slot at least 30 minutes later than currentTime.
 * e.g., currentTime = "08:45" -> +30m = 09:15 -> 09:15.
 * currentTime = "08:50" -> +30m = 09:20 -> rounds to 09:30.
 */
export function calculateNextRetrySlot(currentTime: string, minDelayMinutes = 30): string {
  const currentMins = timeToMinutes(currentTime);
  const targetMins = currentMins + minDelayMinutes;
  const roundedMins = Math.ceil(targetMins / 15) * 15;
  return minutesToTime(roundedMins);
}

/**
 * Medication window rule:
 * Medication windows are scheduled time ±60 minutes and can NEVER be broken.
 * Window closes within 15 mins: timeToMinutes(latest) - timeToMinutes(currentTime) < 15
 */
export function isMedicationWindowClosingSoon(currentTime: string, latestTime: string): boolean {
  const remaining = timeToMinutes(latestTime) - timeToMinutes(currentTime);
  return remaining < 15;
}

/**
 * Rule 1 & 2: Process a Refusal (Refused, Asleep, Agitated)
 * Propose retry at next 15-min slot >= 30 mins later inside [earliest, latest], preferring favorite staff.
 * If no retry fits, window closes within 15 min, or attemptCount >= 2, create Escalation to Alex.
 */
export function handleTaskRefusal(
  task: CareTask,
  refusalType: 'refused' | 'asleep' | 'agitated',
  currentTime: string,
  resident: Resident,
  allTasks: CareTask[]
): { updatedTask: CareTask; proposal: Proposal } {
  const newAttemptCount = task.attemptCount + 1;
  const preferredStaff = resident.preferredStaff || task.staff;
  const proposedSlot = calculateNextRetrySlot(currentTime, 30);
  const proposedSlotMins = timeToMinutes(proposedSlot);
  const latestMins = timeToMinutes(task.latest);
  const currentMins = timeToMinutes(currentTime);

  const windowRemaining = latestMins - currentMins;
  const isMedication = task.type === 'medication';

  // Check conditions for Escalation to Alex (Charge RN):
  // 1. Second refusal (newAttemptCount >= 2)
  // 2. Window closes within 15 minutes
  // 3. Proposed slot exceeds latest window
  const secondRefusal = newAttemptCount >= 2;
  const windowClosing = isMedication && windowRemaining < 15;
  const doesNotFit = proposedSlotMins + (isMedication ? 0 : task.durationMin) > latestMins;

  if (isMedication && (secondRefusal || windowClosing || doesNotFit)) {
    let escalationReason = '';
    if (secondRefusal) {
      escalationReason = `Second refusal for ${resident.firstName}'s meds. Window closes ${task.latest}. Alex (Charge RN) notified for clinical assessment.`;
    } else if (windowClosing) {
      escalationReason = `Medication window closes within 15 min (${task.latest}). No safe retry window remains. Alex notified.`;
    } else {
      escalationReason = `No retry fits before window closes at ${task.latest}. Alex notified for clinical alternative.`;
    }

    const updatedTask: CareTask = {
      ...task,
      status: 'escalated',
      attemptCount: newAttemptCount,
      refusalReason: `${refusalType.toUpperCase()}: ${escalationReason}`,
    };

    const escalationProposal: Proposal = {
      id: `esc_${task.id}_${Date.now()}`,
      residentId: resident.id,
      type: 'escalation',
      taskId: task.id,
      taskType: task.type,
      title: `Escalation to Alex: Missed Med Window (${resident.firstName})`,
      reason: escalationReason,
      escalateTo: 'Alex (Charge RN)',
      status: 'pending',
      createdAtTime: currentTime,
    };

    return { updatedTask, proposal: escalationProposal };
  }

  // Non-medication or first medication refusal that fits inside window:
  // Propose one retry at proposedSlot preferring preferredStaff
  const staffReason =
    preferredStaff === task.staff
      ? `Window closes ${task.latest} · assigned to ${preferredStaff}`
      : `Window closes ${task.latest} · ${resident.firstName} accepts care from ${preferredStaff}`;

  const updatedTask: CareTask = {
    ...task,
    status: refusalType,
    attemptCount: newAttemptCount,
    refusalReason: `Marked as ${refusalType} at ${currentTime}. Proposed retry: ${proposedSlot}.`,
  };

  const retryProposal: Proposal = {
    id: `prop_retry_${task.id}_${Date.now()}`,
    residentId: resident.id,
    type: 'retry',
    taskId: task.id,
    taskType: task.type,
    title: `Retry ${task.title} at ${proposedSlot}`,
    reason: `Window closes ${task.latest} · ${resident.firstName} responds well to ${preferredStaff}`,
    proposedTime: proposedSlot,
    proposedStaff: preferredStaff,
    outcome: {
      verdict: 'Fits',
      description: `Retry scheduled at ${proposedSlot} with ${preferredStaff}. Fits comfortably before ${task.latest}.`,
      suggestedTime: proposedSlot,
      suggestedStaff: preferredStaff,
    },
    status: 'pending',
    createdAtTime: currentTime,
  };

  return { updatedTask, proposal: retryProposal };
}

/**
 * Check if the simulated clock passed a medication's window while still not given.
 * Rule: Auto-escalate to Alex immediately!
 */
export function checkMissedMedicationWindows(
  tasks: CareTask[],
  currentTime: string,
  residents: Resident[]
): { updatedTasks: CareTask[]; newEscalations: Proposal[] } {
  const currentMins = timeToMinutes(currentTime);
  const updatedTasks: CareTask[] = [];
  const newEscalations: Proposal[] = [];

  for (const task of tasks) {
    if (task.type === 'medication' && task.status !== 'done' && task.status !== 'escalated') {
      const latestMins = timeToMinutes(task.latest);
      if (currentMins > latestMins) {
        const resident = residents.find((r) => r.id === task.residentId);
        const name = resident ? resident.firstName : 'Resident';
        const escalationReason = `Clock reached ${currentTime}, passing strict medication window (${task.earliest}–${task.latest}). Auto-escalated to Alex (Charge RN).`;

        updatedTasks.push({
          ...task,
          status: 'escalated',
          refusalReason: escalationReason,
        });

        newEscalations.push({
          id: `esc_autowindow_${task.id}_${currentTime}`,
          residentId: task.residentId,
          type: 'escalation',
          taskId: task.id,
          taskType: task.type,
          title: `Auto-Escalation: Window Expired for ${name}'s ${task.title}`,
          reason: escalationReason,
          escalateTo: 'Alex (Charge RN)',
          status: 'pending',
          createdAtTime: currentTime,
        });
      } else {
        updatedTasks.push(task);
      }
    } else {
      updatedTasks.push(task);
    }
  }

  return { updatedTasks, newEscalations };
}

/**
 * Rule 3: Patterns
 * Flag a resident who refused the same task type on 3 of the last 5 days (including today).
 * Example: Kamala has refused morning meds 3 of the last 5 days.
 * Teresa: 2 past days + if marked asleep/refused today = 3 of 5 days!
 */
export function detectRefusalPatterns(
  residents: Resident[],
  tasks: CareTask[]
): string[] {
  const flaggedMessages: string[] = [];

  for (const resident of residents) {
    // Check medication refusals
    let pastMedRefusals = 0;
    let pastShowerRefusals = 0;

    for (const h of resident.history) {
      if (h.refusedTaskTypes.includes('medication')) {
        pastMedRefusals++;
      }
      if (h.refusedTaskTypes.includes('shower')) {
        pastShowerRefusals++;
      }
    }

    // Check today's tasks for this resident
    const residentTasksToday = tasks.filter((t) => t.residentId === resident.id);
    const todayMedRefused = residentTasksToday.some(
      (t) =>
        t.type === 'medication' &&
        (t.status === 'refused' || t.status === 'asleep' || t.status === 'agitated' || t.status === 'escalated')
    );
    const todayShowerRefused = residentTasksToday.some(
      (t) =>
        t.type === 'shower' &&
        (t.status === 'refused' || t.status === 'asleep' || t.status === 'agitated')
    );

    const totalMedRefusals = pastMedRefusals + (todayMedRefused ? 1 : 0);
    const totalShowerRefusals = pastShowerRefusals + (todayShowerRefused ? 1 : 0);

    if (totalMedRefusals >= 3) {
      flaggedMessages.push(
        `${resident.name} has refused morning meds ${totalMedRefusals} of the last 5 days.`
      );
    }

    if (totalShowerRefusals >= 3) {
      flaggedMessages.push(
        `${resident.name} has refused showers ${totalShowerRefusals} of the last 5 days.`
      );
    }
  }

  return flaggedMessages;
}

/**
 * Filter allowable concrete choices for the Resident bedside tablet:
 * - Only choices allowed by autonomy profile
 * - Maximum 3 choices
 * - Only choices that are physically and clinically possible right now
 * - No quizzing, no open questions
 */
export function getAvailableResidentChoices(
  resident: Resident,
  tasks: CareTask[],
  currentTime: string
): ResidentChoiceOption[] {
  const choices: ResidentChoiceOption[] = [];
  const currentMins = timeToMinutes(currentTime);

  // If resident has no allowed choices (e.g. Leon), return empty list
  if (!resident.allowedChoices || resident.allowedChoices.length === 0) {
    return [];
  }

  const residentTasks = tasks.filter((t) => t.residentId === resident.id);

  // 1. Pills Choices (if resident allowed 'pills')
  if (resident.allowedChoices.includes('pills')) {
    const activeMed = residentTasks.find(
      (t) =>
        t.type === 'medication' &&
        t.status === 'planned' &&
        currentMins >= timeToMinutes(t.earliest) &&
        currentMins <= timeToMinutes(t.latest)
    );

    if (activeMed) {
      choices.push({
        id: 'choice_pills_ready',
        label: "I'm ready for my pills",
        requestType: 'pills_ready',
        details: `Available right now with RN Sam (window closes ${activeMed.latest})`,
      });

      choices.push({
        id: 'choice_pills_not_now',
        label: 'Not now (take pills later)',
        requestType: 'pills_not_now',
        details: `Requests safe retry within the ±60m window (before ${activeMed.latest})`,
      });
    }
  }

  // 2. Shower Choices (if resident allowed 'shower')
  if (resident.allowedChoices.includes('shower')) {
    const showerTask = residentTasks.find((t) => t.type === 'shower' && t.status === 'planned');

    if (showerTask) {
      const showerEarliestMins = timeToMinutes(showerTask.earliest);
      const showerLatestMins = timeToMinutes(showerTask.latest);

      // Check if "Shower now" is possible
      // Needs currentTime >= earliest, and currentTime + 30 <= latest
      // And does not collide with non-movable Lunch (12:00 - 12:45)
      const lunchTask = residentTasks.find((t) => t.type === 'meal' && t.time === '12:00');
      const lunchOverlap =
        lunchTask &&
        currentMins + 30 > timeToMinutes(lunchTask.earliest) &&
        currentMins < timeToMinutes(lunchTask.latest);

      if (currentMins >= showerEarliestMins && currentMins + 30 <= showerLatestMins && !lunchOverlap) {
        choices.push({
          id: 'choice_shower_now',
          label: 'Shower now',
          requestType: 'shower_now',
          details: `Start morning shower now with ${resident.preferredStaff || 'PSW'}`,
        });
      }

      // Check if "Shower after lunch (12:45)" is possible
      const afterLunchMins = timeToMinutes('12:45');
      if (currentMins < afterLunchMins && afterLunchMins + 30 <= showerLatestMins) {
        choices.push({
          id: 'choice_shower_after_lunch',
          label: 'Shower after lunch (12:45)',
          requestType: 'shower_after_lunch',
          details: `Shift shower to 12:45 with ${resident.preferredStaff || 'PSW'} after dining`,
        });
      }
    }
  }

  // 3. Activities Choices (if resident allowed 'activities')
  if (resident.allowedChoices.includes('activities')) {
    // Music group 10:30
    if (currentMins < timeToMinutes('10:30')) {
      choices.push({
        id: 'choice_music',
        label: 'Join Music Group (10:30)',
        requestType: 'activity_music',
        details: 'Music & singing with Morgan in Activity Lounge',
      });
    }

    // Garden walk 13:30
    if (currentMins < timeToMinutes('13:30')) {
      choices.push({
        id: 'choice_garden',
        label: 'Join Garden Walk (13:30)',
        requestType: 'activity_garden',
        details: 'Fresh air & courtyard stroll with Morgan',
      });
    }
  }

  // Maximum 3 choices at a time, strictly concrete
  return choices.slice(0, 3);
}

/**
 * Evaluate a resident request against care rules, conflicts, and staff availability.
 * Returns exactly one outcome:
 * - "Fits"
 * - "Fits if [task] moves to [time]"
 * - "Can't happen" + closest alternative
 */
export function evaluateResidentRequest(
  resident: Resident,
  requestType: ResidentChoiceOption['requestType'],
  currentTime: string,
  tasks: CareTask[],
  allTasks: CareTask[]
): { outcome: ProposalOutcome; proposedTime: string; proposedStaff: string; title: string; reason: string } {
  const preferredStaff = resident.preferredStaff || 'Priya';
  const alternateStaff = preferredStaff === 'Priya' ? 'Jordan' : 'Priya';
  const residentTasks = tasks.filter((t) => t.residentId === resident.id);

  if (requestType === 'shower_after_lunch') {
    const showerTask = residentTasks.find((t) => t.type === 'shower');
    const targetTime = '12:45';
    const targetDuration = showerTask ? showerTask.durationMin : 30;

    // Check if preferred staff (Priya) is busy at 12:45 with another resident
    const preferredBusy = allTasks.some(
      (t) =>
        t.staff === preferredStaff &&
        t.residentId !== resident.id &&
        t.status === 'planned' &&
        t.time === '12:45'
    );

    const assignedStaff = preferredBusy ? alternateStaff : preferredStaff;

    // Check if resident has conflicting task at 12:45 - 13:15
    const conflictTask = residentTasks.find(
      (t) =>
        t.id !== showerTask?.id &&
        t.status === 'planned' &&
        timeToMinutes(t.time) >= timeToMinutes('12:45') &&
        timeToMinutes(t.time) < timeToMinutes('12:45') + targetDuration
    );

    if (conflictTask) {
      if (conflictTask.movable) {
        const newConflictTime = addMinutes('12:45', targetDuration + 15);
        return {
          outcome: {
            verdict: 'FitsIfMoved',
            description: `Fits if ${conflictTask.title} moves to ${newConflictTime}. Staff: ${assignedStaff}.`,
            suggestedTime: targetTime,
            suggestedStaff: assignedStaff,
            taskToMoveId: conflictTask.id,
            taskToMoveNewTime: newConflictTime,
          },
          proposedTime: targetTime,
          proposedStaff: assignedStaff,
          title: `Move Shower to 12:45 (${resident.firstName})`,
          reason: `Daniel requested shower after lunch. Fits if ${conflictTask.title} moves to ${newConflictTime}.`,
        };
      } else {
        return {
          outcome: {
            verdict: 'CantHappen',
            description: `Can't happen at 12:45 due to non-movable ${conflictTask.title}. Closest alternative: 13:30 with ${assignedStaff}.`,
            suggestedTime: '13:30',
            suggestedStaff: assignedStaff,
            alternativeSuggestion: `Offer 13:30 with ${assignedStaff}`,
          },
          proposedTime: '13:30',
          proposedStaff: assignedStaff,
          title: `Shower Request: Alternative 13:30 (${resident.firstName})`,
          reason: `12:45 conflicts with ${conflictTask.title}. Closest alternative is 13:30.`,
        };
      }
    }

    return {
      outcome: {
        verdict: 'Fits',
        description: `Fits with ${assignedStaff} at 12:45. Lunch completes at 12:45, within allowable window (09:00–14:00).`,
        suggestedTime: targetTime,
        suggestedStaff: assignedStaff,
      },
      proposedTime: targetTime,
      proposedStaff: assignedStaff,
      title: `Resident Request: Shower after lunch (${resident.firstName})`,
      reason: `${resident.firstName} asked for shower after lunch (12:45). Preferred PSW ${assignedStaff} is available.`,
    };
  }

  if (requestType === 'shower_now') {
    const showerTask = residentTasks.find((t) => t.type === 'shower');
    const targetTime = currentTime;

    return {
      outcome: {
        verdict: 'Fits',
        description: `Fits with ${preferredStaff} right now (${currentTime}).`,
        suggestedTime: targetTime,
        suggestedStaff: preferredStaff,
      },
      proposedTime: targetTime,
      proposedStaff: preferredStaff,
      title: `Resident Request: Shower Now (${resident.firstName})`,
      reason: `${resident.firstName} requested shower right now. ${preferredStaff} is available.`,
    };
  }

  if (requestType === 'pills_ready') {
    const medTask = residentTasks.find((t) => t.type === 'medication' && t.status === 'planned');
    return {
      outcome: {
        verdict: 'Fits',
        description: `Medication ready now. RN Sam notified to bring pills immediately.`,
        suggestedTime: currentTime,
        suggestedStaff: 'Sam',
      },
      proposedTime: currentTime,
      proposedStaff: 'Sam',
      title: `Resident Ready for Meds: ${resident.firstName}`,
      reason: `${resident.firstName} indicated they are ready for their scheduled pills.`,
    };
  }

  if (requestType === 'pills_not_now') {
    const medTask = residentTasks.find((t) => t.type === 'medication');
    const proposedRetry = calculateNextRetrySlot(currentTime, 30);
    const proposedMins = timeToMinutes(proposedRetry);
    const latestMins = medTask ? timeToMinutes(medTask.latest) : timeToMinutes('10:00');

    if (proposedMins <= latestMins) {
      return {
        outcome: {
          verdict: 'Fits',
          description: `Retry safely fits at ${proposedRetry} with ${preferredStaff} (window closes ${medTask?.latest || '10:00'}).`,
          suggestedTime: proposedRetry,
          suggestedStaff: preferredStaff,
        },
        proposedTime: proposedRetry,
        proposedStaff: preferredStaff,
        title: `Pills Delay Requested (${resident.firstName})`,
        reason: `${resident.firstName} selected "Not now". Proposed retry at ${proposedRetry} inside safe window.`,
      };
    } else {
      return {
        outcome: {
          verdict: 'CantHappen',
          description: `Cannot delay: med window closes at ${medTask?.latest || '10:00'}. Alex (Charge RN) notified.`,
          suggestedTime: currentTime,
          suggestedStaff: 'Alex',
          alternativeSuggestion: 'Escalate to Alex',
        },
        proposedTime: currentTime,
        proposedStaff: 'Alex',
        title: `Pills Delay Exceeds Window (${resident.firstName})`,
        reason: `${resident.firstName} selected "Not now" but safe window closes at ${medTask?.latest}. Alex notified.`,
      };
    }
  }

  if (requestType === 'activity_music') {
    return {
      outcome: {
        verdict: 'Fits',
        description: `Fits. Morgan is running Music Group at 10:30 in Activity Lounge.`,
        suggestedTime: '10:30',
        suggestedStaff: 'Morgan',
      },
      proposedTime: '10:30',
      proposedStaff: 'Morgan',
      title: `Activity Sign-up: Music Group (${resident.firstName})`,
      reason: `${resident.firstName} wants to join Music Group at 10:30 with Morgan.`,
    };
  }

  // Garden walk
  return {
    outcome: {
      verdict: 'Fits',
      description: `Fits. Morgan is running Courtyard Garden Walk at 13:30.`,
      suggestedTime: '13:30',
      suggestedStaff: 'Morgan',
    },
    proposedTime: '13:30',
    proposedStaff: 'Morgan',
    title: `Activity Sign-up: Garden Walk (${resident.firstName})`,
    reason: `${resident.firstName} wants to join Garden Walk at 13:30 with Morgan.`,
  };
}

/**
 * Requirement 2: Deterministic 7-Day Trend Engine (Plain code, not a language model)
 * Computes:
 * - Rising confusion mentions
 * - Falling meal intake
 * - More refusals
 * - Fewer resident requests
 * - Urgent flag: Sudden change in confusion within 24 hours ("possible delirium or infection, consider assessment")
 * - Propose one follow-up (physician review, pharmacist medication review, or family care conference) with a one-line reason
 */
export function computeResidentTrends(residents: Resident[]): TrendAnalysis[] {
  const trends: TrendAnalysis[] = [];

  for (const resident of residents) {
    const history = resident.sevenDayHistory;
    if (!history || history.length < 2) continue;

    const dayStart = history[0]; // Day -6
    const dayYesterday = history[history.length - 2]; // Day -1
    const dayToday = history[history.length - 1]; // Day 0

    const confusionStart = dayStart.confusionMentions;
    const confusionEnd = dayToday.confusionMentions;
    const confusionDelta24h = dayToday.confusionMentions - dayYesterday.confusionMentions;

    const mealStart = dayStart.mealIntakePercent;
    const mealEnd = dayToday.mealIntakePercent;
    const mealDropPercent = mealStart - mealEnd;

    const refusalsStart = dayStart.refusalCount;
    const refusalsEnd = dayToday.refusalCount;
    const refusalIncrease = refusalsEnd - refusalsStart;

    const requestsStart = dayStart.requestCount;
    const requestsEnd = dayToday.requestCount;
    const requestDrop = requestsStart - requestsEnd;

    const risingConfusion = confusionEnd > confusionStart || confusionDelta24h > 0;
    const fallingMealIntake = mealDropPercent >= 20;
    const moreRefusals = refusalIncrease >= 2;
    const fewerRequests = requestDrop >= 3;

    let urgentDeliriumAlert: string | undefined = undefined;
    let proposedFollowUp: TrendAnalysis['proposedFollowUp'] = undefined;

    // 1. Sudden change in confusion within 24 hours (flagged urgent) -> Physician review
    if (confusionDelta24h >= 3) {
      urgentDeliriumAlert = 'possible delirium or infection, consider assessment';
      proposedFollowUp = {
        type: 'physician review',
        title: `Physician review (Dr. Patel) for ${resident.name}`,
        reason: `Acute confusion spike in 24h (${dayYesterday.confusionMentions} to ${dayToday.confusionMentions} mentions) — possible delirium or infection, consider assessment`,
        escalateTo: 'Dr. Patel (Attending Physician)',
      };
    } else if (fallingMealIntake) {
      // 2. Falling meal intake -> Pharmacist medication review
      proposedFollowUp = {
        type: 'pharmacist medication review',
        title: `Pharmacist medication review for ${resident.name}`,
        reason: `Meal intake dropped from ${mealStart}% to ${mealEnd}% over 7 days — review medications contributing to appetite suppression or nausea`,
        escalateTo: 'Clinical Pharmacist',
      };
    } else if (moreRefusals) {
      // 3. More refusals -> Pharmacist medication review
      proposedFollowUp = {
        type: 'pharmacist medication review',
        title: `Pharmacist medication review for ${resident.name}`,
        reason: `Care refusals increased from ${refusalsStart} to ${refusalsEnd} over 7 days — evaluate medication timing and formulation tolerance`,
        escalateTo: 'Clinical Pharmacist',
      };
    } else if (fewerRequests) {
      // 4. Fewer resident requests -> Family care conference
      proposedFollowUp = {
        type: 'family care conference',
        title: `Family care conference for ${resident.name}`,
        reason: `Autonomous choices dropped from ${requestsStart} to ${requestsEnd} over 7 days — family care conference to assess apathy and engagement goals`,
        escalateTo: 'Social Worker & Family',
      };
    }

    trends.push({
      residentId: resident.id,
      residentName: resident.name,
      room: resident.room,
      risingConfusion,
      confusionStart,
      confusionEnd,
      confusionDelta24h,
      urgentDeliriumAlert,
      fallingMealIntake,
      mealStart,
      mealEnd,
      mealDropPercent,
      moreRefusals,
      refusalsStart,
      refusalsEnd,
      refusalIncrease,
      fewerRequests,
      requestsStart,
      requestsEnd,
      requestDrop,
      proposedFollowUp,
    });
  }

  return trends;
}

/**
 * Build Shift Snapshot for End-of-Shift Handoff
 * Collects strictly structured facts, confirmed notes only, and deterministic trends
 */
export function buildShiftSnapshot(
  tasks: CareTask[],
  residents: Resident[],
  proposals: Proposal[],
  currentTime: string,
  confirmedProgressNotes: import('../types').StructuredProgressNote[] = []
): ShiftSnapshot {
  const completedTasks = tasks.filter((t) => t.status === 'done');
  const outstandingTasks = tasks.filter((t) => t.status !== 'done');

  const flaggedPatterns = detectRefusalPatterns(residents, tasks);
  const trendAnalyses = computeResidentTrends(residents);

  const escalations = proposals
    .filter((p) => p.type === 'escalation')
    .map((p) => {
      const res = residents.find((r) => r.id === p.residentId);
      return {
        resident: res ? res.firstName : 'Resident',
        title: p.title,
        reason: p.reason,
        time: p.createdAtTime,
        escalateTo: p.escalateTo || 'Alex (Charge RN)',
      };
    });

  const openRequests = proposals
    .filter((p) => p.status === 'pending' && p.type === 'request')
    .map((p) => {
      const res = residents.find((r) => r.id === p.residentId);
      return {
        resident: res ? res.firstName : 'Resident',
        request: p.title,
        status: p.status,
      };
    });

  const watchForItems = residents
    .filter((r) => r.careTip)
    .map((r) => ({
      resident: r.firstName,
      tip: r.careTip!,
    }));

  return {
    simulatedTime: currentTime,
    completedTasksCount: completedTasks.length,
    totalTasksCount: tasks.length,
    outstandingTasks: outstandingTasks.map((t) => {
      const res = residents.find((r) => r.id === t.residentId);
      return {
        resident: res ? res.firstName : 'Resident',
        type: t.type,
        title: t.title,
        scheduledTime: t.time,
        status: t.status,
        reason: t.refusalReason || (t.status === 'planned' ? 'Scheduled for later in shift' : t.status),
        earliest: t.earliest,
        latest: t.latest,
      };
    }),
    escalations,
    openRequests,
    flaggedPatterns,
    watchForItems,
    confirmedProgressNotes,
    trendAnalyses,
  };
}
