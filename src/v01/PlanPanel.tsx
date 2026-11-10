import React, { useState } from 'react';
import type { Change, PipelineResult } from '../agent/types';
import { resLabel, STAFF, staffShort, Task } from './data';

export type PlanState = { id: string; status: 'loading' | 'error' | 'dismissed' } | { id: string; status: 'ready'; result: PipelineResult };

export async function requestPlan(task: Task, attempts: number, reasonChip: string | null, note: string, tasks: Task[]): Promise<PipelineResult> {
  const res = await fetch('/api/agent/refusal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: { taskId: task.id, reasonChip: reasonChip ?? undefined, note, attempts, at: new Date().toISOString() },
      tasks: tasks.map((t) => ({ id: t.id, due: t.due, status: t.status, assignee: t.assignee, secondAssignee: t.secondAssignee, attempts: t.attempts ?? 0 })),
    }),
  });
  if (!res.ok) throw new Error(`Plan request failed (${res.status})`);
  return res.json();
}

const hhmm = (s: string) => s.replace(/^0/, '');
const who = (s: { assignee: string; second?: string }) => staffShort(s.assignee) + (s.second ? ` + ${staffShort(s.second)}` : '');

export const needsApproval = (r: PipelineResult) => r.changes.some((c) => c.to.assignee !== c.from.assignee || c.to.second !== c.from.second);

function ChangeRow({ c }: { c: Change }) {
  return (
    <div className="row2">
      <span>{c.title} · {c.residentLabel.split(' ·')[0]}</span>
      <span>{hhmm(c.from.time)} {who(c.from)} → <b>{hhmm(c.to.time)} {who(c.to)}</b></span>
    </div>
  );
}

export function PlanPanel({ result, tasks, onAccept, onDismiss }: { result: PipelineResult; tasks: Task[]; onAccept: () => void; onDismiss: () => void }) {
  const [why, setWhy] = useState(false);
  const approval = needsApproval(result);
  const handTask = result.handoff && tasks.find((t) => t.id === result.handoff!.taskId);
  return (
    <>
      {result.escalation && (
        <div className="rule" style={{ borderColor: 'var(--red)', background: '#fbeeee' }}>
          <b>{result.escalation.toName}, notified.</b> {result.escalation.logAsMissed ? 'Logged as missed. ' : ''}{result.escalation.reason && `Reason: ${result.escalation.reason}.`}
        </div>
      )}
      <p style={{ margin: '14px 0 4px', fontWeight: 600 }}>Suggested plan {approval && <span className="tag y">Needs charge nurse approval</span>}</p>
      <p style={{ margin: '4px 0 8px', lineHeight: 1.4 }}>{result.explanation}</p>
      {result.changes.map((c) => <ChangeRow key={c.taskId} c={c} />)}
      {handTask && (
        <div className="row2">
          <span>{handTask.title} · {resLabel(handTask.res).split(' ·')[0]}</span>
          <span>→ <b>Evening shift{result.handoff!.toStaff ? ` · ${staffShort(result.handoff!.toStaff)}` : ''}</b></span>
        </div>
      )}
      {!result.changes.length && !handTask && <p className="sm">No tasks need to move.</p>}
      {result.notify.length > 0 && <p className="sm">Notify: {result.notify.map((id) => STAFF[id]?.name ?? id).join(', ')}</p>}
      <button className="lnk" onClick={() => setWhy(!why)}>{why ? 'Hide how this was decided' : 'How this was decided'}</button>
      {why && (
        <div className="fields">
          <div><span>Source</span><b>{result.source === 'agent' ? 'AI agent (Gemini), checked by the rules' : 'Fixed rules, no AI'}</b></div>
          {result.trace.map((s, i) => <div key={i}><span>{s.step}</span><span style={{ textAlign: 'right' }}>{s.detail}</span></div>)}
        </div>
      )}
      <div className="foot">
        <button className="btn ghost" onClick={onDismiss}>Dismiss</button>
        <button className="btn pri" onClick={onAccept}>{approval ? 'Approve' : 'Accept plan'}</button>
      </div>
    </>
  );
}
