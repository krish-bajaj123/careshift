import React from 'react';
import logoImg from './assets/careshift-logo.png';
import { Approval, AuditRow, Noticed, SHIFT, SHIFT_MIN, STAFF, Task, onShiftStaff, resLabel, staffShort, taskDuration } from './data';
import type { HandItem } from './CareTeamView';

interface Props {
  tasks: Task[];
  approvals: Approval[];
  hand: HandItem[];
  audit: AuditRow[];
  onDecide: (id: string, ok: boolean) => void;
  noticed: Noticed[];
  boxEmpty: boolean;
  onScan: () => void;
  onNoticedTask: (id: string, to: string) => void;
  onNoticedHandoff: (id: string) => void;
  onNoticedReview: (id: string) => void;
}

const left = SHIFT_MIN.end - SHIFT_MIN.now;

/**
 * Charge nurse board: unit-wide plan, coverage gaps, pending approvals and
 * escalations. Workload is shown per unit and per role on shift, never ranked.
 */
export function ChargeBoard({ tasks, approvals, hand, audit, onDecide, noticed, boxEmpty, onScan, onNoticedTask, onNoticedHandoff, onNoticedReview }: Props) {
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
          <div className="who">{noticed.filter((n) => n.status === 'new').length} I Noticed · {pending.length} approval{pending.length === 1 ? '' : 's'} · {gaps.length} coverage gap{gaps.length === 1 ? '' : 's'} · {escalations.length} escalation{escalations.length === 1 ? '' : 's'}</div>
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
          <NoticedInbox items={noticed} staff={staff} boxEmpty={boxEmpty} onScan={onScan} onTask={onNoticedTask} onHandoff={onNoticedHandoff} onReview={onNoticedReview} />
          <h3 style={{ margin: '14px 0 6px' }}>Audit trail</h3>
          {audit.length === 0 && <p className="sm">Every move, approval and decline is logged here.</p>}
          {[...audit].reverse().slice(0, 8).map((r, i) => <div key={i} className="sm" style={{ padding: '3px 0' }}>{r.at} · {r.text}</div>)}
        </div>
      </div>
    </div>
  );
}

/**
 * The "I Noticed" list: QR form replies and scanned paper slips land here as one
 * list. "Nurse needed now" items go first. The reviewer turns each one into a
 * task, adds it to the handoff, or marks it reviewed (which thanks the sender).
 */
function NoticedInbox({ items, staff, boxEmpty, onScan, onTask, onHandoff, onReview }: {
  items: Noticed[]; staff: any[]; boxEmpty: boolean; onScan: () => void;
  onTask: (id: string, to: string) => void; onHandoff: (id: string) => void; onReview: (id: string) => void;
}) {
  const fresh = items.filter((n) => n.status === 'new').sort((a, b) => Number(b.nurseNow) - Number(a.nurseNow));
  const handled = items.filter((n) => n.status !== 'new');
  return (
    <>
      <h3 style={{ margin: '14px 0 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>I Noticed <span className="sm" style={{ fontWeight: 400 }}>· {fresh.length} new</span></span>
        <button className="btn" style={{ padding: '5px 10px', fontSize: 13 }} onClick={onScan} disabled={boxEmpty} title="Empty the locked box and scan the paper slips in one batch">
          {boxEmpty ? 'Box empty ✓' : '📥 Scan slips from box'}
        </button>
      </h3>
      <p className="sm" style={{ margin: '0 0 8px' }}>QR form replies and scanned paper slips, in one list. Check at the mid-shift huddle and before handoff.</p>
      {fresh.map((n) => <NoticedCard key={n.id} n={n} staff={staff} onTask={onTask} onHandoff={onHandoff} onReview={onReview} />)}
      {fresh.length === 0 && <p className="sm">All caught up.</p>}
      {handled.map((n) => (
        <div key={n.id} className="noticed done"><b>Rm {resLabel([n.res]).split('Rm ')[1]} · {n.category}</b> {n.outcome}</div>
      ))}
    </>
  );
}

function NoticedCard({ n, staff, onTask, onHandoff, onReview }: { n: Noticed; staff: any[]; onTask: (id: string, to: string) => void; onHandoff: (id: string) => void; onReview: (id: string) => void }) {
  const nurse = staff.find((s) => s.role !== 'PSW')?.id ?? staff[0]?.id;
  const [to, setTo] = React.useState<string>(n.see === 'Nurse' || n.nurseNow ? nurse : staff[0]?.id);
  return (
    <div className={`noticed ${n.nurseNow ? 'now' : ''}`}>
      {n.nurseNow && <div style={{ color: 'var(--red)', fontWeight: 700, fontSize: 13 }}>⚑ Nurse needed now · should already be told in person</div>}
      <b>{resLabel([n.res])} · {n.category}</b>
      <div>"{n.detail}"</div>
      <div className="sm" style={{ marginTop: 4 }}>
        {n.when} · {n.where} · for {n.see.toLowerCase()} · from {n.by}<br />
        {n.source === 'slip' ? `📄 Paper slip, scanned ${n.received}` : `📱 QR form, ${n.received}`}
      </div>
      <div className="acts">
        <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Assign follow-up to">
          {staff.map((s: any) => <option key={s.id} value={s.id}>{staffShort(s.id)} ({s.role})</option>)}
        </select>
        <button className="btn pri" onClick={() => onTask(n.id, to)}>Make a task</button>
        <button className="btn" onClick={() => onHandoff(n.id)}>Add to handoff</button>
        <button className="btn ghost" onClick={() => onReview(n.id)}>Reviewed ✓</button>
      </div>
    </div>
  );
}
