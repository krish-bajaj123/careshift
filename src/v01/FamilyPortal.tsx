import React, { useState } from 'react';
import { KAMALA_WEEK } from './data';

export interface Visit { when: string; place: string }

export function FamilyPortal({ visits, setVisits, toast }: { visits: Visit[]; setVisits: (f: (v: Visit[]) => Visit[]) => void; toast: (m: string) => void }) {
  const [tab, setTab] = useState<'week' | 'visits' | 'notes'>('week');
  const [log, setLog] = useState(false);
  const [booking, setBooking] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const next = visits[visits.length - 1];

  return (
    <div id="fam">
      <div className="fh"><div className="brand">♡ CareShift <span className="pill">Family</span></div><div>Hi, Anjali</div></div>

      {tab === 'week' && (
        <div className="fwrap">
          <div className="fcard"><div className="k">Mom's week</div><h2>Kamala Rao</h2>
            <div className="wk"><button onClick={() => toast("Earlier weeks aren't in this demo")}>‹</button>Mon Nov 2 – Sun Nov 8<button style={{ color: '#bbb' }}>›</button></div></div>
          {/* Recap text is pre-written for v0.1; Kirpa's LLM will draft it from the week's logs. */}
          <div className="sent"><div className="k">The week in a sentence</div>A good week. Mom was social and ate well. Her sleep was a bit restless midweek.</div>
          <h3>Mood this week</h3>
          <div className="dots">{KAMALA_WEEK.map((d) => <div key={d.day}><div className={`dot d-${d.mood}`} />{d.day}</div>)}</div>
          <div className="leg"><span>● Bright</span><span style={{ color: '#8a9555' }}>● Okay</span><span>○ Low</span></div>
          <h3>☆ What went well</h3>
          <div className="good"><b>Joined music hour three times</b>She sang along and asked for her favourite songs.</div>
          <div className="good"><b>Ate well most days</b>Finished most meals, especially lunch.</div>
          <div className="good"><b>Walked to the garden with help</b>On Tuesday and Thursday, with her walker.</div>
          <h3>♡ Where she needed more support</h3>
          <div className="sup"><b>Restless sleep on Tue and Wed</b><b style={{ display: 'inline', fontSize: 14 }}>What we're doing:</b> a quieter room at night and a warm drink before bed.</div>
          <div className="sup"><b>Drank less than usual on Wednesday</b><b style={{ display: 'inline', fontSize: 14 }}>What we're doing:</b> offering drinks more often. She was back on track by Thursday.</div>
          <button className="lnk" onClick={() => setLog(!log)}>See the day-by-day log</button>
          {log && (
            <div className="log">
              <div style={{ fontWeight: 700 }}><span /><span>Sleep · Meals (B/L/D eaten) · Fluids · Activities</span></div>
              {KAMALA_WEEK.map((d) => <div key={d.day}><b>{d.day}</b><span>{d.sleep} · {d.meals} · {d.fluids} · {d.activities}</span></div>)}
            </div>
          )}
          <div className="urg">📞 <span>Anything urgent, like a fall or a change in health, we call you right away. It never waits for the recap.</span></div>
          <div className="visit"><div className="k">Your next visit</div><div className="v">{next.when} · {next.place}</div><button onClick={() => setBooking(true)}>Book a visit →</button></div>
        </div>
      )}

      {tab === 'visits' && (
        <div className="fwrap"><h3>Visits</h3>
          {visits.map((v, i) => <div key={i} className="good"><b>{v.when}</b>{v.place}</div>)}
          <div className="visit"><button onClick={() => setBooking(true)}>Book a visit →</button></div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="fwrap"><h3>Notes</h3>
          <p className="sm">Send a short note to Mom's care team. They'll read it at the next shift change.</p>
          <textarea rows={3} value={draft} placeholder="e.g. She loves Lata Mangeshkar songs" onChange={(e) => setDraft(e.target.value)} />
          <div className="foot"><button className="btn pri" onClick={() => { if (!draft.trim()) return; setNotes([...notes, draft.trim()]); setDraft(''); toast('Note sent'); }}>Send note</button></div>
          {notes.map((n, i) => <div key={i} className="good">{n}<div className="sm">Sent · care team will see it at shift change</div></div>)}
        </div>
      )}

      <div className="fnav">
        {([['week', '⌂', 'This week'], ['visits', '▦', 'Visits'], ['notes', '▢', 'Notes']] as const).map(([k, i, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{i}<br />{l}</button>
        ))}
      </div>

      {booking && <BookSheet onCancel={() => setBooking(false)} onBook={(v) => { setVisits((vs) => [...vs, v]); setBooking(false); toast('Visit booked — the care team can see it'); }} />}
    </div>
  );
}

function BookSheet({ onCancel, onBook }: { onCancel: () => void; onBook: (v: Visit) => void }) {
  const [day, setDay] = useState('Thu Nov 12');
  const [time, setTime] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [err, setErr] = useState('');
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="sheet">
        <h3>Book a visit with Mom</h3><p className="sm">Visits are 1 hour. Staff will have Mom ready.</p>
        <p style={{ margin: '12px 0 4px', fontWeight: 600 }}>Day</p>
        <select value={day} onChange={(e) => setDay(e.target.value)}>{['Thu Nov 12', 'Fri Nov 13', 'Sat Nov 14', 'Sun Nov 15'].map((d) => <option key={d}>{d}</option>)}</select>
        <p style={{ margin: '12px 0 4px', fontWeight: 600 }}>Time</p>
        <div className="chips">{['10:00 am', '11:00 am', '2:00 pm', '3:00 pm', '4:00 pm'].map((t) => <button key={t} className={`chip ${time === t ? 'on' : ''}`} onClick={() => setTime(t)}>{t}</button>)}</div>
        <p style={{ margin: '4px 0 4px', fontWeight: 600 }}>Where</p>
        <div className="chips">{['Her room', 'Garden room', 'Family lounge'].map((t) => <button key={t} className={`chip ${place === t ? 'on' : ''}`} onClick={() => setPlace(t)}>{t}</button>)}</div>
        <p className="sm" style={{ color: 'var(--red)' }}>{err}</p>
        <div className="foot"><button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn pri" onClick={() => (!time || !place ? setErr('Pick a time and a place.') : onBook({ when: `${day}, ${time}`, place }))}>Confirm visit</button></div>
      </div>
    </div>
  );
}
