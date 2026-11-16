import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { refusalHandler } from '../src/agent/http';
import { clientTasks } from './helpers';

function app() {
  const a = express();
  a.use(express.json());
  a.post('/api/agent/refusal', refusalHandler(() => undefined));
  return a;
}

describe('POST /api/agent/refusal', () => {
  it('returns 200 with a valid fallback plan when there is no API key', async () => {
    const res = await request(app())
      .post('/api/agent/refusal')
      .send({ event: { taskId: 't8', reasonChip: 'Said they were cold', note: '', attempts: 1, at: '10:05' }, tasks: clientTasks({ t8: { attempts: 1 } }) });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('fallback');
    expect(Object.keys(res.body).sort()).toEqual(['allowedActions', 'changes', 'chosen', 'constraintsUsed', 'explanation', 'notify', 'options', 'source', 'taskId', 'trace']);
    expect(res.body.chosen).toEqual(expect.objectContaining({ id: expect.any(String), cost: expect.any(Object), assignments: expect.any(Array), changes: expect.any(Array), unplaced: [] }));
    expect(res.body.changes[0]).toEqual({ taskId: 't8', title: 'Morning medications', residentLabel: 'Rm 212 · Emeka Okafor', from: { time: '10:00', assignee: 's3' }, to: { time: '10:25', assignee: 's3' } });
    expect(JSON.stringify(res.body)).not.toMatch(/GEMINI|apiKey/i);
  });

  it('returns 400 for a bad body or a task that is not open', async () => {
    expect((await request(app()).post('/api/agent/refusal').send({ event: { taskId: 't8' } })).status).toBe(400);
    const done = await request(app()).post('/api/agent/refusal').send({ event: { taskId: 't1', attempts: 1 }, tasks: clientTasks() });
    expect(done.status).toBe(400);
  });
});
