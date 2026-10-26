import React, { useState } from 'react';
import { useCareShift } from '../logic/careShiftStore';
import { CareTask, Proposal, Resident } from '../types';
import { timeToMinutes } from '../logic/rulesEngine';
import {
  Check,
  X,
  AlertTriangle,
  Clock,
  Sparkles,
  User,
  CheckCircle2,
  Moon,
  Frown,
  RotateCcw,
  ChevronRight,
  ShieldAlert,
  Mic,
  TrendingUp,
} from 'lucide-react';
import { DeclineReasonDialog } from './DeclineReasonDialog';
import { ResidentDetailModal } from './ResidentDetailModal';
import { VoiceNoteModal } from './VoiceNoteModal';
import { TrendsModal } from './TrendsModal';

interface NursePaneProps {
  onOpenHandoff: () => void;
  onOpenAudit: () => void;
}

export const NursePane: React.FC<NursePaneProps> = ({ onOpenHandoff, onOpenAudit }) => {
  const {
    simulatedTime,
    tasks,
    residents,
    proposals,
    flaggedPatterns,
    markTaskStatus,
    approveProposal,
    declineProposal,
    offerAlternativeProposal,
  } = useCareShift();

  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [declineTarget, setDeclineTarget] = useState<Proposal | null>(null);

  // New Voice Note & Trends modal states
  const [isVoiceNoteOpen, setIsVoiceNoteOpen] = useState<boolean>(false);
  const [voiceNoteTargetResId, setVoiceNoteTargetResId] = useState<string | undefined>(undefined);
  const [isTrendsOpen, setIsTrendsOpen] = useState<boolean>(false);
  const [proposalFilter, setProposalFilter] = useState<'all' | 'shift' | 'trends'>('all');

  const currentMins = timeToMinutes(simulatedTime);

  // Active or upcoming tasks due in the next 30 minutes
  const nowTasks = tasks
    .filter((task) => {
      if (task.status === 'done') return false;
      const taskMins = timeToMinutes(task.time);
      const isSoon = taskMins >= currentMins - 15 && taskMins <= currentMins + 45;
      const isMedActive =
        task.type === 'medication' &&
        currentMins >= timeToMinutes(task.earliest) &&
        currentMins <= timeToMinutes(task.latest);
      return isSoon || isMedActive;
    })
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  // Pending proposals awaiting Nurse Sam's decision
  const pendingProposals = proposals.filter((p) => p.status === 'pending');
  const shiftProposals = pendingProposals.filter((p) => p.type !== 'trend_followup');
  const trendProposals = pendingProposals.filter((p) => p.type === 'trend_followup');

  const displayedProposals =
    proposalFilter === 'shift'
      ? shiftProposals
      : proposalFilter === 'trends'
      ? trendProposals
      : pendingProposals;

  const handleDeclineClick = (proposal: Proposal) => {
    setDeclineTarget(proposal);
  };

  const confirmDecline = (reason: string) => {
    if (declineTarget) {
      declineProposal(declineTarget.id, reason);
      setDeclineTarget(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] text-slate-900 overflow-y-auto select-none font-sans">
      {/* ========================================================================= */}
      {/* 1. SLIM TOP BAR: "CareShift", "Unit 3 East · Day shift", "9:20", "Sam, RN" */}
      {/* ========================================================================= */}
      <header className="bg-white px-6 sm:px-8 py-3.5 border-b border-slate-200/90 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black tracking-tight text-slate-900">
            CareShift
          </span>
          <span className="text-slate-300 font-light">|</span>
          <span className="text-sm font-semibold text-slate-600">
            Unit 3 East · Day shift
          </span>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          {/* Quick Voice Note & 7-Day Trends Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setVoiceNoteTargetResId(undefined);
                setIsVoiceNoteOpen(true);
              }}
              className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Dictate or type progress note for any resident"
            >
              <Mic className="w-3.5 h-3.5 text-teal-300" />
              <span>Voice Note</span>
            </button>

            <button
              onClick={() => setIsTrendsOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer relative"
              title="View 7-day seeded trends and clinical recommendations"
            >
              <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
              <span>7-Day Trends</span>
              {/* Delirium indicator dot */}
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse absolute -top-0.5 -right-0.5" />
            </button>
          </div>

          <span className="font-mono text-2xl font-black text-slate-900 tracking-tight">
            {simulatedTime}
          </span>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-teal-800 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
              RN
            </div>
            <span className="text-sm font-bold text-slate-800">
              Sam, RN
            </span>
          </div>
        </div>
      </header>

      {/* Flagged Refusal Pattern Notice (if triggered) */}
      {flaggedPatterns.length > 0 && (
        <div className="bg-amber-50/90 border-b border-amber-200 px-6 sm:px-8 py-2 flex items-center justify-between text-xs font-semibold text-amber-950">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
            <span>{flaggedPatterns.join(' · ')}</span>
          </div>
          <span className="text-amber-800 font-normal">Deterministic pattern check</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-6 sm:p-8 space-y-7 max-w-6xl w-full mx-auto flex-1 flex flex-col justify-between">
        <div className="space-y-7">
          {/* ========================================================================= */}
          {/* 2. "NOW": THREE LARGE HORIZONTAL CARDS                                    */}
          {/* ========================================================================= */}
          <section>
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Now
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                Next 30 minutes
              </span>
            </div>

            {nowTasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-slate-500 text-sm shadow-2xs">
                No immediate tasks due in the next 30 minutes. All current actions complete.
              </div>
            ) : (
              <div className="space-y-3.5">
                {nowTasks.slice(0, 3).map((task) => {
                  const resident = residents.find((r) => r.id === task.residentId);
                  const isMed = task.type === 'medication';
                  const latestMins = timeToMinutes(task.latest);
                  const windowRemaining = latestMins - currentMins;

                  // Label: "Kamala K. · Morning meds"
                  const cardTitle = `${resident?.name || 'Resident'} · ${task.title}`;

                  // Window string e.g.: "Window closes 10:00 · 40 min"
                  const windowText = isMed
                    ? `Window closes ${task.latest} · ${
                        windowRemaining > 0 ? `${windowRemaining} min` : 'past window'
                      }`
                    : `Scheduled ${task.time} · with ${task.staff}`;

                  return (
                    <div
                      key={task.id}
                      className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {resident?.avatarUrl ? (
                            <img
                              src={resident.avatarUrl}
                              alt={resident.name}
                              className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-900 font-black text-base flex items-center justify-center shrink-0">
                              {resident?.firstName.charAt(0) || 'R'}
                            </div>
                          )}

                          <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug truncate">
                              {cardTitle}
                            </h3>
                            <p
                              className={`text-xs font-bold mt-0.5 ${
                                isMed ? 'text-amber-700' : 'text-slate-500'
                              }`}
                            >
                              {windowText}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons: "Done" (large filled) & smaller outlined: "Refused", "Asleep", "Agitated" */}
                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          <button
                            onClick={() => markTaskStatus(task.id, 'done')}
                            className="px-6 py-2.5 text-sm font-extrabold bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                          >
                            Done
                          </button>

                          <button
                            onClick={() => markTaskStatus(task.id, 'refused')}
                            className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-amber-800 bg-white hover:bg-amber-50 active:bg-amber-100 border border-slate-300 hover:border-amber-400 rounded-xl transition active:scale-95 cursor-pointer"
                          >
                            Refused
                          </button>

                          <button
                            onClick={() => markTaskStatus(task.id, 'asleep')}
                            className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-purple-800 bg-white hover:bg-purple-50 active:bg-purple-100 border border-slate-300 hover:border-purple-400 rounded-xl transition active:scale-95 cursor-pointer"
                          >
                            Asleep
                          </button>

                          <button
                            onClick={() => markTaskStatus(task.id, 'agitated')}
                            className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-rose-800 bg-white hover:bg-rose-50 active:bg-rose-100 border border-slate-300 hover:border-rose-400 rounded-xl transition active:scale-95 cursor-pointer"
                          >
                            Agitated
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* 3. "NEEDS YOUR APPROVAL": CARDS WITH FILTER TABS                          */}
          {/*    - Retry Kamala's meds at 9:45 with Priya — she accepts meds from Priya */}
          {/*    - Daniel would like his shower after lunch · Fits                      */}
          {/*    - Deterministic 7-day trend follow-up proposals                         */}
          {/* ========================================================================= */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Needs your approval
                </h2>
                {pendingProposals.length > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    {pendingProposals.length} awaiting
                  </span>
                )}
              </div>

              {/* Filter Tabs for Clean Clinical Navigation */}
              {pendingProposals.length > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200/80">
                  <button
                    onClick={() => setProposalFilter('all')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                      proposalFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    All ({pendingProposals.length})
                  </button>
                  <button
                    onClick={() => setProposalFilter('shift')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                      proposalFilter === 'shift'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Shift Actions ({shiftProposals.length})
                  </button>
                  <button
                    onClick={() => setProposalFilter('trends')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                      proposalFilter === 'trends'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    7-Day Trends ({trendProposals.length})
                  </button>
                </div>
              )}
            </div>

            {displayedProposals.length === 0 ? (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 text-center text-slate-500 text-sm shadow-2xs">
                No items pending approval in this category.
              </div>
            ) : (
              <div className="space-y-3.5">
                {displayedProposals.map((prop) => {
                  const isDanielShower = prop.id === 'prop_seed_daniel_shower';
                  const isTrend = prop.type === 'trend_followup';

                  return (
                    <div
                      key={prop.id}
                      className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-2xs hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isTrend ? 'border-amber-200/90 bg-amber-50/20' : 'border-slate-200/90'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {isTrend && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3 text-amber-700" />
                              7-Day Trend Follow-up
                            </span>
                          )}
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                            {prop.title}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {prop.reason}
                        </p>
                      </div>

                      {/* Action buttons matching specifications */}
                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                        {isDanielShower ? (
                          <>
                            <button
                              onClick={() => offerAlternativeProposal(prop.id)}
                              className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition active:scale-95 cursor-pointer"
                            >
                              Offer other time
                            </button>
                            <button
                              onClick={() => approveProposal(prop.id)}
                              className="px-5 py-2 text-xs font-extrabold bg-teal-800 hover:bg-teal-900 text-white rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                            >
                              Accept
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleDeclineClick(prop)}
                              className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-300 rounded-xl transition active:scale-95 cursor-pointer"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => approveProposal(prop.id)}
                              className="px-5 py-2 text-xs font-extrabold bg-teal-800 hover:bg-teal-900 text-white rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                            >
                              Approve
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* 4. "MY RESIDENTS": SIX PHOTO TILES IN A 3×2 GRID                          */}
          {/*    - Kamala's tile has a small amber badge "3 of 5 refusals"             */}
          {/*    - Delirium alert & trend indicators for Samuel, Daniel, Teresa        */}
          {/* ========================================================================= */}
          <section>
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                My residents
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                Unit census: 6 · Tap to view schedule or dictate note
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {residents.map((resident) => {
                // One-line statuses specified in visual reference
                let statusLine = 'Care plan on schedule';
                if (resident.id === 'res_daniel') {
                  statusLine = 'Shower moved to 12:45';
                } else if (resident.id === 'res_kamala') {
                  statusLine = 'Morning meds pending';
                } else if (resident.id === 'res_leon') {
                  statusLine = 'Reposition planned 10:00';
                } else if (resident.id === 'res_pauline') {
                  statusLine = 'Meds planned 09:30';
                } else if (resident.id === 'res_samuel') {
                  statusLine = 'Diabetic checks on schedule';
                } else if (resident.id === 'res_teresa') {
                  statusLine = 'Resting in room 106';
                }

                const isKamala = resident.id === 'res_kamala';
                const isSamuel = resident.id === 'res_samuel';
                const isDaniel = resident.id === 'res_daniel';
                const isTeresa = resident.id === 'res_teresa';

                return (
                  <div
                    key={resident.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedResident(resident);
                      }
                    }}
                    onClick={() => setSelectedResident(resident)}
                    className="bg-white text-left p-4 rounded-2xl border border-slate-200/90 hover:border-teal-600 hover:shadow-sm transition active:scale-[0.98] group flex flex-col justify-between cursor-pointer relative focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-1"
                  >
                    <div className="flex items-center gap-3.5 mb-2.5">
                      {resident.avatarUrl ? (
                        <img
                          src={resident.avatarUrl}
                          alt={resident.name}
                          className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-800 font-bold flex items-center justify-center shrink-0">
                          {resident.firstName.charAt(0)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-extrabold text-base text-slate-900 group-hover:text-teal-800 transition truncate">
                            {resident.name}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVoiceNoteTargetResId(resident.id);
                              setIsVoiceNoteOpen(true);
                            }}
                            title={`Dictate voice note for ${resident.firstName}`}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-teal-100 hover:text-teal-900 text-slate-400 transition"
                          >
                            <Mic className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                          {statusLine}
                        </p>
                      </div>
                    </div>

                    {/* Resident Badges: Visual reference + 7-Day Trend flags */}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {/* Small amber badge "3 of 5 refusals" for Kamala (exact from image reference) */}
                      {isKamala && (
                        <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          3 of 5 refusals
                        </span>
                      )}

                      {/* Urgent Delirium Risk for Samuel (Acute 24h confusion spike) */}
                      {isSamuel && (
                        <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
                          🚨 Delirium Risk: 24h spike (+4)
                        </span>
                      )}

                      {/* Falling Meal Intake for Daniel */}
                      {isDaniel && (
                        <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                          📉 Meal intake: 85% → 40%
                        </span>
                      )}

                      {/* Fewer requests for Teresa */}
                      {isTeresa && (
                        <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200">
                          📉 Requests: 5 → 0/day
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ========================================================================= */}
        {/* 5. BOTTOM RIGHT: "End shift · Handoff summary" BUTTON                     */}
        {/* ========================================================================= */}
        <div className="pt-4 flex items-center justify-between border-t border-slate-200/80">
          <span className="text-xs text-slate-400">
            CareShift v0.0 · Long-Term Care Dementia Unit Assistant
          </span>

          <button
            onClick={onOpenHandoff}
            className="px-6 py-3 text-sm font-extrabold bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white rounded-2xl shadow-sm transition active:scale-95 cursor-pointer"
          >
            End shift · Handoff summary
          </button>
        </div>
      </div>

      {/* Decline Reason Modal */}
      <DeclineReasonDialog
        isOpen={!!declineTarget}
        proposalTitle={declineTarget?.title || ''}
        residentName={
          residents.find((r) => r.id === declineTarget?.residentId)?.name || 'Resident'
        }
        onSelectReason={confirmDecline}
        onCancel={() => setDeclineTarget(null)}
      />

      {/* Resident Full Day Schedule Modal */}
      <ResidentDetailModal
        resident={selectedResident}
        tasks={tasks}
        onClose={() => setSelectedResident(null)}
      />

      {/* Voice Progress Note Modal (Browser speech recognition + typed fallback + Gemini structuring) */}
      <VoiceNoteModal
        isOpen={isVoiceNoteOpen}
        onClose={() => setIsVoiceNoteOpen(false)}
        targetResidentId={voiceNoteTargetResId}
      />

      {/* 7-Day Deterministic Trends & Clinical Follow-ups Modal */}
      <TrendsModal
        isOpen={isTrendsOpen}
        onClose={() => setIsTrendsOpen(false)}
      />
    </div>
  );
};
