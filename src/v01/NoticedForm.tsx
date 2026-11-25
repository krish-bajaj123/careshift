import React, { useState } from 'react';
import { NOTICE_CATEGORIES, NOTICE_SEE, Noticed, RESIDENTS, SHIFT } from './data';
import logoImg from './assets/careshift-logo.png';

type Draft = Omit<Noticed, 'id' | 'status' | 'received' | 'source'>;

/**
 * The digital "I Noticed" form staff reach by scanning the QR code on the unit.
 * Same six questions as the paper slip. Anyone on the unit can send one
 * (PSWs, housekeeping, dietary, recreation), no login needed in the demo.
 */
export function NoticedForm({ onSubmit }: { onSubmit: (n: Draft) => void }) {
  const [res, setRes] = useState('');
  const [category, setCategory] = useState('');
  const [detail, setDetail] = useState('');
  const [when, setWhen] = useState(SHIFT.now);
  const [where, setWhere] = useState('');
  const [see, setSee] = useState('Nurse');
  const [nurseNow, setNurseNow] = useState<boolean | null>(null);
  const [by, setBy] = useState('');
  const [sent, setSent] = useState(false);
  const ready = res && category && detail.trim() && nurseNow !== null;

  if (sent) {
    return (
      <div className="form-phone"><div className="page" style={{ textAlign: 'center' }}>
        <h2>Thanks, it's sent ✓</h2>
        <p>The charge nurse reviews I Noticed slips and forms at the mid-shift huddle and before handoff.</p>
        {nurseNow && <div className="rule" style={{ borderColor: 'var(--red)', background: '#fbeeee', textAlign: 'left' }}><b>You said a nurse is needed now.</b> If you haven't yet, tell a nurse in person right away. This form is only the written record.</div>}
        <button className="btn pri" onClick={() => { setSent(false); setRes(''); setCategory(''); setDetail(''); setWhere(''); setNurseNow(null); }}>Send another</button>
      </div></div>
    );
  }

  return (
    <div className="form-phone">
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <h2 style={{ margin: 0 }}>I Noticed</h2><img src={logoImg} alt="CareShift" style={{ width: 110 }} />
        </div>
        <p className="sm">Saw something small about a resident? Tell us in under a minute. Same questions as the paper slip.</p>

        <label className="q">1. Room and first name</label>
        <select value={res} onChange={(e) => setRes(e.target.value)}>
          <option value="">Choose a resident</option>
          {Object.values(RESIDENTS).map((r) => <option key={r.id} value={r.id}>Rm {r.room} · {r.name.split(' ')[0]}</option>)}
        </select>

        <label className="q">2. What did you notice?</label>
        <div className="chips">{NOTICE_CATEGORIES.map((c) => <button key={c} className={`chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>{c}</button>)}</div>

        <label className="q">3. What did you see or hear? (1–2 sentences)</label>
        <textarea rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="e.g. Only ate a few bites of lunch and pushed the plate away" />

        <label className="q">4. Time and place</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={when} onChange={(e) => setWhen(e.target.value)} style={{ width: 110 }} />
          <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="e.g. Dining room" style={{ flex: 1 }} />
        </div>

        <label className="q">5. Who should see this?</label>
        <div className="chips">{NOTICE_SEE.map((c) => <button key={c} className={`chip ${see === c ? 'on' : ''}`} onClick={() => setSee(c)}>{c}</button>)}</div>

        <label className="q">6. Does a nurse need to know right now?</label>
        <div className="chips">
          <button className={`chip ${nurseNow === true ? 'on' : ''}`} onClick={() => setNurseNow(true)}>Yes</button>
          <button className={`chip ${nurseNow === false ? 'on' : ''}`} onClick={() => setNurseNow(false)}>No</button>
        </div>
        {nurseNow && <div className="rule" style={{ borderColor: 'var(--red)', background: '#fbeeee' }}><b>Tell a nurse in person now.</b> Don't wait for the form. This is just the written record.</div>}

        <label className="q">Your first name and role (optional)</label>
        <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="e.g. Sam, housekeeping" />

        <div className="foot">
          <button className="btn pri" disabled={!ready} style={{ opacity: ready ? 1 : 0.5 }} onClick={() => {
            if (!ready) return;
            onSubmit({ res, category, detail: detail.trim(), when, where: where || 'Not given', see, nurseNow: !!nurseNow, by: by.trim() || 'Staff member' });
            setSent(true);
          }}>Send</button>
        </div>
      </div>
    </div>
  );
}
