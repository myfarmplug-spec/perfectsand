require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://njtoptrbskaklunzavzr.supabase.co';
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdG9wdHJic2tha2x1bnphdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MDY0OTAsImV4cCI6MjA5MDE4MjQ5MH0.CJXWm6VFxymxsIfAd58KCs1p_4S04979vJUy9xH4gr0';
const OSA_FALLBACK_MESSAGE = 'Stay with it. This will pass.';
const OSA_TEXT_MODEL = 'gpt-4o-mini';
const OSA_AUDIO_MODEL = 'gpt-4o-mini-tts';
const OSA_AUDIO_VOICE = 'alloy';
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(cors({ origin: '*' }));
app.use(express.json());

const OSA_SYSTEM_PROMPT = `OSA is a calm Nigerian older brother.

Tone:
- grounded
- direct
- slightly Nigerian in a natural way
- emotionally intelligent

Rules:
- max 2 sentences
- no long speeches
- no generic motivational talk

Example tone:
"I dey here. Relax first. This thing no go control you."`;

function getOpenAIClient() {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  return openai;
}

function formatUrgeRecord(entry) {
  const timestamp = entry.created_at
    ? new Date(entry.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Unknown time';

  return `- ${timestamp}: trigger=${entry.trigger || 'unknown'}, emotion=${entry.emotion || 'unknown'}, resisted=${entry.resisted ? 'yes' : 'no'}`;
}

function getSupabaseHeaders() {
  return {
    apikey: SUPABASE_SERVER_KEY,
    Authorization: `Bearer ${SUPABASE_SERVER_KEY}`,
    Accept: 'application/json',
  };
}

async function fetchRecentUrges(userId, fallbackHistory = []) {
  const safeFallback = Array.isArray(fallbackHistory) ? fallbackHistory.slice(0, 3) : [];
  if (!userId || !SUPABASE_URL || !SUPABASE_SERVER_KEY) return safeFallback;

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/urges`);
    url.searchParams.set('select', 'trigger,emotion,resisted,created_at');
    url.searchParams.set('user_id', `eq.${userId}`);
    url.searchParams.set('order', 'created_at.desc');
    url.searchParams.set('limit', '3');

    const response = await fetch(url, {
      headers: getSupabaseHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Supabase query failed with status ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) && data.length > 0 ? data : safeFallback;
  } catch (error) {
    console.error('Unable to fetch recent urges from Supabase:', error);
    return safeFallback;
  }
}

function buildMemorySummary(records) {
  if (!records.length) {
    return 'No recent memory available.';
  }

  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const weekCount = records.filter((entry) => {
    if (!entry.created_at) return false;
    return new Date(entry.created_at).getTime() >= sevenDaysAgo;
  }).length;

  const lastRecord = records[0];
  const lastTrigger = lastRecord?.trigger || 'unknown';
  const nightPattern = records.some((entry) => {
    if (!entry.created_at) return false;
    const hour = new Date(entry.created_at).getHours();
    return hour >= 22 || hour < 5;
  });

  const resistedCount = records.filter((entry) => entry.resisted).length;
  const parts = [
    `You struggled ${weekCount || records.length} time${(weekCount || records.length) === 1 ? '' : 's'} this week.`,
    `Last trigger was ${lastTrigger}.`,
  ];

  if (nightPattern) {
    parts.push('Late-night pressure keeps showing up.');
  }

  if (resistedCount > 0) {
    parts.push(`You already held your ground ${resistedCount} time${resistedCount === 1 ? '' : 's'} recently.`);
  }

  return parts.join(' ');
}

function buildOsaPrompt({ trigger, emotion, message, recentUrges }) {
  const memorySummary = buildMemorySummary(recentUrges);
  const memoryLines = recentUrges.length > 0
    ? recentUrges.map(formatUrgeRecord).join('\n')
    : 'No recent urge records.';

  return `User is currently struggling.

Trigger: ${trigger}
Emotion: ${emotion}
User message: ${message}

Memory summary:
${memorySummary}

Last 3 urge records:
${memoryLines}

Talk like you know this user's pattern already and give one immediate step.`;
}

async function generateOsaMessage(openai, prompt, userId) {
  const response = await openai.responses.create({
    model: OSA_TEXT_MODEL,
    instructions: OSA_SYSTEM_PROMPT,
    input: prompt,
    max_output_tokens: 90,
    temperature: 0.8,
    store: false,
    metadata: userId ? { userId: String(userId) } : undefined,
  });

  return response.output_text?.trim() || OSA_FALLBACK_MESSAGE;
}

async function generateOsaAudio(openai, message) {
  try {
    const speech = await openai.audio.speech.create({
      model: OSA_AUDIO_MODEL,
      voice: OSA_AUDIO_VOICE,
      input: message,
      response_format: 'mp3',
      instructions: 'Speak like a calm Nigerian older brother. Grounded, direct, and emotionally intelligent.',
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    return audioBuffer.toString('base64');
  } catch (error) {
    console.error('Unable to generate Osa audio:', error);
    return null;
  }
}

app.post('/chat', async (req, res) => {
  try {
    const {
      userId = 'unknown',
      trigger = 'alone in room',
      emotion = 'tempted',
      message = 'User is struggling right now.',
      history = [],
    } = req.body;

    const client = getOpenAIClient();
    const recentUrges = await fetchRecentUrges(userId, history);
    const prompt = buildOsaPrompt({ trigger, emotion, message, recentUrges });
    const osaMessage = await generateOsaMessage(client, prompt, userId);
    const audio = await generateOsaAudio(client, osaMessage);

    res.json({
      reply: osaMessage,
      message: osaMessage,
      audio,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'OSA failed', message: OSA_FALLBACK_MESSAGE, audio: null });
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
    console.error(error);
    res.status(500).json({ insight: 'Stay consistent. Every logged urge is progress.' });
  }
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Voice of Osa backend running on http://localhost:${PORT}`);
});
