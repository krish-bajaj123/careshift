import { describe, expect, it } from 'vitest';
import raw from '../src/v01/demoData.json';
import { createVault, restore, scrub, scrubDeep } from '../src/agent/pseudonym';
import { refusalPrompt } from '../src/agent/agent';
import { createTools, type ToolContext } from '../src/agent/tools';
import { evaluate } from '../src/agent/medRules';
import { state } from './helpers';

const NAMES = [...raw.residents.map((r) => r.name), ...raw.staff.map((s) => s.name.replace(/\.$/, ''))];
const FIRST = NAMES.map((n) => n.split(' ')[0]).filter((n) => n.length > 2);

function leaks(text: string) {
  return [...NAMES, ...FIRST].filter((n) => new RegExp(`\\b${n}\\b`).test(text));
}

describe('pseudonymous IDs for the LLM', () => {
  it('gives every resident and staff member a random R-/S- id', () => {
    const v = createVault();
    for (const r of raw.residents) expect(v.residentKeyToId.get(r.id)).toMatch(/^R-[0-9a-f]{4}$/);
    for (const s of raw.staff) expect(v.staffKeyToId.get(s.id)).toMatch(/^S-[0-9a-f]{4}$/);
    expect(new Set(v.toName.keys()).size).toBe(raw.residents.length + raw.staff.length);
  });

  it('scrubs full and first names, and blanks names after a relation word', () => {
    const v = createVault();
    const out = scrub('Emeka Okafor refused; Emeka said his daughter Chioma visits. Ask Maria.', v);
    expect(leaks(out)).toEqual([]);
    expect(out).toContain('daughter [name]');
    expect(out).not.toContain('Chioma');
  });

  it('catches speech-to-text misspellings of roster names', () => {
    const v = createVault();
    const out = scrub('Emika refused, Mr Okafur said Danial can help. Then she slept.', v);
    expect(out).not.toMatch(/Emika|Okafur|Danial/);
    expect(restore(out, v)).toBe('Emeka Okafor refused, Mr Emeka Okafor said Daniel Osei can help. Then she slept.');
    expect(scrub('Then he sat by the Water garden.', v)).toBe('Then he sat by the Water garden.');
  });

  it('restores ids back to real names', () => {
    const v = createVault();
    const text = 'Kamala Rao prefers Tom Becker for baths.';
    expect(restore(scrub(text, v), v)).toBe(text);
  });

  it('the refusal prompt and every tool output contain no real names', async () => {
    const s = state({ t5: { attempts: 1 } });
    const event = { taskId: 't5', reasonChip: 'Said they were cold', note: 'Emeka was cold, told Priya to come back later', attempts: 2 };
    const ctx: ToolContext = { event, state: s, rules: evaluate(event, s), trace: [], options: new Map(), solverCalls: 0, vault: createVault() };
    expect(leaks(refusalPrompt(ctx))).toEqual([]);
    const tools = createTools(ctx) as unknown as { name: string; invoke: (x: unknown) => Promise<unknown> }[];
    const outputs = await Promise.all(tools.map((t) => t.invoke(t.name === 'run_solver' ? { extraConstraints: [] } : {})));
    for (const o of outputs) expect(leaks(String(o))).toEqual([]);
    expect(JSON.stringify(scrubDeep({ staff: 's1' }, ctx.vault!))).toMatch(/S-[0-9a-f]{4}/);
  });
});
