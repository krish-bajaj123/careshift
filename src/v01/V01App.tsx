import React, { useState } from 'react';
import './v01.css';
import { initialTasks, initialNotes, Task, STAFF } from './data';
import { CareTeamView, HandItem } from './CareTeamView';
import { FamilyPortal, Visit } from './FamilyPortal';
import type { PipelineResult } from '../agent/types';

const VIEW_AS = ['s1', 's3'];

const START_VISITS: Visit[] = [{ when: 'Tue Nov 10, 2:00 pm', place: 'Garden room' }];

/** CareShift v0.1: care team (tablet) + family portal (phone). No AI yet. */
export function V01App({ onLegacy }: { onLegacy: () => void }) {
  const [view, setView] = useState<'care' | 'fam'>(() => (location.hash === '#family' ? 'fam' : 'care'));
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [notes] = useState(initialNotes);
  const [read, setRead] = useState(false);
  const [hand, setHand] = useState<HandItem[]>([]);
  const [approved, setApproved] = useState(false);
  const [visits, setVisits] = useState<Visit[]>(START_VISITS);
  const [msg, setMsg] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const [viewAs, setViewAs] = useState('s1');

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2600); };
  const applyPlan = (r: PipelineResult) => {
    setTasks((ts) => ts.map((t) => {
      const c = r.changes.find((x) => x.taskId === t.id);
      if (!c) return t;
      const tags = [...(t.tags ?? []).filter((g) => g.text !== 'Re-planned'), { kind: 'y' as const, text: 'Re-planned' }];
      return { ...t, due: c.to.time.replace(/^0/, ''), assignee: c.to.assignee, secondAssignee: c.to.second, tags };
    }));
    const esc = r.escalation;
    const t = tasks.find((x) => x.id === r.taskId);
    if (esc && t) setHand((h) => [...h, { res: t.res, title: t.title.split(' —')[0], note: `${esc.logAsMissed ? 'Logged as missed. ' : ''}${esc.reason}`, kind: 'flag', to: esc.toName }]);
  };
  const reset = () => { setTasks(initialTasks()); setRead(false); setHand([]); setApproved(false); setVisits(START_VISITS); setKey((k) => k + 1); toast('Demo reset'); };

  return (
    <div className="v01" style={{ background: view === 'fam' ? '#e9e5de' : '#f4f1ec' }}>
      <div className="demo">Demo view:
        <button className={view === 'care' ? 'on' : ''} onClick={() => setView('care')}>Care team (tablet)</button>
        <button className={view === 'fam' ? 'on' : ''} onClick={() => setView('fam')}>Family (phone)</button>
        {view === 'care' && <>View as:{VIEW_AS.map((id) => <button key={id} className={viewAs === id ? 'on' : ''} onClick={() => setViewAs(id)}>{STAFF[id].name} ({STAFF[id].role})</button>)}</>}
        <button onClick={reset}>Reset demo</button>
        <button onClick={onLegacy} title="Old v0.0 nurse console">v0.0 console</button>
      </div>
      {view === 'care'
        ? <CareTeamView key={`${key}-${viewAs}`} staffId={viewAs} onAcceptPlan={applyPlan} tasks={tasks} setTasks={setTasks} notes={notes} read={read} setRead={setRead} hand={hand} setHand={setHand} approved={approved} setApproved={setApproved} toast={toast} />
        : <FamilyPortal key={key} visits={visits} setVisits={setVisits} toast={toast} />}
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
