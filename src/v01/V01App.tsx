import React, { useState } from 'react';
import './v01.css';
import { initialTasks, initialNotes, Task } from './data';
import { CareTeamView, HandItem } from './CareTeamView';
import { FamilyPortal, Visit } from './FamilyPortal';

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

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2600); };
  const reset = () => { setTasks(initialTasks()); setRead(false); setHand([]); setApproved(false); setVisits(START_VISITS); setKey((k) => k + 1); toast('Demo reset'); };

  return (
    <div className="v01" style={{ background: view === 'fam' ? '#e9e5de' : '#f4f1ec' }}>
      <div className="demo">Demo view:
        <button className={view === 'care' ? 'on' : ''} onClick={() => setView('care')}>Care team (tablet)</button>
        <button className={view === 'fam' ? 'on' : ''} onClick={() => setView('fam')}>Family (phone)</button>
        <button onClick={reset}>Reset demo</button>
        <button onClick={onLegacy} title="Old v0.0 nurse console">v0.0 console</button>
      </div>
      {view === 'care'
        ? <CareTeamView key={key} tasks={tasks} setTasks={setTasks} notes={notes} read={read} setRead={setRead} hand={hand} setHand={setHand} approved={approved} setApproved={setApproved} toast={toast} />
        : <FamilyPortal key={key} visits={visits} setVisits={setVisits} toast={toast} />}
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
