import React from 'react';
import { Resident, CareTask } from '../types';
import { X, User, HeartHandshake, Clock, CheckCircle2, AlertTriangle, Moon, Frown, Sparkles } from 'lucide-react';

interface ResidentDetailModalProps {
  resident: Resident | null;
  tasks: CareTask[];
  onClose: () => void;
}

export const ResidentDetailModal: React.FC<ResidentDetailModalProps> = ({ resident, tasks, onClose }) => {
  if (!resident) return null;

  const residentTasks = tasks
    .filter((t) => t.residentId === resident.id)
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-lg border border-teal-200">
              {resident.firstName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-lg">{resident.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                  {resident.room}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-medium capitalize">
                  {resident.stage}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Assigned PSW: <span className="font-semibold text-slate-700">{resident.assignedPsw}</span> · Responds best to:{' '}
                <span className="font-semibold text-teal-700">{resident.preferredStaff}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Care Tip Banner */}
          {resident.careTip && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Resident Care Guidance & Tip
                </h4>
                <p className="text-sm font-medium text-amber-900 mt-0.5">{resident.careTip}</p>
              </div>
            </div>
          )}

          {/* Autonomy Profile */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Bedside Autonomy Profile
            </h4>
            <div className="flex flex-wrap gap-2">
              {resident.allowedChoices.length === 0 ? (
                <span className="text-xs text-slate-500 italic">
                  No active choice options enabled (bedside tablet displays "What's Next" & Help only).
                </span>
              ) : (
                resident.allowedChoices.map((choice) => (
                  <span
                    key={choice}
                    className="text-xs px-3 py-1 bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 shadow-2xs capitalize"
                  >
                    ✓ {choice} Choice
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Today's Schedule */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
              <span>Today's Care Plan (Shift 07:00 – 15:00)</span>
              <span className="text-[11px] font-normal text-slate-400">{residentTasks.length} tasks scheduled</span>
            </h4>

            <div className="space-y-2.5">
              {residentTasks.map((task) => {
                const isMed = task.type === 'medication';
                return (
                  <div
                    key={task.id}
                    className={`p-3.5 rounded-xl border transition ${
                      task.status === 'done'
                        ? 'bg-slate-50/70 border-slate-200 opacity-80'
                        : task.status === 'escalated'
                        ? 'bg-rose-50 border-rose-300'
                        : task.status === 'refused'
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-white border-slate-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-sm text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {task.time}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">{task.title}</span>
                            <span className="text-xs text-slate-500">({task.durationMin}m)</span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>Assigned: <strong className="text-slate-700">{task.staff}</strong></span>
                            <span>·</span>
                            <span>
                              Window: {task.earliest} – {task.latest} {isMed ? '(±60m strict)' : task.movable ? '(movable)' : '(fixed)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {task.status === 'done' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Done
                          </span>
                        )}
                        {task.status === 'planned' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold">
                            <Clock className="w-3.5 h-3.5" /> Planned
                          </span>
                        )}
                        {task.status === 'refused' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">
                            <Frown className="w-3.5 h-3.5" /> Refused (Re-planning)
                          </span>
                        )}
                        {task.status === 'asleep' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-semibold">
                            <Moon className="w-3.5 h-3.5" /> Asleep
                          </span>
                        )}
                        {task.status === 'agitated' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" /> Agitated
                          </span>
                        )}
                        {task.status === 'escalated' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" /> Escalated to Alex
                          </span>
                        )}
                      </div>
                    </div>

                    {task.refusalReason && (
                      <p className="mt-2 text-xs font-medium text-amber-800 bg-amber-100/70 p-2 rounded-lg">
                        {task.refusalReason}
                      </p>
                    )}
                    {task.notes && (
                      <p className="mt-1.5 text-xs text-slate-600 italic">
                        Note: {task.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
