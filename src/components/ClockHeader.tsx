import React from 'react';
import { useCareShift } from '../logic/careShiftStore';
import { Clock, RotateCcw, FastForward, Play, ShieldAlert } from 'lucide-react';
import { timeToMinutes } from '../logic/rulesEngine';

interface ClockHeaderProps {
  onOpenHandoff: () => void;
  onOpenAudit: () => void;
  viewLayout?: 'nurseTablet' | 'residentTablet' | 'split';
  onChangeLayout?: (layout: 'nurseTablet' | 'residentTablet' | 'split') => void;
}

export const ClockHeader: React.FC<ClockHeaderProps> = ({
  onOpenHandoff,
  onOpenAudit,
  viewLayout = 'nurseTablet',
  onChangeLayout,
}) => {
  const { simulatedTime, advanceClock, resetSimulation, urgentAlerts, proposals } = useCareShift();

  // Shift calculation: 07:00 (420 min) to 15:00 (900 min) = 480 mins total
  const currentMins = timeToMinutes(simulatedTime);
  const shiftStartMins = 7 * 60;
  const shiftEndMins = 15 * 60;
  const elapsed = Math.max(0, Math.min(shiftEndMins - shiftStartMins, currentMins - shiftStartMins));
  const progressPercent = Math.round((elapsed / 480) * 100);

  const pendingApprovalsCount = proposals.filter((p) => p.status === 'pending').length;
  const activeAlertsCount = urgentAlerts.filter((a) => !a.resolved).length;

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Shift Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center font-bold text-white text-base shadow">
              CS
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg tracking-tight text-white leading-none">
                  CareShift
                </h1>
                <span className="text-xs font-semibold text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800/80">
                  Unit 3 East · Day shift
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Staff on Duty: <strong className="text-slate-200">Sam, RN</strong> (Lead Nurse)
              </p>
            </div>
          </div>
        </div>

        {/* Center: Simulated Clock Display & Progress */}
        <div className="flex items-center gap-3 bg-slate-800/90 px-3.5 py-1.5 rounded-lg border border-slate-700 shadow-inner">
          <Clock className="w-5 h-5 text-teal-400 animate-pulse" />
          <div className="text-center">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Simulated:</span>
              <span className="font-mono text-xl font-bold text-teal-300 tracking-wider">
                {simulatedTime}
              </span>
            </div>
            <div className="w-28 bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
              <div
                className="bg-teal-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-400 hidden md:inline">
            {progressPercent}% shift
          </span>
        </div>

        {/* Right: Clock Advancement Controls & Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => advanceClock(15)}
              className="px-2.5 py-1 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 rounded transition flex items-center gap-1 active:scale-95"
              title="Advance simulated time by 15 minutes"
            >
              <Play className="w-3.5 h-3.5 text-teal-400" />
              +15m
            </button>
            <div className="w-px h-4 bg-slate-700 my-auto" />
            <button
              onClick={() => advanceClock(60)}
              className="px-2.5 py-1 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 rounded transition flex items-center gap-1 active:scale-95"
              title="Advance simulated time by 1 hour"
            >
              <FastForward className="w-3.5 h-3.5 text-teal-400" />
              +1h
            </button>
            <div className="w-px h-4 bg-slate-700 my-auto" />
            <button
              onClick={resetSimulation}
              className="px-2 py-1 text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-slate-700/80 rounded transition flex items-center gap-1 active:scale-95"
              title="Reset simulation to initial state"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          {/* View Mode Switcher (Nurse 4:3 vs Resident 4:3 vs Split) */}
          {onChangeLayout && (
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs font-semibold">
              <button
                onClick={() => onChangeLayout('nurseTablet')}
                className={`px-2.5 py-1 rounded transition ${
                  viewLayout === 'nurseTablet'
                    ? 'bg-teal-600 text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Nurse (4:3)
              </button>
              <button
                onClick={() => onChangeLayout('residentTablet')}
                className={`px-2.5 py-1 rounded transition ${
                  viewLayout === 'residentTablet'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Resident (4:3)
              </button>
              <button
                onClick={() => onChangeLayout('split')}
                className={`px-2.5 py-1 rounded transition ${
                  viewLayout === 'split'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Split
              </button>
            </div>
          )}

          {/* End Shift Handoff Trigger */}
          <button
            onClick={onOpenHandoff}
            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg shadow transition flex items-center gap-1.5"
          >
            End Shift
          </button>

          {/* Audit Log Trigger */}
          <button
            onClick={onOpenAudit}
            className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
          >
            Audit Log
          </button>
        </div>
      </div>
    </header>
  );
};
