import React from 'react';
import { useCareShift } from '../logic/careShiftStore';
import { AlertTriangle, CheckCircle2, Navigation } from 'lucide-react';

export const UrgentAlertBanner: React.FC = () => {
  const { urgentAlerts, acknowledgeAlert, resolveAlert } = useCareShift();

  const activeAlerts = urgentAlerts.filter((a) => !a.resolved);
  if (activeAlerts.length === 0) return null;

  return (
    <div className="bg-rose-600 text-white border-b-2 border-rose-700 shadow-lg px-4 py-3 animate-pulse-slow">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-yellow-300 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wider uppercase bg-black/30 px-2 py-0.5 rounded text-yellow-200">
                Urgent Assistance Requested
              </span>
              <span className="text-xs text-rose-100 font-mono">Bypassed Approvals</span>
            </div>
            <p className="text-sm font-semibold mt-0.5">
              {activeAlerts.map((a) => `${a.residentName} (${a.room}) at ${a.time}`).join(' · ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeAlerts.map((alert) => (
            <div key={alert.id} className="flex items-center gap-2">
              {!alert.acknowledged ? (
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="px-3 py-1.5 text-xs font-bold bg-white text-rose-700 hover:bg-yellow-50 rounded-lg shadow-sm transition flex items-center gap-1.5 active:scale-95"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Acknowledge (On My Way)
                </button>
              ) : (
                <span className="text-xs bg-white/20 px-2.5 py-1 rounded text-yellow-100 font-medium">
                  Nurse Sam Responding
                </span>
              )}
              <button
                onClick={() => resolveAlert(alert.id)}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-900/60 hover:bg-rose-900 border border-rose-400/40 text-white rounded-lg transition flex items-center gap-1.5 active:scale-95"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Resolve / Done
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
