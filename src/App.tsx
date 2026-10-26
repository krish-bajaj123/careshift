/**
 * CareShift v0.0 - Functional Foundation
 * Dementia Care Unit Assistant: Two-Pane Nurse & Resident Bedside Experience
 */

import React, { useState } from 'react';
import { CareShiftProvider, useCareShift } from './logic/careShiftStore';
import { DemoControlBar } from './components/DemoControlBar';
import { UrgentAlertBanner } from './components/UrgentAlertBanner';
import { NursePane } from './components/NursePane';
import { ResidentPane } from './components/ResidentPane';
import { HandoffModal } from './components/HandoffModal';
import { AuditLogDrawer } from './components/AuditLogDrawer';
import { Stethoscope, Tablet } from 'lucide-react';

function CareShiftApp() {
  const [isHandoffOpen, setIsHandoffOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'nurse' | 'resident'>('nurse');
  const [viewLayout, setViewLayout] = useState<'nurseTablet' | 'residentTablet' | 'split'>('split');

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans text-slate-800">
      {/* Unobtrusive Demo Controls Bar at Top */}
      <DemoControlBar
        viewLayout={viewLayout}
        onChangeLayout={(layout) => setViewLayout(layout)}
        onOpenHandoff={() => setIsHandoffOpen(true)}
        onOpenAudit={() => setIsAuditOpen(true)}
      />

      {/* Immediate Urgent Alert Banner (bypasses approvals) */}
      <UrgentAlertBanner />

      {/* Main Container */}
      {viewLayout === 'nurseTablet' ? (
        <main className="flex-1 max-w-[1280px] w-full mx-auto my-auto p-2 sm:p-4 flex items-center justify-center">
          <div className="w-full aspect-4/3 max-h-[92vh] bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-300 flex flex-col">
            <NursePane
              onOpenHandoff={() => setIsHandoffOpen(true)}
              onOpenAudit={() => setIsAuditOpen(true)}
            />
          </div>
        </main>
      ) : viewLayout === 'residentTablet' ? (
        <main className="flex-1 max-w-[1280px] w-full mx-auto my-auto p-2 sm:p-4 flex items-center justify-center">
          <div className="w-full aspect-4/3 max-h-[92vh] bg-[#fbf9f5] rounded-3xl shadow-2xl overflow-hidden border border-[#e2d5c5] flex flex-col">
            <ResidentPane />
          </div>
        </main>
      ) : (
        <>
          {/* Mobile Tab Switcher */}
          <div className="lg:hidden bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-center gap-2">
            <button
              onClick={() => setMobileTab('nurse')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                mobileTab === 'nurse'
                  ? 'bg-teal-600 text-white shadow'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>Nurse Sam (RN)</span>
            </button>

            <button
              onClick={() => setMobileTab('resident')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                mobileTab === 'resident'
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Tablet className="w-4 h-4" />
              <span>Bedside Tablet</span>
            </button>
          </div>

          {/* Main Two-Pane Split View */}
          <main className="flex-1 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-0 bg-white shadow-xl overflow-hidden">
            <div
              className={`lg:col-span-7 xl:col-span-7 h-full flex flex-col ${
                mobileTab === 'nurse' ? 'block' : 'hidden lg:flex'
              }`}
            >
              <NursePane
                onOpenHandoff={() => setIsHandoffOpen(true)}
                onOpenAudit={() => setIsAuditOpen(true)}
              />
            </div>
            <div
              className={`lg:col-span-5 xl:col-span-5 h-full flex flex-col border-t lg:border-t-0 lg:border-l border-slate-200 ${
                mobileTab === 'resident' ? 'block' : 'hidden lg:flex'
              }`}
            >
              <ResidentPane />
            </div>
          </main>
        </>
      )}

      {/* End Shift Handoff Modal */}
      <HandoffModal
        isOpen={isHandoffOpen}
        onClose={() => setIsHandoffOpen(false)}
      />

      {/* Append-Only Audit Log Drawer */}
      <AuditLogDrawer
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <CareShiftProvider>
      <CareShiftApp />
    </CareShiftProvider>
  );
}
