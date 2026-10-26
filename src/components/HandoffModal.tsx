import React, { useState, useEffect } from 'react';
import { useCareShift } from '../logic/careShiftStore';
import { buildShiftSnapshot } from '../logic/rulesEngine';
import { ShiftSnapshot } from '../types';
import {
  X,
  FileText,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  List,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react';

interface HandoffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HandoffModal: React.FC<HandoffModalProps> = ({ isOpen, onClose }) => {
  const { tasks, residents, proposals, simulatedTime, confirmedProgressNotes } = useCareShift();

  const [snapshot, setSnapshot] = useState<ShiftSnapshot | null>(null);
  const [geminiText, setGeminiText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'narrative' | 'facts'>('narrative');

  useEffect(() => {
    if (isOpen) {
      const snap = buildShiftSnapshot(tasks, residents, proposals, simulatedTime, confirmedProgressNotes);
      setSnapshot(snap);
      generateHandoffSummary(snap);
    }
  }, [isOpen, confirmedProgressNotes]);

  const generateHandoffSummary = async (snap: ShiftSnapshot) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/handoff/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: snap }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      setGeminiText(data.text);
      setViewMode('narrative');
    } catch (err: any) {
      console.warn('Gemini handoff generation failed, falling back to structured list:', err);
      setError(err?.message || 'Using structured facts fallback');
      setViewMode('facts'); // Graceful fallback to structured plain list as required!
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const textToCopy =
      viewMode === 'narrative' && geminiText
        ? geminiText
        : JSON.stringify(snapshot, null, 2);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !snapshot) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/30 flex items-center justify-center text-indigo-300 border border-indigo-400/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">End of Shift Handoff Summary</h3>
                <span className="text-xs bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded font-mono">
                  {simulatedTime} Snapshot
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Unit 2B Dementia Care · RN Sam to Incoming Charge RN & Team
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Switcher Bar */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('narrative')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
                viewMode === 'narrative'
                  ? 'bg-white text-indigo-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Wording via Gemini (No facts added)
            </button>

            <button
              onClick={() => setViewMode('facts')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
                viewMode === 'facts'
                  ? 'bg-white text-indigo-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5 text-indigo-600" />
              Structured Facts List (Deterministic)
            </button>
          </div>

          <button
            onClick={() => generateHandoffSummary(snapshot)}
            disabled={loading}
            className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                Synthesizing shift facts with Gemini...
              </p>
              <p className="text-xs text-slate-400">
                Instructed to include every fact, use first names only, and add nothing speculative.
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-between">
              <span>{error} — Showing exact structured facts list below.</span>
              <span className="font-semibold text-amber-800">Plain list fallback active</span>
            </div>
          )}

          {/* Mode 1: Narrative worded by Gemini */}
          {!loading && viewMode === 'narrative' && geminiText && (
            <div className="prose prose-sm max-w-none text-slate-800 bg-slate-50 p-5 rounded-xl border border-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
              {geminiText}
            </div>
          )}

          {/* Mode 2: Deterministic Structured Plain Facts List */}
          {!loading && (viewMode === 'facts' || (!geminiText && !loading)) && (
            <div className="space-y-4">
              {/* Shift Stats Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="text-xs text-slate-500 block">Completed Tasks</span>
                  <span className="text-xl font-bold text-emerald-600">
                    {snapshot.completedTasksCount} / {snapshot.totalTasksCount}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="text-xs text-slate-500 block">Outstanding</span>
                  <span className="text-xl font-bold text-amber-600">
                    {snapshot.outstandingTasks.length}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="text-xs text-slate-500 block">Escalations</span>
                  <span className="text-xl font-bold text-rose-600">
                    {snapshot.escalations.length}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="text-xs text-slate-500 block">Flagged Patterns</span>
                  <span className="text-xl font-bold text-purple-600">
                    {snapshot.flaggedPatterns.length}
                  </span>
                </div>
              </div>

              {/* 1. Escalations */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Clinical Escalations ({snapshot.escalations.length})
                </h4>
                {snapshot.escalations.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No clinical escalations during this shift.</p>
                ) : (
                  <ul className="space-y-2">
                    {snapshot.escalations.map((esc, i) => (
                      <li key={i} className="text-xs p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-900">
                        <div className="font-bold flex items-center justify-between">
                          <span>{esc.resident} — {esc.title}</span>
                          <span className="font-mono text-[11px]">{esc.time}</span>
                        </div>
                        <p className="mt-0.5 text-rose-800">{esc.reason}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-rose-950">Escalated to: {esc.escalateTo}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 2. Outstanding Tasks & Safe Re-plans */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Outstanding Tasks with Reasons ({snapshot.outstandingTasks.length})
                </h4>
                <div className="space-y-2">
                  {snapshot.outstandingTasks.map((task, i) => (
                    <div key={i} className="text-xs p-2.5 rounded bg-slate-50 border border-slate-200 flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900">
                          {task.resident}: {task.title}
                        </span>
                        <p className="text-slate-600 mt-0.5">
                          Scheduled: {task.scheduledTime} (Window: {task.earliest}–{task.latest}) · Status: <span className="font-semibold text-slate-800">{task.status}</span>
                        </p>
                        <p className="text-slate-500 italic mt-0.5">Reason / State: {task.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Confirmed Clinical Progress Notes (Confirmed by Nurse Sam only) */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-teal-700" />
                    Confirmed Voice Progress Notes ({snapshot.confirmedProgressNotes?.length || 0})
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Unconfirmed notes never reach handoff
                  </span>
                </div>

                {!snapshot.confirmedProgressNotes || snapshot.confirmedProgressNotes.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                    No clinical progress notes confirmed during this shift. Unconfirmed voice drafts are strictly excluded from shift handoff.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {snapshot.confirmedProgressNotes.map((note) => (
                      <div
                        key={note.id}
                        className="text-xs p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 text-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between border-b border-teal-200/80 pb-1.5">
                          <span className="font-bold text-teal-950 text-sm">
                            {note.residentName} ({note.room})
                          </span>
                          <span className="font-mono text-[11px] text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                            Confirmed at {note.confirmedAt} by {note.nurse}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="bg-white p-2 rounded border border-teal-100">
                            <span className="font-bold text-slate-800 block text-[11px]">Cognition:</span>
                            <span className="text-slate-700">{note.cognition}</span>
                          </div>
                          <div className="bg-white p-2 rounded border border-teal-100">
                            <span className="font-bold text-slate-800 block text-[11px]">Intake:</span>
                            <span className="text-slate-700">{note.intake}</span>
                          </div>
                          <div className="bg-white p-2 rounded border border-teal-100">
                            <span className="font-bold text-slate-800 block text-[11px]">Mood:</span>
                            <span className="text-slate-700">{note.mood}</span>
                          </div>
                          <div className="bg-white p-2 rounded border border-teal-100">
                            <span className="font-bold text-slate-800 block text-[11px]">Mobility:</span>
                            <span className="text-slate-700">{note.mobility}</span>
                          </div>
                        </div>

                        {note.other && note.other !== 'None' && (
                          <div className="bg-white p-2 rounded border border-teal-100 text-[11px]">
                            <span className="font-bold text-slate-800">Other: </span>
                            <span className="text-slate-700">{note.other}</span>
                          </div>
                        )}

                        {note.rawTranscript && (
                          <details className="text-[11px] text-slate-500 pt-1">
                            <summary className="cursor-pointer font-semibold hover:text-slate-700">
                              View raw spoken transcript
                            </summary>
                            <p className="mt-1 p-2 bg-white rounded border border-slate-200 italic">
                              "{note.rawTranscript}"
                            </p>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. 7-Day Trend Analyses & Deterministic Follow-ups */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-700" />
                    7-Day Deterministic Trend Analyses & Follow-ups
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Deterministic Code Engine
                  </span>
                </div>

                <div className="space-y-2">
                  {snapshot.trendAnalyses && snapshot.trendAnalyses.length > 0 ? (
                    snapshot.trendAnalyses.map((t) => (
                      <div
                        key={t.residentId}
                        className={`text-xs p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          t.urgentDeliriumAlert
                            ? 'bg-rose-50 border-rose-300 text-rose-950'
                            : t.proposedFollowUp
                            ? 'bg-amber-50/50 border-amber-200 text-slate-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-bold flex items-center gap-2">
                            <span>{t.residentName} ({t.room})</span>
                            {t.urgentDeliriumAlert && (
                              <span className="bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded text-[10px] uppercase font-black">
                                Urgent: 24h spike (+{t.confusionDelta24h})
                              </span>
                            )}
                            {t.fallingMealIntake && (
                              <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                Meal drop (-{t.mealDropPercent}%)
                              </span>
                            )}
                            {t.moreRefusals && (
                              <span className="bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                Refusals (+{t.refusalIncrease})
                              </span>
                            )}
                            {t.fewerRequests && (
                              <span className="bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                Requests drop (-{t.requestDrop})
                              </span>
                            )}
                          </div>

                          {t.proposedFollowUp ? (
                            <p className="mt-1 text-slate-800 text-[11px]">
                              <strong>Follow-up proposed:</strong> {t.proposedFollowUp.title} — {t.proposedFollowUp.reason}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-slate-500 text-[11px]">
                              7-day trajectory within baseline expectations.
                            </p>
                          )}
                        </div>

                        {t.proposedFollowUp && (
                          <div className="shrink-0 text-right">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                              {t.proposedFollowUp.escalateTo}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No trend data available.</p>
                  )}
                </div>
              </div>

              {/* 5. Flagged Care Patterns */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-800 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-purple-600" />
                  Flagged 5-Day Refusal Patterns ({snapshot.flaggedPatterns.length})
                </h4>
                {snapshot.flaggedPatterns.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No refusal patterns triggered.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {snapshot.flaggedPatterns.map((pat, i) => (
                      <li key={i} className="text-xs p-2 rounded bg-purple-50 text-purple-900 border border-purple-200 font-medium">
                        {pat}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 6. Watch-for Items */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-slate-500" />
                  "Watch For" Items & Resident Care Tips
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {snapshot.watchForItems.map((item, i) => (
                    <div key={i} className="text-xs p-2.5 rounded bg-slate-50 border border-slate-200">
                      <span className="font-bold text-slate-800">{item.resident}:</span>{' '}
                      <span className="text-slate-600">{item.tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-mono">
            {snapshot.totalTasksCount} total tasks logged across shift
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition"
          >
            Close Handoff
          </button>
        </div>
      </div>
    </div>
  );
};
