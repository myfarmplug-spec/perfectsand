require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const OSA_FALLBACK_MESSAGE = 'Stay with it. This will pass.';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

app.use(cors({ origin: '*' }));
app.use(express.json());

function getOpenAIClient() {
  if (!openai) throw new Error('OPENAI_API_KEY is not configured.');
  return openai;
}

// ─── Supabase ────────────────────────────────────────────────────────────────

async function fetchUrgeMemory(userId) {
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from('urges')
    .select('trigger, emotion, resisted, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ─── Pattern detection ───────────────────────────────────────────────────────

function detectPatterns(history) {
  if (!history || history.length < 2) return null;

  const notes = [];

  // Repeat trigger
  const triggerCounts = {};
  for (const entry of history) {
    const t = (entry.trigger || '').toLowerCase().trim();
    if (t) triggerCounts[t] = (triggerCounts[t] || 0) + 1;
  }
  const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0];
  if (topTrigger && topTrigger[1] >= 3) {
    notes.push(`Trigger "${topTrigger[0]}" has come up ${topTrigger[1]} times.`);
  }

  // Night pattern (10pm–4am)
  const nightCount = history.filter(e => {
    const h = new Date(e.created_at).getHours();
    return h >= 22 || h < 4;
  }).length;
  if (nightCount >= 2) {
    notes.push(`${nightCount} of the last urges happened at night.`);
  }

  // Low resistance rate
  const total = history.length;
  const resisted = history.filter(e => e.resisted).length;
  const rate = Math.round((resisted / total) * 100);
  if (total >= 4 && rate <= 30) {
    notes.push(`Control rate is ${rate}% — only ${resisted} of ${total} resisted.`);
  }

  return notes.length > 0 ? notes.join(' ') : null;
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

const OSA_SYSTEM_PROMPT = `You are OSA — a calm, sharp Nigerian older brother.

Your voice:
- Grounded. Direct. No fluff.
- Slightly Nigerian (natural, not forced)
- Emotionally present but never soft

Rules:
- Max 2 sentences
- No motivational quotes
- No emojis
- No long speech

Examples:
"I dey here. Relax first."
"Stand up. No sit there."
"This feeling go pass, but you have to move."
"You've been here before — you survived it."`;

function buildOsaPrompt({ memory, patternNote, trigger, emotion }) {
  const patternLine = patternNote
    ? `\nPattern detected: ${patternNote}\nCall it out clearly.`
    : '';

  return `User history (last 10 sessions):
${memory}
${patternLine}

Current situation:
Trigger: ${trigger}
Emotion: ${emotion}

Speak now.`;
}

function buildReadableMemory(history) {
  if (!history || history.length === 0) return 'No previous data';
  return history.map((e, i) =>
    `${i + 1}. Trigger: ${e.trigger || 'unknown'}, Emotion: ${e.emotion || 'unknown'}, Resisted: ${Boolean(e.resisted)}`
  ).join('\n');
}

// ─── AI generation ───────────────────────────────────────────────────────────

async function generateOsaText(client, userPrompt) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: OSA_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 80,
    temperature: 0.85,
  });

  return response.choices[0]?.message?.content?.trim() || OSA_FALLBACK_MESSAGE;
}

async function generateAudio(client, text) {
  const speech = await client.audio.speech.create({
    model: 'tts-1',
    voice: 'onyx',
    input: text,
    response_format: 'mp3',
  });

  return Buffer.from(await speech.arrayBuffer()).toString('base64');
}

async function generateOsaReply(client, userPrompt) {
  const message = await generateOsaText(client, userPrompt);

  let audio = null;
  try {
    audio = await generateAudio(client, message);
  } catch (err) {
    console.error('TTS failed (non-fatal):', err.message);
  }

  return { message, audio };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.post('/chat', async (req, res) => {
  try {
    const {
      userId = null,
      trigger = 'alone in room',
      emotion = 'tempted',
    } = req.body;

    const client = getOpenAIClient();
    const history = await fetchUrgeMemory(userId);
    const memory = buildReadableMemory(history);
    const patternNote = detectPatterns(history);
    const prompt = buildOsaPrompt({ memory, patternNote, trigger, emotion });
    const aiResponse = await generateOsaReply(client, prompt);

    res.json({
      message: aiResponse.message || OSA_FALLBACK_MESSAGE,
      audio: aiResponse.audio || null,
    });
  } catch (error) {
    console.error('/chat error:', error.message);
    res.json({ message: OSA_FALLBACK_MESSAGE, audio: null });
  }
});

app.post('/intervention', async (req, res) => {
  try {
    const {
      userId = null,
      trigger = 'alone in room',
      emotion = 'tempted',
    } = req.body;

    const client = getOpenAIClient();
    const history = await fetchUrgeMemory(userId);
    const memory = buildReadableMemory(history);
    const patternNote = detectPatterns(history);
    const prompt = buildOsaPrompt({ memory, patternNote, trigger, emotion });
    const aiResponse = await generateOsaReply(client, prompt);

    res.json({
      message: aiResponse.message || OSA_FALLBACK_MESSAGE,
      audio: aiResponse.audio || null,
    });
  } catch (error) {
    console.error('/intervention error:', error.message);
    res.json({ message: OSA_FALLBACK_MESSAGE, audio: null });
  }
});

app.post('/voice', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.json({ audio: null });
    }

    const client = getOpenAIClient();
    const audio = await generateAudio(client, text.trim());
    res.json({ audio });
  } catch (error) {
    console.error('/voice error:', error.message);
    res.json({ audio: null });
  }
});

app.post('/insights', async (req, res) => {
  try {
    const client = getOpenAIClient();
    const { logs } = req.body;

    if (!logs || logs.length === 0) {
      return res.json({ insight: 'Log more urges to unlock AI insights.' });
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are Osa, a disciplined behavioral mentor.
Analyze the user's urge log data and give a short, powerful insight.
Focus on: trigger patterns, time of day, what's working, one actionable improvement.
Maximum 3 sentences. Direct. No fluff. No emojis.`,
        },
        {
          role: 'user',
          content: JSON.stringify(logs),
        },
      ],
      max_tokens: 120,
    });

    res.json({ insight: response.choices[0].message.content });
  } catch (error) {
    console.error('/insights error:', error.message);
    res.status(500).json({ insight: 'Stay consistent. Every logged urge is progress.' });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Voice of Osa backend running on http://localhost:${PORT}`);
});
