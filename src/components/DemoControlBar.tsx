import React from 'react';
import { useCareShift } from '../logic/careShiftStore';
import { Play, FastForward, RotateCcw, Clock, History, Layout, Users } from 'lucide-react';

interface DemoControlBarProps {
  viewLayout: 'nurseTablet' | 'residentTablet' | 'split';
  onChangeLayout: (layout: 'nurseTablet' | 'residentTablet' | 'split') => void;
  onOpenAudit: () => void;
  onOpenHandoff: () => void;
}

export const DemoControlBar: React.FC<DemoControlBarProps> = ({
  viewLayout,
  onChangeLayout,
  onOpenAudit,
  onOpenHandoff,
}) => {
  const {
    simulatedTime,
    advanceClock,
    resetSimulation,
    residents,
    activeResidentId,
    setActiveResidentId,
    proposals,
    urgentAlerts,
  } = useCareShift();

  const pendingCount = proposals.filter((p) => p.status === 'pending').length;
  const activeAlerts = urgentAlerts.filter((a) => !a.resolved).length;

  return (
    <div className="bg-slate-950 text-slate-300 border-b border-slate-800 text-xs py-1.5 px-4 sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 shadow-md">
      {/* Left: Demo badge & Clock Controls */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
          Demo Controls
        </span>

        <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
          <Clock className="w-3.5 h-3.5 text-teal-400" />
          <span className="font-mono font-bold text-slate-100">{simulatedTime}</span>
        </div>

        <div className="flex items-center gap-0.5 bg-slate-900 rounded-md p-0.5 border border-slate-800">
          <button
            onClick={() => advanceClock(15)}
            className="px-2 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-95 flex items-center gap-1 font-medium"
            title="Advance simulated clock +15 min"
          >
            <Play className="w-2.5 h-2.5 text-teal-400" /> +15m
          </button>
          <button
            onClick={() => advanceClock(60)}
            className="px-2 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-95 flex items-center gap-1 font-medium"
            title="Advance simulated clock +1 hr"
          >
            <FastForward className="w-2.5 h-2.5 text-teal-400" /> +1h
          </button>
          <button
            onClick={resetSimulation}
            className="px-2 py-0.5 rounded text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition active:scale-95 flex items-center gap-1 font-medium"
            title="Reset simulation to initial state"
          >
            <RotateCcw className="w-2.5 h-2.5" /> Reset
          </button>
        </div>
      </div>

      {/* Center: Resident Tablet Selector (switches tablet view) */}
      <div className="flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-400 font-medium">Tablet Resident:</span>
        <select
          value={activeResidentId}
          onChange={(e) => setActiveResidentId(e.target.value)}
          className="bg-slate-900 text-slate-100 text-xs font-semibold rounded px-2 py-0.5 border border-slate-700 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-teal-500"
        >
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.room})
            </option>
          ))}
        </select>
      </div>

      {/* Right: Layout Switcher & Audit Log */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-slate-900 rounded-md p-0.5 border border-slate-800">
          <button
            onClick={() => onChangeLayout('nurseTablet')}
            className={`px-2.5 py-0.5 rounded font-medium transition ${
              viewLayout === 'nurseTablet'
                ? 'bg-teal-700 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Nurse Pane (Image 1)
          </button>
          <button
            onClick={() => onChangeLayout('residentTablet')}
            className={`px-2.5 py-0.5 rounded font-medium transition ${
              viewLayout === 'residentTablet'
                ? 'bg-amber-700 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Resident Pane (Image 2)
          </button>
          <button
            onClick={() => onChangeLayout('split')}
            className={`px-2.5 py-0.5 rounded font-medium transition ${
              viewLayout === 'split'
                ? 'bg-slate-700 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Side-by-Side Dual
          </button>
        </div>

        <button
          onClick={onOpenAudit}
          className="px-2.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition flex items-center gap-1 font-medium"
        >
          <History className="w-3 h-3 text-slate-400" /> Audit Log
        </button>

        {pendingCount > 0 && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {pendingCount} Pending
          </span>
        )}

        {activeAlerts > 0 && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
            Help Called!
          </span>
        )}
      </div>
    </div>
  );
};
