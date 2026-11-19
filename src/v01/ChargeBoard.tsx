import React from 'react';
import logoImg from './assets/careshift-logo.png';
import { Approval, AuditRow, SHIFT, SHIFT_MIN, STAFF, Task, onShiftStaff, resLabel, staffShort, taskDuration } from './data';
import type { HandItem } from './CareTeamView';

interface Props {
  tasks: Task[];
  approvals: Approval[];
  hand: HandItem[];
  audit: AuditRow[];
  onDecide: (id: string, ok: boolean) => void;
}

const left = SHIFT_MIN.end - SHIFT_MIN.now;

/**
 * Charge nurse board: unit-wide plan, coverage gaps, pending approvals and
 * escalations. Workload is shown per unit and per role on shift, never ranked.
 */
export function ChargeBoard({ tasks, approvals, hand, audit, onDecide }: Props) {
  const me = STAFF.s4;
  const staff = onShiftStaff().filter((s: any) => !s.charge_nurse);
  const open = tasks.filter((t) => t.status === 'open');
  const workMin = (ts: Task[]) => ts.reduce((n, t) => n + taskDuration(t).planMin, 0);
  const unitMin = workMin(open);
  const capacity = staff.length * left;
  const gaps = open.filter((t) => t.overdue || t.waiting);
  const pending = approvals.filter((a) => a.status === 'pending');
  const escalations = hand.filter((h) => h.kind === 'flag');

  return (
    <div id="care">
      <div className="top">
        <div className="hdr">
          <div><h1>{me.name}</h1><div className="sub">RN · Charge nurse · {SHIFT.unit} · {SHIFT.label}</div></div>
          <div className="prog">
            <div className="row"><b>Unit workload</b>&nbsp;<span>{unitMin} of {capacity} staff-min left</span></div>
            <div className="bar"><i style={{ width: `${Math.min(100, (unitMin / capacity) * 100)}%`, background: unitMin > capacity * 0.8 ? 'var(--red)' : undefined }} /></div>
            <div className="row" style={{ marginTop: 6, fontSize: 13, color: '#555' }}><span>Now {SHIFT.now}</span><span>{SHIFT.left}</span></div>
          </div>
        </div>
        <div className="logo"><img src={logoImg} alt="CareShift" style={{ width: 170 }} /></div>
      </div>

      <div className="main">
        <div className="listwrap"><div className="list">
          <h3 style={{ margin: '10px 4px' }}>Unit plan</h3>
          {staff.map((s: any) => {
            const theirs = open.filter((t) => t.assignee === s.id).sort((a, b) => a.due.localeCompare(b.due, undefined, { numeric: true }));
            return (
              <div key={s.id} className="note" style={{ background: '#f7f5f0' }}>
                <b>{s.name} · {s.role} <span className="sm" style={{ fontWeight: 400 }}>· {theirs.length} open</span></b>
                {theirs.length === 0 && <div className="sm">No open tasks</div>}
                {theirs.map((t) => (
                  <div key={t.id} className="row2" style={{ padding: '6px 0' }}>
                    <span>{t.overdue && <b style={{ color: 'var(--red)' }}>Overdue · </b>}{t.title} · {resLabel(t.res).split(' ·')[0]}
                      {t.incoming && <span className="tag y">from {staffShort(t.incoming.from)}, not accepted yet</span>}
                      {t.waiting && <span className="tag y">waiting for you</span>}
                    </span>
                    <span className="sm">{t.due} · ~{taskDuration(t).planMin} min</span>
                  </div>
                ))}
              </div>
            );
          })}
          <p className="sm" style={{ margin: '8px 4px' }}>Workload is shown for the unit, never ranked per nurse.</p>
        </div></div>

        <div className="side">
          <h2>Needs you</h2>
          <div className="who">{pending.length} approval{pending.length === 1 ? '' : 's'} · {gaps.length} coverage gap{gaps.length === 1 ? '' : 's'} · {escalations.length} escalation{escalations.length === 1 ? '' : 's'}</div>
          {pending.map((a) => {
            const t = tasks.find((x) => x.id === a.taskId)!;
            return (
              <div key={a.id} className="note">
                <b>Approve move · {t.title}</b>
                {resLabel(t.res)}<br />
                {staffShort(a.from)} ({STAFF[a.from].role}) → <b>{staffShort(a.to)} ({STAFF[a.to].role})</b><br />
                <span className="sm">Why: {a.why}</span><br />
                <span className="sm">Needs approval because {a.reason}.</span>
                <div className="foot" style={{ marginTop: 8 }}>
                  <button className="btn ghost" onClick={() => onDecide(a.id, false)}>Deny</button>
                  <button className="btn pri" onClick={() => onDecide(a.id, true)}>Approve</button>
                </div>
              </div>
            );
          })}
          {gaps.filter((t) => !t.waiting).map((t) => (
            <div key={t.id} className="note"><b style={{ color: 'var(--red)' }}>Coverage gap · {t.title}</b>{resLabel(t.res)} · due {t.due} · {staffShort(t.assignee)}</div>
          ))}
          {escalations.map((e, i) => (
            <div key={i} className="note"><b>Escalation · {e.title || 'Note'}</b>{resLabel(e.res)}<br />{e.note}</div>
          ))}
          {!pending.length && !gaps.length && !escalations.length && <p className="sm">Nothing needs you right now.</p>}
          <h3 style={{ margin: '14px 0 6px' }}>Audit trail</h3>
          {audit.length === 0 && <p className="sm">Every move, approval and decline is logged here.</p>}
          {[...audit].reverse().slice(0, 8).map((r, i) => <div key={i} className="sm" style={{ padding: '3px 0' }}>{r.at} · {r.text}</div>)}
        </div>
      </div>
    </div>
  );
}
