import { describe, expect, it } from 'vitest';
import { createGeminiModel } from '../src/agent/agent';
import { runRefusalPipeline } from '../src/agent/pipeline';
import { state } from './helpers';

const live = process.env.RUN_LIVE === '1' && !!process.env.GEMINI_API_KEY;

describe.skipIf(!live)('live Gemini agent', () => {
  it('re-plans a cold medication refusal with the real model', async () => {
    const model = createGeminiModel(process.env.GEMINI_API_KEY!);
    const r = await runRefusalPipeline({ taskId: 't8', reasonChip: 'Said they were cold', note: 'cold, wants room warmer', attempts: 1 }, state(), model);
    console.log(JSON.stringify({ source: r.source, chosen: r.chosen.id, explanation: r.explanation, trace: r.trace }, null, 2));
    expect(r.source).toBe('agent');
    expect(r.escalation).toBeUndefined();
  }, 30_000);
});
