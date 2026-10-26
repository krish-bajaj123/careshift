import React from 'react';
import { useCareShift } from '../logic/careShiftStore';
import {
  Sun,
  Music,
  Trees,
  Pill,
  Clock,
  HeartHandshake,
  CheckCircle2,
} from 'lucide-react';

export const ResidentPane: React.FC = () => {
  const {
    residents,
    activeResidentId,
    setActiveResidentId,
    submitResidentRequest,
    triggerHelp,
  } = useCareShift();

  const activeResident = residents.find((r) => r.id === activeResidentId) || residents[0];

  // Care worker photo for Priya (warm smiling nurse / care worker in scrubs)
  const priyaPhoto =
    'https://images.unsplash.com/photo-1594824813637-28564858908f?auto=format&fit=crop&w=256&q=80';

  const handleMusicClick = () => {
    submitResidentRequest(activeResident.id, {
      id: 'choice_music',
      label: 'Music group',
      requestType: 'activity_music',
      details: 'Music with Morgan in Activity Lounge',
    });
  };

  const handleGardenClick = () => {
    submitResidentRequest(activeResident.id, {
      id: 'choice_garden',
      label: 'Garden walk',
      requestType: 'activity_garden',
      details: 'Garden walk with Morgan in Courtyard',
    });
  };

  const handlePillsReadyClick = () => {
    submitResidentRequest(activeResident.id, {
      id: 'choice_pills_ready',
      label: "I'm ready for my pills",
      requestType: 'pills_ready',
      details: 'Ready now with RN Sam',
    });
  };

  const handlePillsNotNowClick = () => {
    submitResidentRequest(activeResident.id, {
      id: 'choice_pills_not_now',
      label: 'Not now',
      requestType: 'pills_not_now',
      details: 'Requests safe retry later inside window',
    });
  };

  const handleHelpClick = () => {
    triggerHelp(activeResident.id);
  };

  return (
    <div className="flex flex-col h-full bg-[#fbf9f5] text-slate-900 overflow-y-auto font-sans select-none">
      {/* Discreet resident switcher bar for unit testing */}
      <div className="bg-[#f3ede4] border-b border-[#e7ded1] px-5 py-2 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Bedside Tablet:
          </span>
          <select
            value={activeResidentId}
            onChange={(e) => setActiveResidentId(e.target.value)}
            className="text-xs font-bold bg-white text-slate-800 border border-[#d8cbbe] rounded-lg px-3 py-1 shadow-2xs cursor-pointer"
          >
            {residents.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.room})
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Dementia-friendly interface · Wall-calendar style · No test-like elements
        </span>
      </div>

      <div className="p-6 sm:p-8 max-w-2xl mx-auto w-full flex-1 flex flex-col justify-between space-y-6 sm:space-y-7">
        {/* ========================================================================= */}
        {/* 1. TOP: Date in very large type with simple sun illustration and "Morning" */}
        {/* ========================================================================= */}
        <div className="border-b border-[#ebdcca] pb-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-slate-900 tracking-tight leading-none">
                Tuesday, October 27
              </h1>
              <p className="text-lg font-bold text-slate-600 mt-2">
                Good morning, {activeResident.firstName}
              </p>
            </div>

            {/* Sun illustration with the word "Morning" */}
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#f4ebe1] border border-[#e5d8cb] shrink-0">
              <div className="w-10 h-10 rounded-full bg-[#fde68a] flex items-center justify-center text-amber-600 shadow-2xs">
                <Sun className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-slate-800 tracking-wide">
                Morning
              </span>
            </div>
          </div>
        </div>

        {/* Live Answer Banner from Nurse Sam if resident submitted a choice */}
        {activeResident.currentResponseStatus && (
          <div
            className={`rounded-3xl p-5 sm:p-6 border-2 shadow-sm transition-all flex items-center gap-5 ${
              activeResident.currentResponseStatus.type === 'accepted'
                ? 'bg-[#eaf4ea] border-[#bad8b9] text-emerald-950'
                : activeResident.currentResponseStatus.type === 'pending'
                ? 'bg-[#fef7ea] border-[#f4dbad] text-amber-950 animate-pulse-slow'
                : 'bg-[#eef4f9] border-[#c8ddec] text-slate-900'
            }`}
          >
            {activeResident.currentResponseStatus.message.includes('Priya') ? (
              <img
                src={priyaPhoto}
                alt="Priya"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white shadow-xs shrink-0"
              />
            ) : activeResident.currentResponseStatus.type === 'accepted' ? (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#c5e4c4] text-emerald-800 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>
            ) : activeResident.currentResponseStatus.type === 'pending' ? (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#fce8c5] text-amber-800 flex items-center justify-center shrink-0">
                <Clock className="w-10 h-10 stroke-[2.5] animate-spin" />
              </div>
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#d5e6f5] text-indigo-800 flex items-center justify-center shrink-0">
                <HeartHandshake className="w-10 h-10 stroke-[2.5]" />
              </div>
            )}

            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
                Nurse Sam
              </span>
              <p className="text-xl sm:text-2xl font-black leading-snug">
                {activeResident.currentResponseStatus.message}
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. LARGE "NEXT" CARD: Care worker photo and "Shower with Priya after lunch" */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-[#e7ded1] shadow-sm flex items-center gap-5 sm:gap-6">
          <img
            src={activeResident.id === 'res_leon' ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80' : priyaPhoto}
            alt={activeResident.preferredStaff}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-[#e7ded1] shadow-2xs shrink-0"
          />
          <div>
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
              Next
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-snug">
              {activeResident.id === 'res_leon'
                ? 'Repositioning with Jordan at 10:00'
                : 'Shower with Priya after lunch'}
            </h2>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. "What would you like?" - ONLY SHOWN IF AUTONOMY ALLOWS ACTIVITIES      */}
        {/*    (Leon sees no choices; Kamala allowed pills only)                       */}
        {/* ========================================================================= */}
        {activeResident.allowedChoices.includes('activities') ? (
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-3">
              What would you like?
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Picture Button 1: Music group */}
              <button
                onClick={handleMusicClick}
                className="p-5 sm:p-6 rounded-3xl bg-[#eef4f9] hover:bg-[#e4eff8] active:bg-[#d8e8f5] border-2 border-[#d3e3f0] shadow-sm transition active:scale-[0.98] flex items-center gap-4 text-left cursor-pointer group"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#d5e6f5] text-indigo-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Music className="w-8 h-8 stroke-[2.2]" />
                </div>
                <span className="text-2xl sm:text-[26px] font-black text-slate-900 leading-tight">
                  Music group
                </span>
              </button>

              {/* Picture Button 2: Garden walk */}
              <button
                onClick={handleGardenClick}
                className="p-5 sm:p-6 rounded-3xl bg-[#edf4ec] hover:bg-[#e2ede0] active:bg-[#d7e7d5] border-2 border-[#d0e2ce] shadow-sm transition active:scale-[0.98] flex items-center gap-4 text-left cursor-pointer group"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#d7e8d4] text-emerald-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Trees className="w-8 h-8 stroke-[2.2]" />
                </div>
                <span className="text-2xl sm:text-[26px] font-black text-slate-900 leading-tight">
                  Garden walk
                </span>
              </button>
            </div>
          </div>
        ) : activeResident.allowedChoices.length === 0 ? (
          <div className="bg-white/90 rounded-3xl p-6 border-2 border-[#e7ded1] text-center">
            <p className="text-xl font-bold text-slate-800">
              Everything is taken care of for you today.
            </p>
            <p className="text-base font-medium text-slate-500 mt-1">
              Your care team is following your calm morning schedule.
            </p>
          </div>
        ) : null}

        {/* ========================================================================= */}
        {/* 4. A SEPARATE ROW: "I'm ready for my pills" and "Not now"                 */}
        {/*    (Only shown when resident's autonomy allows 'pills')                   */}
        {/* ========================================================================= */}
        {activeResident.allowedChoices.includes('pills') && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={handlePillsReadyClick}
                className="py-4 px-5 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300 shadow-2xs transition active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer text-center"
              >
                <Pill className="w-6 h-6 text-teal-700 shrink-0" />
                <span className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  I'm ready for my pills
                </span>
              </button>

              <button
                onClick={handlePillsNotNowClick}
                className="py-4 px-5 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 border-2 border-slate-300 shadow-2xs transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-center"
              >
                <Clock className="w-6 h-6 text-slate-500 shrink-0" />
                <span className="text-xl sm:text-2xl font-extrabold text-slate-700">
                  Not now
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. BOTTOM RIGHT, ALWAYS VISIBLE: "I need help" in warm coral              */}
        {/* ========================================================================= */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleHelpClick}
            className="w-full sm:w-auto px-8 sm:px-10 py-5 rounded-3xl bg-[#fb7185] hover:bg-[#f43f5e] active:bg-[#e11d48] text-white font-black text-2xl sm:text-3xl shadow-lg border-2 border-[#f43f5e] transition active:scale-[0.98] flex items-center justify-center gap-3.5 cursor-pointer"
          >
            <HeartHandshake className="w-8 h-8 stroke-[2.5]" />
            <span>I need help</span>
          </button>
        </div>
      </div>
    </div>
  );
};
