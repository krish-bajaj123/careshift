import React from 'react';
import { useCareShift } from '../logic/careShiftStore';
import { computeResidentTrends } from '../logic/rulesEngine';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileCheck,
  X,
  Stethoscope,
  Pill,
  Users,
  Calendar,
} from 'lucide-react';

interface TrendsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TrendsModal: React.FC<TrendsModalProps> = ({ isOpen, onClose }) => {
  const { residents, proposals, approveProposal, declineProposal } = useCareShift();

  if (!isOpen) return null;

  // Plain TypeScript deterministic trend calculation (No LLM)
  const trends = computeResidentTrends(residents);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-white">
                  7-Day Resident Trends & Clinical Follow-ups
                </h3>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                  Deterministic Code Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Calculated strictly in plain TypeScript over 7 days of seeded history · Zero LLM hallucination
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Urgent Delirium Callout if triggered */}
        {trends.some((t) => t.urgentDeliriumAlert) && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-rose-950 text-xs font-bold">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 animate-bounce" />
              <span>
                URGENT CLINICAL ALERT: Sudden confusion spike detected in 24 hours — possible delirium or infection, consider assessment.
              </span>
            </div>
            <span className="text-[11px] uppercase tracking-wider bg-rose-200 text-rose-900 font-extrabold px-2 py-0.5 rounded">
              High Priority
            </span>
          </div>
        )}

        {/* Content List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 gap-5">
            {trends.map((item) => {
              const resident = residents.find((r) => r.id === item.residentId);
              const history = resident?.sevenDayHistory || [];

              // Find matching proposal in state store to reflect approved/declined status
              const matchingProposal = proposals.find(
                (p) => p.residentId === item.residentId && p.type === 'trend_followup'
              );

              return (
                <div
                  key={item.residentId}
                  className={`p-5 rounded-2xl border transition ${
                    item.urgentDeliriumAlert
                      ? 'border-rose-300 bg-rose-50/40 shadow-xs'
                      : item.proposedFollowUp
                      ? 'border-slate-200 bg-white shadow-2xs'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                    {/* Resident Info & Main Trend Flag */}
                    <div className="flex items-center gap-3.5">
                      {resident?.avatarUrl ? (
                        <img
                          src={resident.avatarUrl}
                          alt={item.residentName}
                          className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center shrink-0">
                          {item.residentName.charAt(0)}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-base text-slate-900">
                            {item.residentName}
                          </h4>
                          <span className="text-xs text-slate-500 font-medium">
                            {item.room}
                          </span>
                        </div>

                        {/* Trend Status Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {item.urgentDeliriumAlert && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3 text-rose-600" />
                              Acute 24h Confusion: +{item.confusionDelta24h} ({item.urgentDeliriumAlert})
                            </span>
                          )}

                          {item.fallingMealIntake && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <TrendingDown className="w-3 h-3 text-amber-700" />
                              Falling Meal Intake: {item.mealStart}% → {item.mealEnd}% (-{item.mealDropPercent}%)
                            </span>
                          )}

                          {item.moreRefusals && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3 text-purple-700" />
                              Rising Refusals: {item.refusalsStart} → {item.refusalsEnd} (+{item.refusalIncrease}/wk)
                            </span>
                          )}

                          {item.fewerRequests && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
                              <TrendingDown className="w-3 h-3 text-blue-700" />
                              Fewer Requests: {item.requestsStart} → {item.requestsEnd} (-{item.requestDrop}/wk)
                            </span>
                          )}

                          {!item.proposedFollowUp && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              Stable 7-Day Baseline
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 7-Day Mini Sparkline Visualization */}
                    <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">
                        7 Days:
                      </span>
                      {history.map((rec, idx) => {
                        // Highlight today (last bar)
                        const isToday = idx === history.length - 1;
                        let barHeight = 16;
                        let barColor = 'bg-slate-300';

                        if (item.risingConfusion) {
                          barHeight = Math.max(8, rec.confusionMentions * 8);
                          barColor = rec.confusionMentions > 0 ? (isToday ? 'bg-rose-600' : 'bg-rose-400') : 'bg-slate-200';
                        } else if (item.fallingMealIntake) {
                          barHeight = Math.max(8, Math.round((rec.mealIntakePercent / 100) * 28));
                          barColor = isToday ? 'bg-amber-600' : 'bg-amber-400';
                        } else if (item.moreRefusals) {
                          barHeight = Math.max(8, (rec.refusalCount + 1) * 7);
                          barColor = rec.refusalCount > 0 ? (isToday ? 'bg-purple-600' : 'bg-purple-400') : 'bg-slate-200';
                        } else if (item.fewerRequests) {
                          barHeight = Math.max(8, (rec.requestCount + 1) * 6);
                          barColor = isToday ? 'bg-blue-600' : 'bg-blue-400';
                        }

                        return (
                          <div key={idx} className="flex flex-col items-center gap-1">
                            <div className="h-7 w-3 flex items-end justify-center">
                              <div
                                style={{ height: `${barHeight}px` }}
                                className={`w-2.5 rounded-xs ${barColor}`}
                                title={`${rec.dateLabel}: Confusion ${rec.confusionMentions}, Meal ${rec.mealIntakePercent}%, Refusals ${rec.refusalCount}, Requests ${rec.requestCount}`}
                              />
                            </div>
                            <span className="text-[9px] text-slate-400 font-mono">
                              {rec.dateLabel.startsWith('Oct') ? rec.dateLabel.replace('Oct ', '') : 'T'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Proposed Follow-Up Section with Nurse Approval */}
                  {item.proposedFollowUp && (
                    <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 p-3 rounded-xl border">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          {item.proposedFollowUp.type === 'physician review' && (
                            <Stethoscope className="w-4 h-4 text-rose-600" />
                          )}
                          {item.proposedFollowUp.type === 'pharmacist medication review' && (
                            <Pill className="w-4 h-4 text-amber-600" />
                          )}
                          {item.proposedFollowUp.type === 'family care conference' && (
                            <Users className="w-4 h-4 text-blue-600" />
                          )}
                          <span>Proposed Follow-up: {item.proposedFollowUp.title}</span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            (Target: {item.proposedFollowUp.escalateTo})
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {item.proposedFollowUp.reason}
                        </p>
                      </div>

                      {/* Approval buttons or confirmed status */}
                      <div className="flex items-center gap-2 shrink-0">
                        {matchingProposal?.status === 'approved' ? (
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-extrabold flex items-center gap-1.5 border border-emerald-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            Approved & Routed
                          </span>
                        ) : matchingProposal?.status === 'declined' ? (
                          <span className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5">
                            <XCircle className="w-4 h-4 text-slate-500" />
                            Declined
                          </span>
                        ) : matchingProposal ? (
                          <>
                            <button
                              onClick={() => declineProposal(matchingProposal.id, 'Clinical follow-up deemed unneeded by RN Sam')}
                              className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-300 rounded-lg transition"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => approveProposal(matchingProposal.id)}
                              className="px-4 py-1.5 text-xs font-extrabold bg-teal-800 hover:bg-teal-900 text-white rounded-lg shadow-xs transition active:scale-95 flex items-center gap-1"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              Approve Follow-up
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Baseline review</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-mono">
            6 residents evaluated against 7-day seeded records
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition"
          >
            Close Trends
          </button>
        </div>
      </div>
    </div>
  );
};
