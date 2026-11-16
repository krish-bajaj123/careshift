import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { diffPlan, solve } from './solver';
import { fmtMin, residentName } from './state';
import type { Constraint, PlanOption, RefusalEvent, RulesResult, ShiftState, SolveResult, TraceStep } from './types';

export const ExtraConstraintSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('not_before'), minutesFromNow: z.number().int().min(0).max(240) }),
  z.object({ type: z.literal('avoid_staff'), staffId: z.string().min(1) }),
  z.object({ type: z.literal('prefer_staff'), staffId: z.string().min(1) }),
]);
export type ExtraConstraint = z.infer<typeof ExtraConstraintSchema>;

export const RunSolverInputSchema = z.object({
  extraConstraints: z
    .array(
      z.object({
        type: z.enum(['not_before', 'avoid_staff', 'prefer_staff']).describe('Constraint kind, always about the refused task'),
        minutesFromNow: z.number().int().optional().describe('not_before only: earliest retry, in minutes from now'),
        staffId: z.string().optional().describe('avoid_staff / prefer_staff only: staff id such as s3'),
      }),
    )
    .describe('Extra constraints read from the refusal note. Empty array if the note gives none.'),
});

export interface ToolContext {
  event: RefusalEvent;
  state: ShiftState;
  rules: RulesResult;
  trace: TraceStep[];
  options: Map<string, PlanOption>;
  solverCalls: number;
}

export function toConstraints(extra: ExtraConstraint[], ctx: Pick<ToolContext, 'state' | 'rules'>, source: string): Constraint[] {
  return extra.map((c) =>
    c.type === 'not_before'
      ? { type: 'not_before', taskId: ctx.rules.taskId, time: ctx.state.now + c.minutesFromNow, source }
      : { type: c.type, taskId: ctx.rules.taskId, staffId: c.staffId, source },
  );
}

export function runSolverFor(ctx: Pick<ToolContext, 'state' | 'rules'>, extra: Constraint[], idPrefix: string): SolveResult {
  const r = ctx.rules;
  return solve({
    state: ctx.state,
    constraints: [...r.hardConstraints, ...extra],
    keyTaskId: r.excludeTarget ? undefined : r.taskId,
    exclude: r.excludeTarget ? [r.taskId] : [],
    idPrefix,
  });
}

export function shiftSnapshot(ctx: Pick<ToolContext, 'state' | 'event' | 'rules'>) {
  const s = ctx.state;
  return {
    now: fmtMin(s.now),
    shiftEnd: fmtMin(s.shiftEnd),
    refusedTaskId: ctx.event.taskId,
    staff: s.staff.map((m) => ({ id: m.id, name: m.name, role: m.role, chargeNurse: m.chargeNurse })),
    openTasks: s.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      residents: t.residents.map(residentName),
      kind: t.kind,
      priority: t.priority,
      due: fmtMin(t.due),
      latestSafeStart: fmtMin(t.latest),
      durationMin: t.durationMin,
      assignee: t.assignee,
      secondAssignee: t.secondAssignee ?? null,
      allowedRoles: t.allowedRoles,
      attempts: t.attempts,
    })),
    staffBusy: s.blocks.map((b) => ({ staffId: b.staffId, from: fmtMin(b.from), to: fmtMin(b.to), reason: b.reason })),
  };
}

export function rulesSnapshot(rules: RulesResult) {
  return {
    taskId: rules.taskId,
    isMedication: rules.isMed,
    attempt: rules.attempts,
    allowedActions: rules.allowedActions,
    mustEscalate: rules.mustEscalate,
    escalateTo: rules.mustEscalate ? rules.escalateTo : undefined,
    logAsMissed: rules.logAsMissed,
    handoff: rules.handoff,
    hardConstraints: rules.hardConstraints.map((c) => (c.type === 'not_before' ? { type: c.type, time: fmtMin(c.time) } : { type: c.type, staffId: c.staffId })),
    summary: rules.summary,
  };
}

export function createTools(ctx: ToolContext) {
  const getShiftState = tool(
    async () => {
      ctx.trace.push({ step: 'tool:get_shift_state', detail: `${ctx.state.tasks.length} open tasks, ${ctx.state.staff.length} staff on shift` });
      return JSON.stringify(shiftSnapshot(ctx));
    },
    { name: 'get_shift_state', description: 'Current time, on-shift staff and open tasks for the rest of this shift.', schema: z.object({}) },
  );

  const getRulesResult = tool(
    async () => {
      ctx.trace.push({ step: 'tool:get_rules_result', detail: ctx.rules.allowedActions.join(', ') });
      return JSON.stringify(rulesSnapshot(ctx.rules));
    },
    { name: 'get_rules_result', description: 'What the deterministic care rules allow for this refusal, including whether escalation is required. These rules are final.', schema: z.object({}) },
  );

  const runSolver = tool(
    async (input: z.infer<typeof RunSolverInputSchema>) => {
      const parsed = z.array(ExtraConstraintSchema).safeParse(
        input.extraConstraints.map((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined && v !== null))),
      );
      if (!parsed.success) {
        ctx.trace.push({ step: 'tool:run_solver', detail: 'rejected invalid constraints' });
        return JSON.stringify({ error: 'Invalid extraConstraints', issues: parsed.error.issues.map((i) => i.message) });
      }
      ctx.solverCalls += 1;
      const extra = toConstraints(parsed.data, ctx, 'agent');
      const out = runSolverFor(ctx, extra, `opt-${ctx.solverCalls}`);
      out.options.forEach((o) => ctx.options.set(o.id, o));
      ctx.trace.push({
        step: 'tool:run_solver',
        detail: `${parsed.data.length} extra constraint(s); ${out.options.length} option(s), best cost ${out.options[0]?.cost.total ?? '-'}, ${out.nodes} nodes`,
      });
      return JSON.stringify({
        feasible: out.feasible,
        unplaced: out.unplaced,
        options: out.options.map((o) => ({
          id: o.id,
          cost: o.cost,
          changes: diffPlan(ctx.state, o).map((c) => `${c.taskId} ${c.title} (${c.residentLabel}): ${c.from.time} ${c.from.assignee} -> ${c.to.time} ${c.to.assignee}${c.to.second ? `+${c.to.second}` : ''}`),
          unplaced: o.unplaced,
        })),
      });
    },
    {
      name: 'run_solver',
      description: 'Re-plan the rest of the shift around the refused task. Returns up to 3 options, cheapest first. Rule constraints are always applied.',
      schema: RunSolverInputSchema,
    },
  );

  return [getShiftState, getRulesResult, runSolver];
}
