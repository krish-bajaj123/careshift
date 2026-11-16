import React, { useState } from 'react';
import { RESIDENTS, STAFF, SHIFT, Task, Note, resLabel, staffShort } from './data';
import { adviseOnMedRefusal, adviseOnRefusal, isMedication, needsSecondStaff } from './rules';
import { transcribeAndStructureRefusal, transcribeAndStructureMemo, StructuredNote } from './aiAdapter';
import { PlanPanel, PlanState, requestPlan } from './PlanPanel';
import type { PipelineResult } from '../agent/types';

export interface HandItem { res: string[]; title: string; note: string; kind: 'handoff' | 'flag' | 'memo'; to?: string }

interface Props {
  tasks: Task[]; setTasks: (f: (t: Task[]) => Task[]) => void;
  notes: Note[]; read: boolean; setRead: (b: boolean) => void;
  hand: HandItem[]; setHand: (f: (h: HandItem[]) => HandItem[]) => void;
  approved: boolean; setApproved: (b: boolean) => void;
  toast: (m: string) => void;
  staffId: string; onAcceptPlan: (r: PipelineResult) => void;
}

type Modal =
  | { kind: 'refuse'; id: string }
  | { kind: 'advice'; id: string }
  | { kind: 'hand'; id: string }
  | { kind: 'flag'; id: string }
  | { kind: 'lift'; id: string }
  | null;

const short = (t: Task) => t.title.split(' —')[0];

export function CareTeamView(p: Props) {
  const [tab, setTab] = useState<'tasks' | 'memo' | 'hand' | 'res'>('tasks');
  const [openId, setOpenId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [plan, setPlan] = useState<PlanState | null>(null);
  const T = (id: string) => p.tasks.find((t) => t.id === id)!;
  const update = (id: string, patch: Partial<Task>) => p.setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const me = STAFF[p.staffId];
  const flagTo = me.role === 'PSW' ? 'Maria S., RPN' : `${staffShort('s4')}, charge nurse`;

  const mine = p.tasks.filter((t) => t.assignee === p.staffId);
  const open = mine.filter((t) => t.status === 'open').sort((a, b) => Number(!!b.overdue) - Number(!!a.overdue));
  const closed = mine.filter((t) => t.status !== 'open');
  const overdue = open.filter((t) => t.overdue).length;

  const askPlan = (t: Task, attempts: number, reason: string | null, note: string) => {
    setPlan({ id: t.id, status: 'loading' });
    const tasks = p.tasks.map((x) => (x.id === t.id ? { ...x, attempts } : x));
    requestPlan(t, attempts, reason, note, tasks)
      .then((result) => setPlan((cur) => (cur?.id === t.id ? { id: t.id, status: 'ready', result } : cur)))
      .catch(() => setPlan((cur) => (cur?.id === t.id ? { id: t.id, status: 'error' } : cur)));
  };

  const acceptPlan = (r: PipelineResult) => {
    p.onAcceptPlan(r);
    setPlan(null);
    if (r.handoff) return setModal({ kind: 'hand', id: r.handoff.taskId });
    const moved = r.changes.find((c) => c.taskId === r.taskId);
    setModal(null);
    p.toast(moved ? `Plan applied · ${T(r.taskId).title} at ${moved.to.time.replace(/^0/, '')} with ${staffShort(moved.to.assignee)}` : 'Plan applied');
  };

  const done = (id: string, who?: string) => {
    update(id, { status: 'done', overdue: false, doneWith: who });
    setOpenId(null); setModal(null);
    p.toast(`✓ ${short(T(id))} done${who ? ' with ' + who : ''}`);
  };

  return (
    <div id="care">
      <div className="top">
        <div className="hdr">
          <div><h1>{me.name}</h1><div className="sub">{me.role} · {SHIFT.unit} · {SHIFT.label}</div></div>
          <div className="prog">
            <div className="row"><b>{closed.length} of {mine.length} done</b><span>{overdue ? `${overdue} overdue` : 'Nothing overdue'}</span></div>
            <div className="bar"><i style={{ width: `${mine.length ? (closed.length / mine.length) * 100 : 0}%` }} /></div>
            <div className="row" style={{ marginTop: 6, fontSize: 13, color: '#555' }}><span>Now {SHIFT.now}</span><span>{SHIFT.left}</span></div>
          </div>
        </div>
        <div className="logo">CareShift<span style={{ fontSize: 36 }}>♡</span></div>
      </div>

      {tab === 'tasks' && (
        <>
          <div className="main">
            <div className="listwrap"><div className="list">
              {open.map((t) => {
                const isOpen = openId === t.id || t.overdue;
                return (
                  <div key={t.id} className={`task ${t.overdue ? 'over' : ''}`}>
                    <div className="circ" />
                    <div className="body" onClick={() => setOpenId(openId === t.id ? null : t.id)}>
                      <div className="t">{t.overdue && <b>Overdue: </b>}{t.title}</div>
                      <div className="m">
                        {resLabel(t.res)}{t.place ? ` · ${t.place}` : ''}
                        {t.tags?.map((g) => <span key={g.text} className={`tag ${g.kind}`}>{g.text}</span>)}
                      </div>
                      {isOpen && (
                        <div className="acts" onClick={(e) => e.stopPropagation()}>
                          <button className="btn pri" onClick={() => (needsSecondStaff(t) ? setModal({ kind: 'lift', id: t.id }) : done(t.id))}>✓ Done</button>
                          <button className="btn" onClick={() => setModal({ kind: 'refuse', id: t.id })}>Resident refused</button>
                          {!isMedication(t) && <button className="btn" onClick={() => setModal({ kind: 'hand', id: t.id })}>Hand off</button>}
                          <button className="btn" onClick={() => setModal({ kind: 'flag', id: t.id })}>⚑ Flag to nurse</button>
                        </div>
                      )}
                    </div>
                    <div className="time">{t.overdue ? 'due ' : ''}{t.due}</div>
                  </div>
                );
              })}
              <div className="donel">✓ {closed.length} closed — {closed.map((t) => `${short(t)} (${resLabel(t.res).split(' ·')[0]}${t.status === 'handed' ? ', handed off' : t.status === 'flagged' ? ', flagged' : ''})`).join(', ')}</div>
            </div></div>
            <div className="side">
              <h2>From last shift</h2>
              <div className="who">Night shift · Joanne P., RPN · 6:58 am</div>
              {p.notes.map((n, i) => (
                <div key={i} className="note"><b>Rm {RESIDENTS[n.res].room} · {RESIDENTS[n.res].name}</b>{n.text}<div className="src">{n.src}</div></div>
              ))}
              <button className="btn" onClick={() => { p.setRead(true); p.toast('Notes marked as read'); }}>{p.read ? `✓ Read at ${SHIFT.now}` : 'Got it — mark as read'}</button>
            </div>
          </div>
          <div className="tip"><span style={{ fontSize: 30 }}>🐻</span><div className="bubble">Can't finish something? Tap <b>Hand off</b> — it moves to the next shift's list with your note.</div></div>
        </>
      )}

      {tab === 'memo' && <MemoTab onSave={(res, text) => { p.setHand((h) => [...h, { res: [res], title: '', note: text, kind: 'memo' }]); p.toast('Saved — added to shift handoff'); }} />}

      {tab === 'hand' && (
        <div className="page">
          <h2>Shift handoff</h2>
          <p className="sm">Going to: Evening shift · Tom B., PSW · 3 pm. Review before sending.</p>
          {p.hand.length === 0 && <p className="sm">Nothing to hand off yet. Items appear here when you tap Hand off, flag something, or save a voice memo.</p>}
          {p.hand.map((x, i) => (
            <div key={i} className="note" style={{ background: '#f7f5f0' }}>
              <b>{resLabel(x.res)}{x.title ? ` — ${x.title}` : ''}</b>
              {x.kind === 'flag' ? `Flagged to ${x.to ?? 'Maria S., RPN'}: ${x.note}` : x.note}
              <div className="src">{x.kind === 'handoff' ? 'Handed off · due on evening shift' : x.kind === 'memo' ? 'Voice memo, reviewed by you' : 'Flag'}</div>
            </div>
          ))}
          {p.approved && <p className="sm">✓ Sent to Tom B. at shift change.</p>}
          <div className="foot"><button className="btn pri" onClick={() => { if (!p.hand.length) return p.toast('Nothing to send yet'); p.setApproved(true); p.toast('Handoff sent to Tom B.'); }}>Review done — send to next shift</button></div>
        </div>
      )}

      {tab === 'res' && (
        <div className="page">
          <h2>Residents</h2>
          {Object.values(RESIDENTS).map((r) => (
            <div key={r.id} className="row2"><div><b>Rm {r.room} · {r.name}</b><div className="sm">{r.info}</div></div></div>
          ))}
          <p className="sm" style={{ marginTop: 12 }}>Tasks come from each resident's care plan and are set up by the charge nurse.</p>
        </div>
      )}

      <div className="nav">
        {([['tasks', '☰ Tasks'], ['memo', '🎙 Voice memo'], ['hand', '⇄ Shift handoff'], ['res', '👥 Residents']] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {modal && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="sheet">
            {modal.kind === 'lift' && (
              <>
                <h3>Who helped with the lift?</h3>
                <p className="sm">This is a 2-person lift. Pick the second staff member.</p>
                <div className="chips">{['Daniel O., PSW', 'Maria S., RPN'].map((n) => <button key={n} className="chip" onClick={() => done(modal.id, n)}>{n}</button>)}</div>
                <div className="foot"><button className="btn ghost" onClick={() => setModal(null)}>Cancel</button></div>
              </>
            )}
            {modal.kind === 'refuse' && (
              <RefuseSheet task={T(modal.id)} onCancel={() => setModal(null)} onSave={(note, reason, typed) => {
                const t = T(modal.id); const attempts = (t.attempts ?? 0) + 1;
                update(t.id, { attempts, lastNote: note, tags: t.tags?.length ? [{ kind: 'g', text: attempts >= 2 ? `Refused ${attempts}× today` : 'Refused 1×' }] : t.tags });
                setModal({ kind: 'advice', id: t.id });
                askPlan(t, attempts, reason, typed);
              }} />
            )}
            {modal.kind === 'advice' && (() => {
              const t = T(modal.id); const med = isMedication(t);
              const a = med ? adviseOnMedRefusal(t.attempts ?? 1, true, RESIDENTS[t.res[0]].name) : adviseOnRefusal(t.priority, t.attempts ?? 1, RESIDENTS[t.res[0]].name);
              const pl = plan?.id === t.id ? plan : null;
              return (
                <>
                  <h3>Refusal saved</h3><div className="sm">{t.title} · {resLabel(t.res)}</div>
                  <div className="rule"><b>{a.title}</b> {a.detail}{a.suggestion === 'hand_off' && <><br /><br /><b>Suggested:</b> hand off to evening shift (Tom B., PSW) with your note.</>}</div>
                  {pl?.status === 'loading' && <p className="sm">Building a suggested plan for the rest of the shift…</p>}
                  {pl?.status === 'error' && <p className="sm">Couldn't build a plan, use the options below.</p>}
                  {pl?.status === 'ready' ? (
                    <PlanPanel result={pl.result} tasks={p.tasks} onAccept={() => acceptPlan(pl.result)} onDismiss={() => setPlan({ id: t.id, status: 'dismissed' })} />
                  ) : (
                    <div className="foot">
                      <button className="btn ghost" onClick={() => { if (med) { setModal(null); return p.toast('Kept on your list'); } update(t.id, { due: '12:30' }); setModal(null); p.toast('Kept on your list — moved to 12:30'); }}>Keep on my list</button>
                      <button className={`btn ${a.suggestion === 'flag_nurse' || a.suggestion === 'escalate_charge_nurse' ? 'pri' : ''}`} onClick={() => setModal({ kind: 'flag', id: t.id })}>⚑ Flag to nurse</button>
                      {!med && <button className={`btn ${a.suggestion === 'hand_off' ? 'pri' : ''}`} onClick={() => setModal({ kind: 'hand', id: t.id })}>Hand off</button>}
                    </div>
                  )}
                </>
              );
            })()}
            {(modal.kind === 'hand' || modal.kind === 'flag') && (
              <SendSheet task={T(modal.id)} kind={modal.kind} flagTo={flagTo} onCancel={() => setModal(null)} onSend={(note) => {
                const t = T(modal.id);
                update(t.id, { status: modal.kind === 'hand' ? 'handed' : 'flagged', overdue: false });
                p.setHand((h) => [...h, { res: t.res, title: short(t), note: note || (modal.kind === 'hand' ? 'No note' : 'Please check'), kind: modal.kind === 'hand' ? 'handoff' : 'flag', ...(modal.kind === 'flag' ? { to: flagTo } : {}) }]);
                setOpenId(null); setModal(null);
                p.toast(modal.kind === 'hand' ? "Moved to evening shift's list with your note" : `${flagTo.split(',')[0]} has been notified`);
              }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Fields({ n }: { n: StructuredNote }) {
  return (
    <div className="fields">
      <div className="sm" style={{ display: 'block' }}>Transcript: "{n.transcript}"</div>
      {n.fields.map((f) => <div key={f.label}><span>{f.label}</span>{f.value ? <b>{f.value}</b> : <span className="unk">unknown (not said)</span>}</div>)}
      <div className="sm" style={{ display: 'block' }}>Sample transcript — AI not connected yet. Edit the note below before saving.</div>
    </div>
  );
}

function RefuseSheet({ task, onCancel, onSave }: { task: Task; onCancel: () => void; onSave: (note: string, reason: string | null, typed: string) => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [rec, setRec] = useState(false);
  const [n, setN] = useState<StructuredNote | null>(null);
  const [text, setText] = useState('');
  const mic = async () => {
    if (!rec) return setRec(true);
    setRec(false);
    const s = await transcribeAndStructureRefusal(task.title);
    setN(s); setText(s.editableText);
  };
  return (
    <>
      <h3>Resident refused</h3><div className="sm">{task.title} · {resLabel(task.res)}</div>
      <p style={{ margin: '14px 0 4px', fontWeight: 600 }}>What happened? (optional)</p>
      <div className="chips">{['Said they were cold', 'Too tired', 'Not now / later', 'Upset or agitated', 'Asleep', 'Other'].map((c) => (
        <button key={c} className={`chip ${reason === c ? 'on' : ''}`} onClick={() => setReason(c)}>{c}</button>))}</div>
      <div className="mic"><button className={rec ? 'rec' : ''} onClick={mic}>{rec ? '■' : '🎙'}</button><span className="sm">{rec ? 'Listening… tap to stop' : n ? 'Heard you — check it below' : 'Or tap to say it'}</span></div>
      {n && <Fields n={n} />}
      <textarea rows={2} placeholder="Or type a note" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="foot"><button className="btn ghost" onClick={onCancel}>Cancel</button><button className="btn pri" onClick={() => onSave(text || reason || 'No reason given', reason, text)}>Save refusal</button></div>
    </>
  );
}

function SendSheet({ task, kind, flagTo, onCancel, onSend }: { task: Task; kind: 'hand' | 'flag'; flagTo: string; onCancel: () => void; onSend: (n: string) => void }) {
  const [text, setText] = useState(kind === 'hand' && task.lastNote ? `Refused at 6 am and 10:45 am. ${task.lastNote}` : task.lastNote ?? '');
  return (
    <>
      <h3>{kind === 'hand' ? 'Hand off to next shift' : 'Flag to nurse'}</h3><div className="sm">{task.title} · {resLabel(task.res)}</div>
      {kind === 'hand' && task.priority === 'essential' && (
        <div className="rule" style={{ borderColor: 'var(--red)', background: '#fbeeee' }}><b>Heads up:</b> this is an essential task. Handing off means it waits until 3 pm. Consider flagging the nurse instead.</div>
      )}
      <p style={{ margin: '14px 0 4px', fontWeight: 600 }}>Goes to: {kind === 'hand' ? 'Evening shift · Tom B., PSW' : `${flagTo} (on shift now)`}</p>
      <textarea rows={3} value={text} placeholder={kind === 'flag' ? 'What does the nurse need to know?' : ''} onChange={(e) => setText(e.target.value)} />
      <div className="foot"><button className="btn ghost" onClick={onCancel}>Cancel</button><button className="btn pri" onClick={() => onSend(text)}>{kind === 'hand' ? 'Hand off' : 'Send flag'}</button></div>
    </>
  );
}

function MemoTab({ onSave }: { onSave: (res: string, text: string) => void }) {
  const [res, setRes] = useState(Object.keys(RESIDENTS)[0]);
  const [rec, setRec] = useState(false);
  const [n, setN] = useState<StructuredNote | null>(null);
  const [text, setText] = useState('');
  const mic = async () => {
    if (!rec) return setRec(true);
    setRec(false);
    const s = await transcribeAndStructureMemo(resLabel([res]));
    setN(s); setText(s.editableText);
  };
  return (
    <div className="page">
      <h2>Voice memo</h2>
      <p className="sm">Record a note about any resident. You review it before it's saved.</p>
      <select value={res} onChange={(e) => setRes(e.target.value)}>
        {Object.values(RESIDENTS).map((r) => <option key={r.id} value={r.id}>Rm {r.room} · {r.name}</option>)}
      </select>
      <div className="mic"><button className={rec ? 'rec' : ''} onClick={mic}>{rec ? '■' : '🎙'}</button><span className="sm">{rec ? 'Listening… tap to stop' : n ? 'Check it before saving' : 'Tap to record'}</span></div>
      {n && (
        <>
          <Fields n={n} />
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="foot"><button className="btn ghost" onClick={() => setN(null)}>Discard</button><button className="btn pri" onClick={() => { onSave(res, text); setN(null); }}>Save note</button></div>
        </>
      )}
    </div>
  );
}
