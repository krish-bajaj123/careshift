/**
 * CareShift v0.1 AI adapter: PLACEHOLDERS ONLY.
 *
 * No AI runs in v0.1. These functions return fixed sample output so the
 * review screens can be tested in peer evaluation. Kirpa is replacing them
 * with real speech-to-text + LLM calls (server.ts already has Gemini
 * endpoints from v0.0 that can be reused).
 *
 * Contract the real version must keep (from TC1 feedback):
 *  - Fixed fields only. Anything the speaker didn't say is "unknown", never guessed.
 *  - Every field links back to the transcript text it came from.
 *  - The nurse reviews and edits before anything is saved.
 */

export interface StructuredNote {
  transcript: string;
  fields: { label: string; value: string | null }[]; // null = unknown (not said)
  editableText: string;
}

export async function transcribeAndStructureRefusal(taskTitle: string): Promise<StructuredNote> {
  // TODO(Kirpa): record audio -> speech-to-text -> LLM extraction into fixed fields.
  return {
    transcript: "He said no again, he's cold. Wants the room warmer first.",
    fields: [
      { label: 'Task', value: taskTitle.split(' —')[0] },
      { label: 'Time', value: '10:45 am' },
      { label: 'Status', value: 'Refused' },
      { label: 'Reason', value: 'Cold — wants room warmer' },
      { label: 'Mood', value: null },
    ],
    editableText: 'Cold, wants the room warmer first.',
  };
}

export async function transcribeAndStructureMemo(residentLabel: string): Promise<StructuredNote> {
  // TODO(Kirpa): same pipeline as above, for free-form memos.
  return {
    transcript: 'Drank a full cup of tea at ten, seemed more alert.',
    fields: [
      { label: 'Resident', value: residentLabel },
      { label: 'Fluids', value: '1 cup tea, 10 am' },
      { label: 'Mood', value: 'More alert' },
      { label: 'Meals', value: null },
    ],
    editableText: 'Drank a full cup of tea at 10 am, seemed more alert.',
  };
}
