/**
 * Pseudonymous IDs for everything sent to the LLM.
 *
 * Residents and staff get random IDs (R-7f3a, S-2c91), never room numbers or
 * sequential numbers. Before a Gemini call we swap known roster names for IDs
 * and blank out names a simple detection pass finds (e.g. "her daughter Anjali").
 * After the call we swap IDs back. The mapping (the "identity vault") lives
 * only on our server and never goes to the model.
 */
import raw from '../v01/demoData.json';

export interface Vault {
  toId: Map<string, string>;
  toName: Map<string, string>;
  staffKeyToId: Map<string, string>;
  idToStaffKey: Map<string, string>;
  residentKeyToId: Map<string, string>;
  idToResidentKey: Map<string, string>;
  names: { name: string; id: string }[];
}

const hex = () => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(2)), (b) => b.toString(16).padStart(2, '0')).join('');

function freshId(prefix: 'R' | 'S', used: Set<string>) {
  let id = `${prefix}-${hex()}`;
  while (used.has(id)) id = `${prefix}-${hex()}`;
  used.add(id);
  return id;
}

export function createVault(
  residents: { id: string; name: string }[] = raw.residents,
  staff: { id: string; name: string }[] = raw.staff,
): Vault {
  const used = new Set<string>();
  const v: Vault = {
    toId: new Map(), toName: new Map(),
    staffKeyToId: new Map(), idToStaffKey: new Map(),
    residentKeyToId: new Map(), idToResidentKey: new Map(),
    names: [],
  };
  const add = (key: string, name: string, prefix: 'R' | 'S') => {
    const id = freshId(prefix, used);
    v.toId.set(name, id);
    v.toName.set(id, name);
    if (prefix === 'S') { v.staffKeyToId.set(key, id); v.idToStaffKey.set(id, key); }
    else { v.residentKeyToId.set(key, id); v.idToResidentKey.set(id, key); }
    const clean = name.replace(/\.$/, '');
    const [first] = clean.split(' ');
    v.names.push({ name: clean, id });
    if (first.length > 2) v.names.push({ name: first, id });
  };
  residents.forEach((r) => add(r.id, r.name, 'R'));
  staff.forEach((s) => add(s.id, s.name, 'S'));
  // longest first so "Emeka Okafor" is replaced before "Emeka"
  v.names.sort((a, b) => b.name.length - a.name.length);
  return v;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RELATION = /\b(daughter|son|wife|husband|sister|brother|niece|nephew|friend|grandson|granddaughter|mother|father|mom|dad)\s+([A-Z][a-z]+)/g;

/** Edit distance, used to catch speech-to-text misspellings of roster names. */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/**
 * Fuzzy match (TC2): a capitalized word that is one letter off a roster name
 * (two letters for names of 7+ letters) and starts with the same letter is
 * treated as that name, e.g. "Emika" -> Emeka, "Okafur" -> Okafor. Words under
 * 5 letters are skipped so ordinary words like "Then" don't match "Chen".
 */
function fuzzyId(word: string, v: Vault): string | undefined {
  if (word.length < 5) return undefined;
  const w = word.toLowerCase();
  let best: { id: string; d: number } | undefined;
  for (const { name, id } of v.names) {
    for (const part of name.split(' ')) {
      const p = part.toLowerCase();
      if (p.length < 5 || p[0] !== w[0] || p === w) continue;
      const d = editDistance(w, p);
      if (d <= (p.length >= 7 ? 2 : 1) && (!best || d < best.d)) best = { id, d };
    }
  }
  return best?.id;
}

/** Replace roster names with IDs, catch close misspellings, and blank out other detected names. */
export function scrub(text: string, v: Vault): string {
  let out = text;
  for (const { name, id } of v.names) out = out.replace(new RegExp(`\\b${esc(name)}\\b`, 'g'), id);
  out = out.replace(/\b[A-Z][a-z]{4,}\b/g, (w) => fuzzyId(w, v) ?? w);
  out = out.replace(RELATION, (_m, rel) => `${rel} [name]`);
  return out;
}

/** Swap IDs (R-xxxx / S-xxxx) back to real names before anything reaches a screen. */
export function restore(text: string, v: Vault): string {
  return text.replace(/\b[RS]-[0-9a-f]{4}\b/g, (id) => v.toName.get(id) ?? id);
}

export const pseudoStaff = (staffKey: string, v: Vault) => v.staffKeyToId.get(staffKey) ?? staffKey;
export const realStaff = (id: string, v: Vault) => v.idToStaffKey.get(id) ?? id;
export const pseudoResident = (key: string, v: Vault) => v.residentKeyToId.get(key) ?? key;

/** Deep-scrub any JSON-able value (strings get scrubbed, staff keys get mapped). */
export function scrubDeep<T>(value: T, v: Vault): T {
  if (typeof value === 'string') {
    const key = v.staffKeyToId.get(value) ?? v.residentKeyToId.get(value);
    return (key ?? scrub(value, v)) as T;
  }
  if (Array.isArray(value)) return value.map((x) => scrubDeep(x, v)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, scrubDeep(x, v)])) as T;
  }
  return value;
}
