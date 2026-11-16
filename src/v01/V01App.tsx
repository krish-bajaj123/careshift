import React, { useState } from 'react';
import './v01.css';
import { initialTasks, initialNotes, Task, STAFF, SHIFT, Approval, AuditRow, isCharge, staffShort } from './data';
import { CareTeamView, HandItem } from './CareTeamView';
import { ChargeBoard } from './ChargeBoard';
import { FamilyPortal, Visit } from './FamilyPortal';
import type { PipelineResult } from '../agent/types';

const VIEW_AS = ['s1', 's2', 's3', 's4'];

const START_VISITS: Visit[] = [{ when: 'Tue Nov 10, 2:00 pm', place: 'Garden room' }];

/** CareShift: care team (tablet), charge nurse board, family portal (phone). */
export function V01App({ onLegacy }: { onLegacy: () => void }) {
  const [view, setView] = useState<'care' | 'fam'>(() => (location.hash === '#family' ? 'fam' : 'care'));
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [notes] = useState(initialNotes);
  const [read, setRead] = useState(false);
  const [hand, setHand] = useState<HandItem[]>([]);
  const [approved, setApproved] = useState(false);
  const [visits, setVisits] = useState<Visit[]>(START_VISITS);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const [viewAs, setViewAs] = useState(() => (location.hash === '#charge' ? 's4' : 's1'));

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2600); };
  const log = (text: string) => setAudit((a) => [...a, { at: SHIFT.now, text }]);
  const patch = (id: string, p: Partial<Task>) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const T = (id: string) => tasks.find((t) => t.id === id)!;

  const applyPlan = (r: PipelineResult) => {
    setTasks((ts) => ts.map((t) => {
      const c = r.changes.find((x) => x.taskId === t.id);
      if (!c) return t;
      const tags = [...(t.tags ?? []).filter((g) => g.text !== 'Re-planned'), { kind: 'y' as const, text: 'Re-planned' }];
      const moved = c.to.assignee !== t.assignee;
      return { ...t, due: c.to.time.replace(/^0/, ''), assignee: c.to.assignee, secondAssignee: c.to.second, tags, waiting: undefined,
        ...(moved ? { incoming: { from: t.assignee, why: r.explanation, at: SHIFT.now } } : {}) };
    }));
    const esc = r.escalation;
    const t = tasks.find((x) => x.id === r.taskId);
    if (esc && t) setHand((h) => [...h, { res: t.res, title: t.title.split(' —')[0], note: `${esc.logAsMissed ? 'Logged as missed. ' : ''}${esc.reason}`, kind: 'flag', to: esc.toName }]);
    log(`Plan applied for ${t?.title ?? r.taskId} (${r.changes.length} change${r.changes.length === 1 ? '' : 's'})`);
  };

  /** Plans that move work to another person go to the charge nurse first. */
  const requestPlanApproval = (r: PipelineResult, by: string) => {
    const c = r.changes.find((x) => x.to.assignee !== x.from.assignee)!;
    setApprovals((a) => [...a, { id: `a${a.length + 1}`, taskId: c.taskId, from: c.from.assignee, to: c.to.assignee, why: r.explanation, reason: 'the suggested plan moves a task to another person', kind: 'plan', plan: r, status: 'pending' }]);
    patch(c.taskId, { waiting: 'Waiting for charge nurse approval' });
    log(`${staffShort(by)} asked to approve a plan moving ${T(c.taskId).title} to ${staffShort(c.to.assignee)}`);
    toast(`Sent to ${staffShort('s4')} for approval`);
  };

  /** Pass a task to a coworker. Flexible, same-role moves go straight through; the rest need the charge nurse. */
  const passTask = (id: string, to: string, why: string) => {
    const t = T(id);
    const from = t.assignee;
    const sameRole = STAFF[to].role === STAFF[from].role;
    if (t.priority === 'flexible' && sameRole) {
      patch(id, { assignee: to, incoming: { from, why, at: SHIFT.now } });
      log(`${staffShort(from)} passed ${t.title} to ${staffShort(to)} (automatic: flexible, same role)`);
      toast(`Sent to ${staffShort(to)} with your note`);
      return;
    }
    const reason = t.priority === 'essential' ? 'it is an essential task' : 'it moves across roles';
    setApprovals((a) => [...a, { id: `a${a.length + 1}`, taskId: id, from, to, why, reason, kind: 'pass', status: 'pending' }]);
    patch(id, { waiting: 'Waiting for charge nurse approval' });
    log(`${staffShort(from)} asked to pass ${t.title} to ${staffShort(to)} (needs approval: ${reason})`);
    toast(`Sent to ${staffShort('s4')} for approval (${reason})`);
  };

  const decide = (aid: string, ok: boolean) => {
    const a = approvals.find((x) => x.id === aid)!;
    setApprovals((as) => as.map((x) => (x.id === aid ? { ...x, status: ok ? 'approved' : 'denied' } : x)));
    const t = T(a.taskId);
    if (!ok) {
      patch(a.taskId, { waiting: undefined });
      log(`${staffShort('s4')} denied moving ${t.title} to ${staffShort(a.to)}`);
      return toast('Denied, the task stays where it was');
    }
    if (a.kind === 'plan' && a.plan) applyPlan(a.plan as PipelineResult);
    else patch(a.taskId, { assignee: a.to, waiting: undefined, incoming: { from: a.from, why: a.why, at: SHIFT.now } });
    log(`${staffShort('s4')} approved moving ${t.title} to ${staffShort(a.to)}`);
    toast(`Approved, ${staffShort(a.to)} has been notified`);
  };

  const respond = (id: string, accept: boolean) => {
    const t = T(id);
    if (!t.incoming) return;
    if (accept) {
      patch(id, { incoming: undefined });
      log(`${staffShort(t.assignee)} accepted ${t.title} from ${staffShort(t.incoming.from)}`);
      return toast('Added to your list');
    }
    const tags = [...(t.tags ?? []), { kind: 'g' as const, text: `Declined by ${staffShort(t.assignee)}` }];
    patch(id, { assignee: t.incoming.from, incoming: undefined, tags });
    log(`${staffShort(t.assignee)} declined ${t.title}; back to ${staffShort(t.incoming.from)}`);
    toast(`Sent back to ${staffShort(t.incoming.from)}`);
  };

  const reset = () => { setTasks(initialTasks()); setRead(false); setHand([]); setApproved(false); setVisits(START_VISITS); setApprovals([]); setAudit([]); setKey((k) => k + 1); toast('Demo reset'); };

  return (
    <div className="v01" style={{ background: view === 'fam' ? '#e9e5de' : '#f4f1ec' }}>
      <div className="demo">Demo view:
        <button className={view === 'care' ? 'on' : ''} onClick={() => setView('care')}>Care team (tablet)</button>
        <button className={view === 'fam' ? 'on' : ''} onClick={() => setView('fam')}>Family (phone)</button>
        {view === 'care' && <>View as:{VIEW_AS.map((id) => <button key={id} className={viewAs === id ? 'on' : ''} onClick={() => setViewAs(id)}>{STAFF[id].name} ({isCharge(id) ? 'charge' : STAFF[id].role})</button>)}</>}
        <button onClick={reset}>Reset demo</button>
        <button onClick={onLegacy} title="Old v0.0 nurse console">v0.0 console</button>
      </div>
      {view === 'fam'
        ? <FamilyPortal key={key} visits={visits} setVisits={setVisits} toast={toast} />
        : isCharge(viewAs)
          ? <ChargeBoard tasks={tasks} approvals={approvals} hand={hand} audit={audit} onDecide={decide} />
          : <CareTeamView key={`${key}-${viewAs}`} staffId={viewAs} onAcceptPlan={applyPlan} onRequestApproval={requestPlanApproval} onPass={passTask} onRespond={respond}
              tasks={tasks} setTasks={setTasks} notes={notes} read={read} setRead={setRead} hand={hand} setHand={setHand} approved={approved} setApproved={setApproved} toast={toast} />}
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
