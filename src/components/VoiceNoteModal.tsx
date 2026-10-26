import React, { useState, useEffect, useRef } from 'react';
import { useCareShift } from '../logic/careShiftStore';
import { StructuredProgressNote } from '../types';
import {
  Mic,
  MicOff,
  Sparkles,
  Check,
  X,
  AlertCircle,
  Brain,
  Utensils,
  Smile,
  Activity,
  FileEdit,
  Trash2,
} from 'lucide-react';

interface VoiceNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetResidentId?: string;
}

export const VoiceNoteModal: React.FC<VoiceNoteModalProps> = ({
  isOpen,
  onClose,
  targetResidentId,
}) => {
  const { residents, simulatedTime, saveConfirmedProgressNote } = useCareShift();

  const [selectedResId, setSelectedResId] = useState<string>(
    targetResidentId || residents[0]?.id || 'res_samuel'
  );

  const [rawTranscript, setRawTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Structured fields (all editable)
  const [cognition, setCognition] = useState<string>('');
  const [intake, setIntake] = useState<string>('');
  const [mood, setMood] = useState<string>('');
  const [mobility, setMobility] = useState<string>('');
  const [other, setOther] = useState<string>('');

  const [isStructuring, setIsStructuring] = useState<boolean>(false);
  const [structuringError, setStructuringError] = useState<string | null>(null);
  const [confirmedSuccess, setConfirmedSuccess] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (targetResidentId) {
      setSelectedResId(targetResidentId);
    }
  }, [targetResidentId]);

  // Setup Web Speech API if available
  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setRawTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission blocked. You can type directly into the box.');
        } else {
          setSpeechError(`Voice input: ${event.error}. You can type directly.`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
    };
  }, []);

  // Reset local state when opened
  useEffect(() => {
    if (isOpen) {
      setRawTranscript('');
      setCognition('');
      setIntake('');
      setMood('');
      setMobility('');
      setOther('');
      setStructuringError(null);
      setSpeechError(null);
      setConfirmedSuccess(false);
    }
  }, [isOpen]);

  const toggleRecording = () => {
    if (!speechSupported || !recognitionRef.current) {
      setSpeechError('Browser speech recognition not supported in this view. Please type below.');
      return;
    }

    setSpeechError(null);
    if (isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err: any) {
        console.error('Failed to start speech recognition:', err);
        setSpeechError('Could not start microphone. You can type in the box below.');
        setIsRecording(false);
      }
    }
  };

  // Preset sample transcript for rapid clinical testing
  const loadPresetSample = (presetType: 'samuel' | 'daniel' | 'kamala') => {
    if (presetType === 'samuel') {
      setSelectedResId('res_samuel');
      setRawTranscript(
        "Samuel was noticeably more disoriented this morning, didn't recognize Jordan at 8:15 breakfast, ate 45% of his oatmeal, mildly restless when redirected to room 105, unsteady shuffling gait, requested Dr. Patel review."
      );
    } else if (presetType === 'daniel') {
      setSelectedResId('res_daniel');
      setRawTranscript(
        'Daniel was pleasant and calm throughout the morning, ate 40% of his breakfast, drank tea, requested his shower with Priya after lunch, ambulating well with walker.'
      );
    } else {
      setSelectedResId('res_kamala');
      setRawTranscript(
        'Kamala refused morning routine pills at 9:00 with Sam, drank full cup of cranberry juice, smiling and pleasant mood, walking steadily with 1-person assist.'
      );
    }
  };

  // Call Gemini to structure the note
  const handleStructureNote = async () => {
    if (!rawTranscript.trim()) return;
    setIsStructuring(true);
    setStructuringError(null);

    try {
      const res = await fetch('/api/progress-note/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: rawTranscript }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      const struct = data.structured || data.note;
      if (struct) {
        setCognition(struct.cognition || '');
        setIntake(struct.intake || '');
        setMood(struct.mood || '');
        setMobility(struct.mobility || '');
        setOther(struct.other || '');
      }
    } catch (err: any) {
      console.warn('Gemini structuring failed, using local extraction fallback:', err);
      // Deterministic fallback regex extraction
      setStructuringError('Gemini API busy; used local clinical keyword structuring.');
      fallbackStructure(rawTranscript);
    } finally {
      setIsStructuring(false);
    }
  };

  const fallbackStructure = (text: string) => {
    const lower = text.toLowerCase();
    setCognition(
      lower.includes('confus') || lower.includes('disorient') || lower.includes('recogniz')
        ? text
        : 'Baseline alert and calm'
    );
    setIntake(
      lower.includes('ate') || lower.includes('%') || lower.includes('breakfast') || lower.includes('drank')
        ? text
        : 'Intake as charted by dietary'
    );
    setMood(
      lower.includes('agitat') || lower.includes('restless') || lower.includes('pleasant') || lower.includes('calm')
        ? text
        : 'Pleasant, cooperative'
    );
    setMobility(
      lower.includes('gait') || lower.includes('walk') || lower.includes('unsteady') || lower.includes('assist')
        ? text
        : 'Independent with mobility device'
    );
    setOther('Logged via local clinical fallback');
  };

  // Confirm and Save Note
  const handleConfirmSave = () => {
    const resident = residents.find((r) => r.id === selectedResId);
    if (!resident) return;

    // Build the confirmed note
    const note: StructuredProgressNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      residentId: resident.id,
      residentName: resident.name,
      room: resident.room,
      rawTranscript: rawTranscript.trim(),
      cognition: cognition.trim() || 'Baseline',
      intake: intake.trim() || 'As charted',
      mood: mood.trim() || 'Pleasant',
      mobility: mobility.trim() || 'Baseline',
      other: other.trim() || 'None',
      confirmedAt: simulatedTime,
      nurse: 'Sam, RN',
    };

    saveConfirmedProgressNote(note);
    setConfirmedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  // Discard / Cancel: strictly ensures unconfirmed notes never reach the handoff
  const handleDiscard = () => {
    // Clear everything locally
    setRawTranscript('');
    setCognition('');
    setIntake('');
    setMood('');
    setMobility('');
    setOther('');
    onClose();
  };

  if (!isOpen) return null;

  const currentResident = residents.find((r) => r.id === selectedResId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center justify-center">
              <Mic className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-white">Voice Progress Note</h3>
                <span className="text-xs font-mono bg-teal-900 text-teal-200 px-2 py-0.5 rounded">
                  {simulatedTime}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Dictate or type raw progress note · Structured with Gemini · Confirmed by Sam, RN
              </p>
            </div>
          </div>

          <button
            onClick={handleDiscard}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resident Selector Strip */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Resident:</span>
            <select
              value={selectedResId}
              onChange={(e) => setSelectedResId(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-700"
            >
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.room}) — {r.stage}
                </option>
              ))}
            </select>
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium mr-1">Quick Test:</span>
            <button
              onClick={() => loadPresetSample('samuel')}
              className="px-2 py-1 rounded bg-slate-200/80 hover:bg-slate-300 text-slate-800 font-semibold text-[11px] transition"
            >
              Samuel (Confusion)
            </button>
            <button
              onClick={() => loadPresetSample('daniel')}
              className="px-2 py-1 rounded bg-slate-200/80 hover:bg-slate-300 text-slate-800 font-semibold text-[11px] transition"
            >
              Daniel (Shower/Meals)
            </button>
            <button
              onClick={() => loadPresetSample('kamala')}
              className="px-2 py-1 rounded bg-slate-200/80 hover:bg-slate-300 text-slate-800 font-semibold text-[11px] transition"
            >
              Kamala (Pills Refusal)
            </button>
          </div>
        </div>

        {/* Body Grid: Side-by-Side Raw Transcript & Structured Fields */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Raw Transcript & Voice Input (5 cols) */}
          <div className="md:col-span-5 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <FileEdit className="w-4 h-4 text-slate-500" />
                Raw Transcript
              </span>
              <span className="text-[11px] text-slate-400">
                {rawTranscript.length} chars
              </span>
            </div>

            {/* Mic Button & Status */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={toggleRecording}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs ${
                  isRecording
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-teal-800 hover:bg-teal-900 text-white'
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>Stop Recording (Listening…)</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Start Voice Dictation</span>
                  </>
                )}
              </button>
            </div>

            {speechError && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px]">
                {speechError}
              </div>
            )}

            {/* Textarea for Raw Transcript */}
            <div className="relative flex-1 min-h-[160px]">
              <textarea
                value={rawTranscript}
                onChange={(e) => setRawTranscript(e.target.value)}
                placeholder="Microphone voice transcript will appear here, or type your clinical note directly as fallback..."
                className="w-full h-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700 resize-none font-sans leading-relaxed"
                rows={8}
              />
            </div>

            {/* Action to trigger structure */}
            <button
              onClick={handleStructureNote}
              disabled={isStructuring || !rawTranscript.trim()}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 ${isStructuring ? 'animate-spin' : ''}`} />
              <span>
                {isStructuring ? 'Extracting clinical categories…' : 'Structure Note with Gemini'}
              </span>
            </button>

            {structuringError && (
              <p className="text-[11px] text-amber-700">{structuringError}</p>
            )}

            <p className="text-[11px] text-slate-400 leading-snug">
              Sends raw transcript to Gemini server endpoint to extract: cognition, intake, mood, mobility, other.
            </p>
          </div>

          {/* RIGHT COLUMN: Structured Editable Note (7 cols) */}
          <div className="md:col-span-7 flex flex-col space-y-3 bg-slate-50/60 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Structured Note (Editable Before Confirming)
              </span>
              <span className="text-[11px] font-semibold text-teal-800">
                {currentResident?.name}
              </span>
            </div>

            {/* 1. Cognition */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mb-1">
                <Brain className="w-3.5 h-3.5 text-indigo-600" />
                Cognition
              </label>
              <input
                type="text"
                value={cognition}
                onChange={(e) => setCognition(e.target.value)}
                placeholder="e.g. Acute disorientation to staff, didn't recognize Jordan at breakfast"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            {/* 2. Intake */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mb-1">
                <Utensils className="w-3.5 h-3.5 text-amber-600" />
                Intake
              </label>
              <input
                type="text"
                value={intake}
                onChange={(e) => setIntake(e.target.value)}
                placeholder="e.g. Consumed 45% of breakfast oatmeal, drank full juice"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            {/* 3. Mood */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mb-1">
                <Smile className="w-3.5 h-3.5 text-emerald-600" />
                Mood
              </label>
              <input
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="e.g. Mild restlessness when redirected; calmed with gentle reassurance"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            {/* 4. Mobility */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mb-1">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                Mobility
              </label>
              <input
                type="text"
                value={mobility}
                onChange={(e) => setMobility(e.target.value)}
                placeholder="e.g. Unsteady shuffling gait, 1-person standby assist"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            {/* 5. Other */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mb-1">
                <FileEdit className="w-3.5 h-3.5 text-purple-600" />
                Other / Follow-up Notes
              </label>
              <input
                type="text"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="e.g. Requested physician review (Dr. Patel) to rule out UTI"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            {/* Important Clinical Guard Notice */}
            <div className="mt-2 p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 leading-tight">
                <strong>Nothing is saved until confirmed.</strong> Unconfirmed notes are never saved to the state store and will strictly never reach the shift handoff summary.
              </p>
            </div>
          </div>
        </div>

        {/* Footer with Confirm / Discard */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={handleDiscard}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Discard Draft</span>
          </button>

          <div className="flex items-center gap-3">
            {confirmedSuccess && (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <Check className="w-4 h-4" /> Note Confirmed & Saved!
              </span>
            )}
            <button
              onClick={handleConfirmSave}
              disabled={
                confirmedSuccess ||
                (!rawTranscript.trim() && !cognition && !intake && !mood && !mobility)
              }
              className="px-6 py-2.5 bg-teal-800 hover:bg-teal-900 disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Confirm Note & Save to Chart</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
