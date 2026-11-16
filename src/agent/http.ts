import type { Request, Response } from 'express';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { z } from 'zod';
import { runRefusalPipeline, type PipelineOptions } from './pipeline';
import { buildShiftState } from './state';

const HHMM = z.string().regex(/^\d{1,2}:\d{2}$/);

export const RefusalRequestSchema = z.object({
  event: z.object({
    taskId: z.string().min(1),
    reasonChip: z.string().max(80).optional(),
    note: z.string().max(1000).optional(),
    attempts: z.number().int().min(1).max(20),
    at: z.string().max(40).optional(),
  }),
  tasks: z
    .array(
      z.object({
        id: z.string().min(1),
        due: HHMM,
        status: z.string(),
        assignee: z.string().optional(),
        secondAssignee: z.string().optional(),
        attempts: z.number().int().min(0).optional(),
      }),
    )
    .min(1),
});

export function refusalHandler(getModel: () => BaseChatModel | undefined, opts: PipelineOptions = {}) {
  return async (req: Request, res: Response) => {
    const parsed = RefusalRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid refusal request', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
    }
    const { event, tasks } = parsed.data;
    const state = buildShiftState(tasks);
    if (!state.tasks.some((t) => t.id === event.taskId)) {
      return res.status(400).json({ error: `Task ${event.taskId} is not an open task on this shift` });
    }
    try {
      return res.json(await runRefusalPipeline(event, state, getModel(), opts));
    } catch (err) {
      console.error('Refusal pipeline failed:', err instanceof Error ? err.message : err);
      return res.status(500).json({ error: 'Could not build a plan' });
    }
  };
}
