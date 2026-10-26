import React, { useState } from 'react';
import { useCareShift } from '../logic/careShiftStore';
import { AuditEvent } from '../types';
import { X, History, Filter, Download, ShieldCheck, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface AuditLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditLogDrawer: React.FC<AuditLogDrawerProps> = ({ isOpen, onClose }) => {
  const { auditEvents, simulatedTime } = useCareShift();
  const [filterType, setFilterType] = useState<string>('all');

  if (!isOpen) return null;

  const filteredEvents = auditEvents.filter((evt) => {
    if (filterType === 'all') return true;
    return evt.badgeType === filterType;
  });

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditEvents, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `careshift_audit_log_${simulatedTime.replace(':', '')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-end">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="font-bold text-base text-white">Append-Only Care Audit Log</h3>
              <p className="text-xs text-slate-400">
                Every event, proposal & decision with actor and timestamp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1 transition"
              title="Download audit JSON"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 font-medium mr-1">Filter:</span>
            {['all', 'alert', 'warning', 'success', 'info'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-2.5 py-0.5 rounded capitalize font-medium transition ${
                  filterType === f
                    ? 'bg-slate-800 text-white font-bold'
                    : 'bg-white text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <span className="text-slate-400 font-mono">
            {filteredEvents.length} events
          </span>
        </div>

        {/* Event List */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {filteredEvents.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">
              No audit records matching filter.
            </p>
          ) : (
            filteredEvents.map((evt) => {
              let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
              let Icon = Info;
              if (evt.badgeType === 'alert') {
                badgeColor = 'bg-rose-100 text-rose-800 border-rose-300';
                Icon = AlertCircle;
              } else if (evt.badgeType === 'warning') {
                badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
                Icon = AlertCircle;
              } else if (evt.badgeType === 'success') {
                badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                Icon = CheckCircle;
              }

              return (
                <div
                  key={evt.id}
                  className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-slate-800 text-teal-300 px-1.5 py-0.5 rounded">
                        {evt.simulatedTime}
                      </span>
                      <span className="font-bold text-xs text-slate-900">{evt.actor}</span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border capitalize flex items-center gap-1 ${badgeColor}`}
                    >
                      <Icon className="w-3 h-3" />
                      {evt.badgeType || 'info'}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-800 mt-1">{evt.action}</p>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{evt.details}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition"
          >
            Close Audit Log
          </button>
        </div>
      </div>
    </div>
  );
};
