import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, type BaseMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createAgent, toolCallLimitMiddleware } from 'langchain';
import { z } from 'zod';
import { createTools, ExtraConstraintSchema, type ToolContext } from './tools';
import { residentName } from './state';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const MAX_TOOL_CALLS = 4;

export const SYSTEM_PROMPT = `You are the re-planning assistant in CareShift, a shift tool for a long-term care home. A resident has just refused a care task. Your job is to re-plan the rest of the shift around that refusal and explain the plan to the care team.

Steps:
1. Call get_rules_result. The rules are final. You never decide whether a task may be skipped, handed off or deferred, and you never mark a task done.
2. Turn the refusal note into extra constraints for the refused task only:
   - not_before with minutesFromNow, when the resident asked for a delay or the cause needs time to fix. Examples: "cold, wants room warmer" -> 20; "too tired", "asleep" or "later" -> 30.
   - avoid_staff with staffId, when the resident does not want a specific staff member.
   - prefer_staff with staffId, when a different nurse or a named person is more likely to succeed.
   Call get_shift_state if you need staff ids, roles or times. Do not add a constraint the note does not support.
3. Call run_solver with those constraints. Call it a second time only if the first result has no usable option.
4. Choose exactly one option id that run_solver returned. Prefer the lowest cost unless the note gives a clear reason to pick another.
5. Write an explanation of 2 to 3 plain sentences for the care team: what changes, when, by whom, and why. Give no medical advice and no dosages, and do not invent facts.
6. List the staff ids to notify: anyone whose tasks change, plus the charge nurse whenever the rules say to escalate.

You may make at most ${MAX_TOOL_CALLS} tool calls. Your final reply must be only a JSON object, with no code fence and no other text:
{"chosenOptionId": string, "constraintsUsed": [{"type": "not_before", "minutesFromNow": number} | {"type": "avoid_staff", "staffId": string} | {"type": "prefer_staff", "staffId": string}], "explanation": string, "notify": [string]}`;

export const AgentDecisionSchema = z.object({
  chosenOptionId: z.string().min(1),
  constraintsUsed: z.array(ExtraConstraintSchema),
  explanation: z.string().min(1).max(800),
  notify: z.array(z.string()),
});
export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

export function createGeminiModel(apiKey: string, model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL): BaseChatModel {
  return new ChatGoogleGenerativeAI({ model, apiKey, temperature: 0, maxRetries: 1 });
}

export function buildAgent(model: BaseChatModel, ctx: ToolContext) {
  return createAgent({
    model,
    tools: createTools(ctx),
    systemPrompt: SYSTEM_PROMPT,
    middleware: [toolCallLimitMiddleware({ runLimit: MAX_TOOL_CALLS, exitBehavior: 'error' })],
  });
}

function textOf(m: BaseMessage): string {
  if (typeof m.content === 'string') return m.content;
  return m.content.map((b) => (b.type === 'text' && 'text' in b ? String(b.text) : '')).join('');
}

export function parseDecision(text: string): AgentDecision {
  const body = text.replace(/```(?:json)?/g, '').trim();
  const match = body.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Agent reply had no JSON object');
  return AgentDecisionSchema.parse(JSON.parse(match[0]));
}

export function refusalPrompt(ctx: ToolContext) {
  const t = ctx.state.tasks.find((x) => x.id === ctx.event.taskId)!;
  return [
    `Refused task: ${t.id} "${t.title}" for ${t.residents.map(residentName).join(', ')}.`,
    `Refusal number today: ${ctx.rules.attempts}.`,
    `Reason chip: ${ctx.event.reasonChip ?? 'none'}.`,
    `Staff note: ${ctx.event.note?.trim() || 'none'}.`,
  ].join('\n');
}

export async function runAgent(model: BaseChatModel, ctx: ToolContext, timeoutMs: number): Promise<AgentDecision> {
  const agent = buildAgent(model, ctx);
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(new Error(`Agent timed out after ${timeoutMs / 1000} s`));
    }, timeoutMs);
  });
  try {
    const out = await Promise.race([
      agent.invoke({ messages: [new HumanMessage(refusalPrompt(ctx))] }, { signal: ctrl.signal, recursionLimit: 12 }),
      timeout,
    ]);
    const last = out.messages[out.messages.length - 1];
    return parseDecision(textOf(last));
  } finally {
    clearTimeout(timer);
  }
}
