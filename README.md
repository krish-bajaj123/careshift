# CareShift v0.0

### What CareShift v0.0 Does (in 5 lines)
1. CareShift v0.0 is an assistant for specialized dementia care units, connecting a calm nurse view with a bedside resident tablet.
2. A deterministic rules engine enforces strict ±60 min medication windows, staff preferences, and autonomy profiles without LLM hallucinations.
3. When care tasks are refused or rescheduled, the system automatically proposes intelligent retries or escalates to Alex (Charge RN).
4. Bedside tablets present large-type, dementia-friendly choices with picture answer cards and an always-visible Help button.
5. Gemini assists only with optional speech-to-structured voice progress notes and end-of-shift handoff summary narratives.

---

### How to Run Locally & Environment Variables

#### Prerequisites
- Node.js 18+ (or Bun / npm)
- (Optional) Google Gemini API Key

#### Installation & Startup
```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional - falls back to deterministic local parsing if omitted)
cp .env.example .env # or add GEMINI_API_KEY in .env

# 3. Start development server (serves app on port 3000)
npm run dev

# 4. Build and start production bundle
npm run build
npm start
```

#### Environment Variables
- `GEMINI_API_KEY`: Google Gemini API key used by the backend in `server.ts` for AI-assisted voice note structuring (`gemini-3.8-flash`) and shift handoff narrative generation. If omitted, the server automatically uses the built-in deterministic clinical extraction fallbacks.

---

### Folder Structure (one line per file)

```
.
├── .env.example                               # Example environment configuration with GEMINI_API_KEY placeholder.
├── bun.lock                                   # Lockfile for Bun package manager.
├── dist/                                      # Compiled production build assets.
├── index.html                                 # Web application HTML entrypoint with viewport and font links.
├── metadata.json                              # AI Studio applet metadata, permissions, and description.
├── package.json                               # Project configuration, dependencies, and build/dev scripts.
├── README.md                                  # Complete documentation, rules specification, and setup guide.
├── server.ts                                  # Express server providing Gemini proxy endpoints and Vite dev middleware.
├── tsconfig.json                              # TypeScript compiler settings, target specifications, and JSX configuration.
├── vite.config.ts                             # Vite configuration with React and Tailwind CSS plugins.
└── src/
    ├── App.tsx                                # Main application container hosting dual-pane view, mobile tabs, and modals.
    ├── index.css                              # Global stylesheet importing Tailwind CSS with custom styling.
    ├── main.tsx                               # React root entrypoint rendering the top-level CareShift application.
    ├── components/
    │   ├── AuditLogDrawer.tsx                 # Slide-out drawer displaying the immutable append-only chronological audit trail.
    │   ├── ClockHeader.tsx                    # Header component displaying current simulated shift time and unit context.
    │   ├── DeclineReasonDialog.tsx            # Mandatory clinical reason capture dialog when declining proposed actions.
    │   ├── DemoControlBar.tsx                 # Top bar for advancing the simulated clock, resetting state, and switching views.
    │   ├── HandoffModal.tsx                   # End-of-shift handoff summary with Gemini narrative, structured facts, and copy.
    │   ├── NursePane.tsx                      # Primary nurse dashboard for tasks, pending approvals, and resident status grid.
    │   ├── ResidentDetailModal.tsx            # Resident profile modal showing care tips, 7-day trend history, and quick actions.
    │   ├── ResidentPane.tsx                   # Bedside tablet view with date/time, picture answer cards, choices, and Help button.
    │   ├── TrendsModal.tsx                    # 7-day longitudinal trend dashboard displaying delirium risks and follow-ups.
    │   ├── UrgentAlertBanner.tsx              # High-priority alert banner triggered immediately by resident Help calls or missed windows.
    │   └── VoiceNoteModal.tsx                 # Voice dictation modal converting spoken notes into structured clinical categories.
    ├── logic/
    │   ├── careShiftStore.tsx                 # React context store managing application state, clock transitions, and audit logging.
    │   ├── rulesEngine.ts                     # Deterministic clinical rules engine for windows, retries, conflicts, trends, and handoffs.
    │   └── syntheticData.ts                   # Realistic seeded initial data for 6 residents, 5 staff members, tasks, and 7-day history.
    └── types/
        └── index.ts                           # TypeScript interfaces and types for tasks, residents, proposals, notes, and trends.
```

---

### Rules Engine & Exact Enforced Rules

The rules engine lives in **`src/logic/rulesEngine.ts`**. It handles all clinical scheduling, autonomy, and trend decisions deterministically without language model hallucinations:

1. **Medication Window Rule (Scheduled ±60 Minutes)**:
   - Medication windows can NEVER be broken.
   - For a med scheduled at `09:00`, the window is strictly `08:00` (earliest) to `10:00` (latest).
   - If the clock advances past `latest` while the medication is not marked complete, the engine auto-generates an escalation to Alex (Charge RN).
2. **Next Retry Slot Calculation**:
   - Refused or deferred tasks calculate the next 15-minute slot at least 30 minutes from current time (`calculateNextRetrySlot(currentTime, 30)`).
   - Example: Refusal at `09:00` proposes `09:30`; refusal at `09:20` proposes `10:00`.
3. **Refusal Handling & Staff Affinity**:
   - First refusal inside window proposes a retry at the calculated slot, preferring the resident's favorite staff (e.g. Priya for Kamala).
   - Second consecutive refusal (`attemptCount >= 2`) triggers an automatic escalation proposal to Alex (Charge RN).
   - If remaining window is less than 15 minutes or retry slot exceeds the window, it escalates to Alex immediately.
4. **Resident Autonomy Profiles**:
   - **Stage 1 (Mild - Daniel D.)**: Allowed choices: `'pills'`, `'shower'`, `'activities'`. Can select shower timing and daily activities.
   - **Stage 2 (Moderate - Kamala K.)**: Allowed choices: `'pills'`. Can signal readiness or defer pills; no activity selection.
   - **Stage 3 (Later Stage - Leon L.)**: Allowed choices: `[]`. No choice buttons shown; displays only a calm reassurance card and the Help button.
   - Bedside tablets display a maximum of 3 concrete choices; open-ended questions and memory tests are prohibited.
5. **Resident Request Outcome Evaluation**:
   - Requests (e.g., shower after lunch) are checked against staff schedules and conflicting tasks.
   - Returns strictly one outcome: `"Fits"`, `"Fits if [task] moves to [time]"`, or `"Can't happen"` with the nearest alternative.
6. **7-Day Longitudinal Trend Rules** (Computed in plain code):
   - **Rising Confusion / Delirium Risk**: An acute 24-hour jump of $\ge 3$ confusion mentions flags an urgent delirium alert (*"possible delirium or infection, consider assessment"*) and proposes a **Physician review**.
   - **Falling Meal Intake**: A 7-day drop $\ge 25\%$ proposes a **Pharmacist medication review** to assess appetite-suppressing medications.
   - **More Refusals**: A 7-day increase of $\ge 2$ refusals proposes a **Pharmacist medication review** for formulation or timing tolerance.
   - **Fewer Requests**: A 7-day drop of $\ge 3$ autonomous choices proposes a **Family care conference** to assess apathy and engagement goals.
7. **Strict Shift Snapshot Boundary**:
   - End-of-shift handoff summaries compile strictly verified factual data.
   - **Unconfirmed voice note drafts NEVER reach the handoff snapshot.** Only notes explicitly confirmed by the nurse are included.

---

### Where Gemini is Called & What Data is Sent

Gemini is called exclusively through server-side proxy routes in **`server.ts`** using `@google/genai` (`gemini-3.8-flash`):

1. **Handoff Summary Generation (`POST /api/handoff/generate`)**:
   - **Data Sent**: The `snapshot` object containing:
     - Completed and total task counts.
     - Outstanding tasks with scheduled time, status, and refusal reasons.
     - Active clinical escalations.
     - Open resident requests.
     - Resident watch-for care tips.
     - 7-day trend analysis summaries.
     - *Confirmed progress notes only*.
   - **Data NOT Sent**: No external resident databases, private IDs, or unconfirmed drafts are transmitted.
   - **Fallback**: If the API call times out (5s) or fails, the frontend falls back to the structured facts list view.

2. **Voice Progress Note Structuring (`POST /api/progress-note/structure`)**:
   - **Data Sent**: Only the raw `transcript` string spoken or typed by the nurse, and resident first name.
   - **Data Returned**: A structured JSON object with 5 keys: `cognition`, `intake`, `mood`, `mobility`, and `other`.
   - **Fallback**: If Gemini is unavailable, a deterministic regex/clause parser categorizes the transcript locally.
   - **Nurse Review**: The structured output is editable in the UI and is saved only when the nurse taps **"Confirm & Save Note"**.

---

### Synthetic Data & How to Change It

The synthetic dataset is located in **`src/logic/syntheticData.ts`**:

- **`INITIAL_SIMULATED_TIME`**: Starting shift clock (set to `'09:20'`). Change this string (`'HH:MM'`) to start the shift at a different time.
- **`STAFF_MEMBERS`**: List of 5 staff members (`Sam RN`, `Priya PSW`, `Jordan PSW`, `Alex Charge`, `Morgan Rec`).
- **`INITIAL_RESIDENTS`**: Array of 6 resident records (`Daniel D.`, `Kamala K.`, `Leon L.`, `Pauline P.`, `Samuel S.`, `Teresa T.`):
  - `allowedChoices`: Controls which choices appear on the bedside tablet (`'pills'`, `'shower'`, `'activities'`).
  - `preferredStaff`: Staff member preferred for intimate care tasks.
  - `sevenDayHistory`: 7 daily records containing `confusionMentions`, `mealIntakePercent`, `refusalCount`, and `requestCount` used by the trend computation engine.
- **`INITIAL_TASKS`**: Care tasks with types (`'medication'`, `'shower'`, `'meal'`, `'activity'`), scheduled `time`, `earliest`, `latest`, `staff`, and `durationMin`.
- **`INITIAL_PROPOSALS`**: Pre-seeded approval proposals matching the shift start layout.
- **`SEED_AUDIT_EVENTS`**: Baseline audit trail entries.

**To customize**:
Modify any resident values or task timings in `src/logic/syntheticData.ts`. Clicking the **Reset** button in the demo bar resets the active session to these baseline values.

---

### Known Issues

1. **Web Speech API Browser Compatibility**: Voice dictation relies on browser Speech Recognition (`webkitSpeechRecognition`), which is natively supported in Chromium browsers and Safari. A typed text input fallback is provided in the Voice Note modal for full functionality on all browsers.
2. **Audio Autoplay Restrictions**: The audio alert chime for Help calls utilizes the browser Audio API. Modern browsers block autoplay until the user interacts with the page (e.g. clicking any button).
3. **Session State In-Memory**: CareShift v0.0 operates as an in-memory clinical simulation. Full page reloads reset the simulation back to the `INITIAL_SIMULATED_TIME` baseline unless running within an active single-page session.
