/**
 * 16 made-up refusal scenarios for comparing the agent with the rules-only plan (TC2).
 * Half of them have a free-text note that says more than the reason chip, since
 * reading the note is the one thing the agent can do that the rules can't.
 */
import { toMin } from '../src/agent/state';
import type { ClientTask, RefusalEvent, StaffBlock } from '../src/agent/types';

export interface Scenario {
  id: string;
  about: string;
  event: RefusalEvent;
  patch?: Record<string, Partial<ClientTask>>;
  blocks?: StaffBlock[];
  /** true when the note carries information the reason chip doesn't */
  noteMatters: boolean;
}

const busy = (staffId: string, from: string, to: string, reason: string): StaffBlock => ({ staffId, from: toMin(from), to: toMin(to), reason });
const ev = (taskId: string, reasonChip: string, note: string, attempts = 1): RefusalEvent => ({ taskId, reasonChip, note, attempts, at: '10:05' });

export const SCENARIOS: Scenario[] = [
  { id: 'S01', about: 'bath, cold', event: ev('t5', 'Said they were cold', 'cold'), noteMatters: false },
  { id: 'S02', about: 'bath, 2nd refusal', event: ev('t5', 'Not now / later', 'not now', 2), patch: { t5: { attempts: 1 } }, noteMatters: false },
  { id: 'S03', about: 'bath, wants a woman', event: ev('t5', 'Other', 'she would rather have Maria do it'), noteMatters: true },
  { id: 'S04', about: 'bath, after music', event: ev('t5', 'Other', 'wants to go to music hour first, bath after lunch'), noteMatters: true },
  { id: 'S05', about: 'meds, cold', event: ev('t8', 'Said they were cold', 'cold, wants room warmer'), noteMatters: false },
  { id: 'S06', about: 'meds, 2nd refusal', event: ev('t8', 'Upset or agitated', 'pushed cup away', 2), patch: { t8: { attempts: 1 } }, noteMatters: false },
  { id: 'S07', about: 'meds, nurses busy', event: ev('t8', 'Not now / later', 'later'), blocks: [busy('s3', '10:05', '11:05', 'code on another floor'), busy('s4', '10:05', '11:05', 'family meeting')], noteMatters: false },
  { id: 'S08', about: 'meds, takes them from Grace', event: ev('t8', 'Other', 'he usually takes them from Grace, not me'), noteMatters: true },
  { id: 'S09', about: 'meds, asleep', event: ev('t9', 'Asleep', 'asleep'), noteMatters: false },
  { id: 'S10', about: 'meds, wants breakfast first', event: ev('t9', 'Other', 'wants to finish breakfast, ask again in 30 min'), noteMatters: true },
  { id: 'S11', about: 'repositioning, tired', event: ev('t6', 'Too tired', 'tired'), noteMatters: false },
  { id: 'S12', about: 'repositioning, PSW busy', event: ev('t6', 'Not now / later', 'later'), blocks: [busy('s1', '10:55', '11:30', 'lift transfer ran long')], noteMatters: false },
  { id: 'S13', about: 'repositioning, prefers Daniel', event: ev('t6', 'Other', 'calmer with Daniel, can he do it'), noteMatters: true },
  { id: 'S14', about: 'music escort, upset', event: ev('t12', 'Upset or agitated', 'upset'), noteMatters: false },
  { id: 'S15', about: 'music escort, family visit', event: ev('t12', 'Other', 'daughter visiting at 11, skip music today'), noteMatters: true },
  { id: 'S16', about: 'lunch help, not hungry yet', event: ev('t7', 'Other', 'not hungry yet, try in 20 minutes'), noteMatters: true },
];
