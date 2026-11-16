import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { runAgent, type AgentDecision } from './agent';
import { evaluate, targetTask, verifyOption } from './medRules';
import { diffPlan } from './solver';
import { fmtMin, residentName, staffById } from './state';
import { runSolverFor, toConstraints, type ExtraConstraint, type ToolContext } from './tools';
import type { Change, Constraint, OptionSummary, PipelineResult, PlanOption, RefusalEvent, RulesResult, ShiftState, SolveResult, TraceStep } from './types';

export const AGENT_TIMEOUT_MS = 20_000;

export const CHIP_TABLE: Record<string, { minutes: number; differentStaff?: boolean }> = {
  'Said they were cold': { minutes: 20 },
  'Too tired': { minutes: 30 },
  'Not now / later': { minutes: 30 },
  'Upset or agitated': { minutes: 30, differentStaff: true },
  Asleep: { minutes: 30 },
  Other: { minutes: 15 },
};

export interface PipelineOptions {
  timeoutMs?: number;
}

const name = (id?: string) => (id ? staffById(id)?.name ?? id : '');
const shortName = (id?: string) => (id ? staffById(id)?.short ?? id : '');

export function chipConstraints(event: RefusalEvent, state: ShiftState, rules: RulesResult): ExtraConstraint[] {
  const row = CHIP_TABLE[event.reasonChip ?? ''] ?? CHIP_TABLE.Other;
  const out: ExtraConstraint[] = [{ type: 'not_before', minutesFromNow: row.minutes }];
  if (row.differentStaff) {
    const t = targetTask(event, state);
    state.staff
      .filter((s) => t.allowedRoles.includes(s.role) && s.id !== t.assignee)
      .forEach((s) => out.push({ type: 'prefer_staff', staffId: s.id }));
  }
  return rules.excludeTarget ? [] : out;
}

function summarize(state: ShiftState, o: PlanOption): OptionSummary {
  return {
    id: o.id,
    cost: o.cost,
    assignments: o.assignments.map((a) => ({ taskId: a.taskId, start: fmtMin(a.start), staff: a.staff })),
    changes: diffPlan(state, o),
    unplaced: o.unplaced,
  };
}

function essentialIds(state: ShiftState, o: PlanOption) {
  return o.unplaced.filter((u) => state.tasks.find((t) => t.id === u.taskId)?.priority === 'essential').map((u) => u.taskId);
}

function validateDecision(d: AgentDecision, ctx: ToolContext, baseline: SolveResult): { option: PlanOption } | { error: string } {
  const option = ctx.options.get(d.chosenOptionId);
  if (!option) return { error: `chosen option "${d.chosenOptionId}" was not returned by the solver in this run` };
  const violations = verifyOption(ctx.state, option, option.constraints, ctx.rules);
  if (violations.length) return { error: `option ${option.id} breaks the rules: ${violations.join('; ')}` };
  const placeable = new Set(baseline.options[0] ? essentialIds(ctx.state, baseline.options[0]) : []);
  const dropped = essentialIds(ctx.state, option).filter((id) => !placeable.has(id));
  if (dropped.length) return { error: `option ${option.id} leaves essential task(s) ${dropped.join(', ')} unplaced although the rules allow a slot` };
  return { option };
}

function describeMove(c: Change) {
  const who = c.to.assignee !== c.from.assignee ? ` with ${shortName(c.to.assignee)}` : '';
  return `${c.title} (${c.residentLabel.split(' ·')[0]}) moves to ${c.to.time}${who}`;
}

function fallbackExplanation(ctx: ToolContext, changes: Change[], option: PlanOption, escalation: PipelineResult['escalation']): string {
  const t = targetTask(ctx.event, ctx.state);
  const who = residentName(t.residents[0]);
  const why = ctx.event.reasonChip ? ` (${ctx.event.reasonChip.toLowerCase()})` : '';
  const again = ctx.rules.attempts >= 2 ? ' again' : '';
  const parts: string[] = [];
  if (ctx.rules.handoff) {
    parts.push(`${t.title} is flexible and this is refusal ${ctx.rules.attempts} today, so it can move to the evening shift${ctx.rules.handoff.toStaff ? ` (${name(ctx.rules.handoff.toStaff)})` : ''}. ${who} still needs it this week, so it stays on the plan.`);
  } else {
    const slot = option.assignments.find((a) => a.taskId === t.id);
    const missed = option.unplaced.find((u) => u.taskId === t.id);
    if (slot) {
      const kind = ctx.rules.mustEscalate ? 'One final attempt' : 'Retry';
      parts.push(`${who} refused ${t.title}${again}${why}. ${kind} at ${fmtMin(slot.start)} by ${shortName(slot.staff[0])}, ${slot.start - ctx.state.now} minutes from now, inside the safe window that closes at ${fmtMin(t.latest)}.`);
    } else if (missed) {
      parts.push(`${who} refused ${t.title}${again}${why}. No safe retry fits: ${missed.reason}.`);
    }
  }
  const others = changes.filter((c) => c.taskId !== t.id);
  if (others.length) parts.push(`To make room, ${others.map(describeMove).join('; ')}.`);
  else if (ctx.rules.handoff) parts.push('The rest of the shift plan does not change.');
  if (escalation) parts.push(`${name(escalation.to)} (${escalation.toName.split(', ')[1]}) is notified${escalation.logAsMissed ? ' and the dose is logged as missed' : ''}.`);
  return parts.join(' ');
}

export async function runRefusalPipeline(event: RefusalEvent, state: ShiftState, model?: BaseChatModel, opts: PipelineOptions = {}): Promise<PipelineResult> {
  const trace: TraceStep[] = [];
  trace.push({ step: 'state', detail: `now ${fmtMin(state.now)}, ${state.staff.length} staff on ${state.shiftId}, ${state.tasks.length} open tasks` });

  const rules = evaluate(event, state);
  trace.push({ step: 'rules', detail: `${rules.summary} Allowed: ${rules.allowedActions.join(', ')}${rules.mustEscalate ? '. Must escalate.' : ''}` });

  const ctx: ToolContext = { event, state, rules, trace, options: new Map(), solverCalls: 0 };
  const baseline = runSolverFor(ctx, [], 'base-');
  trace.push({ step: 'solver', detail: `rules-only plan: ${baseline.feasible ? 'feasible' : `infeasible (${baseline.unplaced.map((u) => `${u.taskId}: ${u.reason}`).join('; ')})`}, ${baseline.nodes} nodes` });

  let source: PipelineResult['source'] = 'fallback';
  let chosen: PlanOption | undefined;
  let options: PlanOption[] = [];
  let explanation = '';
  let agentNotify: string[] = [];

  if (model) {
    try {
      const decision = await runAgent(model, ctx, opts.timeoutMs ?? AGENT_TIMEOUT_MS);
      trace.push({ step: 'agent', detail: `picked ${decision.chosenOptionId} using ${decision.constraintsUsed.length} constraint(s)` });
      const v = validateDecision(decision, ctx, baseline);
      if ('error' in v) {
        trace.push({ step: 'validate', detail: `rejected: ${v.error}` });
      } else {
        trace.push({ step: 'validate', detail: `${v.option.id} passes the rules again` });
        source = 'agent';
        chosen = v.option;
        const run = chosen.id.replace(/[a-z]$/, '');
        options = [...ctx.options.values()].filter((o) => o.id.replace(/[a-z]$/, '') === run);
        explanation = decision.explanation;
        agentNotify = decision.notify;
      }
    } catch (err) {
      trace.push({ step: 'agent', detail: `failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  } else {
    trace.push({ step: 'agent', detail: 'skipped: no model configured' });
  }

  if (!chosen) {
    const extra = chipConstraints(event, state, rules);
    const out = runSolverFor(ctx, toConstraints(extra, ctx, 'fallback'), 'fb-');
    trace.push({ step: 'fallback', detail: `reason chip "${event.reasonChip ?? 'none'}" -> ${extra.map((c) => (c.type === 'not_before' ? `not_before +${c.minutesFromNow}m` : `${c.type} ${c.staffId}`)).join(', ') || 'no extra constraints'}; ${out.options.length} option(s), ${out.nodes} nodes` });
    options = out.options;
    chosen = out.options[0];
    source = 'fallback';
  }

  const changes = diffPlan(state, chosen);
  const target = targetTask(event, state);
  const missing = essentialIds(state, chosen);
  const targetMissing = missing.includes(target.id);
  let escalation: PipelineResult['escalation'];
  if (rules.mustEscalate || missing.length) {
    const to = rules.escalateTo ?? state.staff.find((s) => s.chargeNurse)?.id ?? '';
    const reasons = [rules.mustEscalate ? `refusal ${rules.attempts} of a medication` : '', ...chosen.unplaced.filter((u) => missing.includes(u.taskId)).map((u) => `${u.taskId}: ${u.reason}`)].filter(Boolean);
    const role = staffById(to)?.chargeNurse ? 'charge nurse' : staffById(to)?.role ?? '';
    escalation = { to, toName: `${name(to)}, ${role}`, reason: reasons.join('; '), logAsMissed: rules.logAsMissed || (rules.isMed && targetMissing) };
  }

  if (source === 'fallback') explanation = fallbackExplanation(ctx, changes, chosen, escalation);

  const onShift = new Set(state.staff.map((s) => s.id));
  const notify = [...new Set([
    ...(escalation ? [escalation.to] : []),
    ...changes.filter((c) => c.to.assignee !== c.from.assignee).map((c) => c.to.assignee),
    ...agentNotify,
  ])].filter((id) => onShift.has(id));

  trace.push({ step: 'result', detail: `${source}: ${chosen.id}, cost ${chosen.cost.total}, ${changes.length} change(s)${escalation ? `, escalate to ${escalation.to}` : ''}` });

  return {
    source,
    taskId: event.taskId,
    ...(escalation ? { escalation } : {}),
    ...(rules.handoff ? { handoff: { taskId: rules.taskId, ...rules.handoff } } : {}),
    allowedActions: rules.allowedActions,
    options: options.slice(0, 3).map((o) => summarize(state, o)),
    chosen: summarize(state, chosen),
    constraintsUsed: chosen.constraints.filter((c: Constraint) => c.source !== 'rules'),
    changes,
    explanation,
    notify,
    trace,
  };
}
