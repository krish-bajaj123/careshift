import React from 'react';
import { X, AlertCircle } from 'lucide-react';

interface DeclineReasonDialogProps {
  isOpen: boolean;
  proposalTitle: string;
  residentName: string;
  onSelectReason: (reason: string) => void;
  onCancel: () => void;
}

const DECLINE_REASONS = [
  'Staff busy with emergency / acute clinical care',
  'Clinical priority / RN medication assessment required',
  'Resident fatigued / requires quiet rest period',
  'Mealtime / dining room conflict',
  'Personal care already active with PSW',
];

export const DeclineReasonDialog: React.FC<DeclineReasonDialogProps> = ({
  isOpen,
  proposalTitle,
  residentName,
  onSelectReason,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <h3 className="font-bold text-slate-800 text-base">Select Reason for Declining</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-xs text-slate-600 mb-3">
            Declining <span className="font-semibold text-slate-800">{proposalTitle}</span> for{' '}
            <span className="font-semibold text-slate-800">{residentName}</span>. A plain, reassuring
            message with no dead ends will be shown to the resident.
          </p>

          <div className="space-y-2">
            {DECLINE_REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => onSelectReason(reason)}
                className="w-full text-left p-3 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300 border border-slate-200 rounded-lg transition active:scale-[0.99] flex items-center justify-between"
              >
                <span>{reason}</span>
                <span className="text-xs text-slate-400">Select</span>
              </button>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
