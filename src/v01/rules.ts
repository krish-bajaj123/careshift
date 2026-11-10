/**
 * CareShift v0.1 refusal rules (deterministic, no AI).
 *
 * From D4 co-creation feedback: essential tasks (meds, repositioning, transfers,
 * continence care, meals/fluids) can't be pushed to the next shift. Flexible
 * tasks (baths, recreation) can, so the next shift isn't overloaded with
 * essentials. Ontario O. Reg. 246/22 s. 37: residents are bathed at least
 * twice a week, so a refused bath is re-planned, never dropped.
 */

export type Priority = 'essential' | 'flexible';
export type Suggestion = 'retry_this_shift' | 'hand_off' | 'flag_nurse';

export interface RefusalAdvice {
  suggestion: Suggestion;
  title: string;
  detail: string;
  /** Hand off is allowed but should show a warning */
  handOffWarning: boolean;
}

export function adviseOnRefusal(priority: Priority, attempts: number, residentName: string): RefusalAdvice {
  if (priority === 'essential') {
    return {
      suggestion: 'flag_nurse',
      title: 'Essential task.',
      detail: "This can't wait for the next shift. Try again within the safe window or flag the nurse.",
      handOffWarning: true,
    };
  }
  if (attempts >= 2) {
    return {
      suggestion: 'hand_off',
      title: `${ordinal(attempts)} refusal today.`,
      detail: `This task is flexible, so it can move to the evening shift. ${residentName} still needs 2 baths a week, so it stays on the plan.`,
      handOffWarning: false,
    };
  }
  return {
    suggestion: 'retry_this_shift',
    title: '1st refusal.',
    detail: 'Flexible task. Suggested: try again later this shift.',
    handOffWarning: false,
  };
}

/** Hard rule: a 2-person lift can't be marked done without a second staff member. */
export function needsSecondStaff(task: { needsSecondStaff?: boolean }): boolean {
  return !!task.needsSecondStaff;
}

function ordinal(n: number) {
  return n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}
