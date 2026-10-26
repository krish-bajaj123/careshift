import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

async function startServer() {
  const app = express();
  const port = 3000;

  app.use(express.json());

  // Setup Gemini client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;

  // Handoff Summary API
  app.post('/api/handoff/generate', async (req, res) => {
    try {
      const { snapshot } = req.body;
      if (!snapshot) {
        return res.status(400).json({ error: 'Missing snapshot data' });
      }

      if (!ai) {
        return res.status(503).json({
          error: 'Gemini API key is not configured in this environment.',
        });
      }

      const prompt = `You are a clinical documentation assistant on a specialized dementia care unit.
Create an end-of-shift nurse handoff summary based EXCLUSIVELY on the structured facts below.
Rules:
1. Include EVERY single fact provided in the data (completed counts, outstanding tasks with reasons, escalations, resident requests, flagged patterns, and watch-for items).
2. Do NOT invent, assume, or add any facts, medications, dosages, or diagnoses not present in the input.
3. Use first names only (e.g. Daniel, Kamala, Leon, Pauline, Samuel, Teresa).
4. Keep the tone concise, clinical, objective, and easy for the incoming shift (RN & PSWs) to prioritize.
5. Format with clear headings: "Shift Overview", "Urgent / Escalations", "Outstanding Tasks & Re-plans", "Behavioral & Autonomy Notes", "Flagged Care Patterns".

Structured shift snapshot:
${JSON.stringify(snapshot, null, 2)}`;

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout')), 5000)
      );

      const generatePromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);

      const summaryText = response.text || '';
      return res.json({ text: summaryText });
    } catch (err: any) {
      console.error('Error generating shift handoff:', err);
      return res.status(500).json({
        error: err?.message || 'Failed to generate shift handoff summary',
      });
    }
  });

  // Voice Progress Note Structuring API
  // Takes only the transcript and parses into: cognition, intake, mood, mobility, other
  app.post('/api/progress-note/structure', async (req, res) => {
    // Helper for intelligent clinical clause extraction
    const extractClause = (text: string, keywords: string[], defaultVal: string) => {
      const sentences = text.split(/[.;,\n]+/).map((s) => s.trim()).filter(Boolean);
      const match = sentences.find((s) => keywords.some((kw) => s.toLowerCase().includes(kw)));
      return match || defaultVal;
    };

    try {
      const { transcript, residentName } = req.body;
      if (!transcript || typeof transcript !== 'string') {
        return res.status(400).json({ error: 'Missing transcript' });
      }

      if (!ai) {
        // Deterministic local extraction fallback
        return res.json({
          structured: {
            cognition: extractClause(
              transcript,
              ['confus', 'disorient', 'recogniz', 'alert', 'memory', 'delir', 'hallucin'],
              'Baseline alertness and orientation'
            ),
            intake: extractClause(
              transcript,
              ['eat', 'ate', '%', 'porridge', 'oatmeal', 'juice', 'tea', 'breakfast', 'lunch', 'dinner', 'swallow', 'intake', 'fluid'],
              'Intake as charted by dietary'
            ),
            mood: extractClause(
              transcript,
              ['agitat', 'restless', 'calm', 'pleasant', 'anxious', 'smile', 'smiling', 'cooperat', 'resist'],
              'Calm and cooperative'
            ),
            mobility: extractClause(
              transcript,
              ['gait', 'walk', 'shuffl', 'transfer', 'unsteady', 'assist', 'wheelchair', 'ambulat', 'standby'],
              'Baseline mobility / Ambulates with usual assist'
            ),
            other: extractClause(
              transcript,
              ['dr.', 'patel', 'review', 'physician', 'pill', 'med', 'urine', 'pain', 'skin', 'order'],
              transcript.trim()
            ),
          },
        });
      }

      const prompt = `You are an expert clinical documentation assistant on a specialized long-term dementia care unit.
Convert ONLY the following raw spoken nursing transcript into a structured clinical progress note.
Return a valid JSON object with EXACTLY these five string keys:
- "cognition": observations on alertness, orientation, memory, confusion, disorientation, or hallucinations (or "Baseline / Alert to familiar cues" if not mentioned).
- "intake": meal completion percentage, fluid intake, or swallowing observations (or "Not observed during this encounter" if not mentioned).
- "mood": affect, agitation, calm, resistance, smiling, cooperative, or anxiety (or "Calm and cooperative" if not mentioned).
- "mobility": transfers, walking, rest, repositioning, gait (or "Baseline mobility" if not mentioned).
- "other": any other clinical observations, medications, pain, skin, family contact, or specifics mentioned in the transcript.

Rules:
- Base your answers strictly on the words spoken in the transcript.
- Do not invent dosages, diagnoses, or facts not mentioned.
- Output ONLY the raw JSON object.

Transcript:
"${transcript}"`;

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout')), 5000)
      );

      const generatePromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);

      let parsed: any = null;
      try {
        const text = response.text || '{}';
        parsed = JSON.parse(text);
      } catch (jsonErr) {
        console.warn('JSON parse error from Gemini progress note response, cleaning text:', jsonErr);
        const match = response.text?.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        }
      }

      const structured = {
        cognition: parsed?.cognition || 'Baseline / Alert to familiar cues',
        intake: parsed?.intake || 'Not observed during this encounter',
        mood: parsed?.mood || 'Calm and cooperative',
        mobility: parsed?.mobility || 'Baseline mobility',
        other: parsed?.other || transcript.trim(),
      };

      return res.json({ structured });
    } catch (err: any) {
      console.error('Error structuring progress note:', err);
      const text = req.body.transcript || '';
      return res.json({
        structured: {
          cognition: extractClause(
            text,
            ['confus', 'disorient', 'recogniz', 'alert', 'memory', 'delir', 'hallucin'],
            'Baseline alertness and orientation'
          ),
          intake: extractClause(
            text,
            ['eat', 'ate', '%', 'porridge', 'oatmeal', 'juice', 'tea', 'breakfast', 'lunch', 'dinner', 'swallow', 'intake', 'fluid'],
            'Intake as charted by dietary'
          ),
          mood: extractClause(
            text,
            ['agitat', 'restless', 'calm', 'pleasant', 'anxious', 'smile', 'smiling', 'cooperat', 'resist'],
            'Calm and cooperative'
          ),
          mobility: extractClause(
            text,
            ['gait', 'walk', 'shuffl', 'transfer', 'unsteady', 'assist', 'wheelchair', 'ambulat', 'standby'],
            'Baseline mobility / Ambulates with usual assist'
          ),
          other: extractClause(
            text,
            ['dr.', 'patel', 'review', 'physician', 'pill', 'med', 'urine', 'pain', 'skin', 'order'],
            text.trim()
          ),
        },
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`CareShift server running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
