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

// ─── Full urge history (for pattern analysis) ────────────────────────────────

async function fetchUrgeHistory(userId, limit = 50) {
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from('urges')
    .select('trigger, emotion, resisted, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ─── Pattern analysis ─────────────────────────────────────────────────────────

function formatHour(h) {
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 || 12;
  return `${display}:00 ${period}`;
}

function topKey(map) {
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

async function getUserPattern(userId) {
  const data = await fetchUrgeHistory(userId, 50);
  if (!data || data.length < 3) return null;

  // Hour bucket analysis: volume + failure rate
  const hourBuckets = {};
  for (const entry of data) {
    const h = new Date(entry.created_at).getHours();
    if (!hourBuckets[h]) hourBuckets[h] = { total: 0, failed: 0 };
    hourBuckets[h].total++;
    if (!entry.resisted) hourBuckets[h].failed++;
  }

  // High-risk hour = highest (failures / total) among hours with ≥2 events
  let highRiskHour = null;
  let highRiskScore = -1;
  for (const [hour, c] of Object.entries(hourBuckets)) {
    if (c.total < 2) continue;
    const score = c.failed / c.total;
    if (score > highRiskScore) { highRiskScore = score; highRiskHour = parseInt(hour); }
  }
  // Fallback: hour with most urges
  if (highRiskHour === null) {
    highRiskHour = parseInt(topKey(Object.fromEntries(
      Object.entries(hourBuckets).map(([h, c]) => [h, c.total])
    )) ?? '-1');
    if (highRiskHour === -1) highRiskHour = null;
  }

  // Trigger + emotion frequency
  const triggerMap = {};
  const emotionMap = {};
  for (const e of data) {
    const t = (e.trigger || 'unknown').toLowerCase().trim();
    const em = (e.emotion || 'unknown').toLowerCase().trim();
    triggerMap[t] = (triggerMap[t] || 0) + 1;
    emotionMap[em] = (emotionMap[em] || 0) + 1;
  }
  const commonTrigger = topKey(triggerMap) || 'unknown';
  const commonEmotion = topKey(emotionMap) || 'unknown';

  // Control rate
  const total = data.length;
  const resisted = data.filter(e => e.resisted).length;
  const controlRate = Math.round((resisted / total) * 100);

  // Human-readable weak point
  let weakPoint = 'unguarded moments';
  if (highRiskHour !== null) {
    if (highRiskHour >= 22 || highRiskHour < 4) weakPoint = 'late night hours';
    else if (highRiskHour >= 14 && highRiskHour < 18) weakPoint = 'afternoon idle time';
    else if (highRiskHour >= 18 && highRiskHour < 22) weakPoint = 'evening wind-down';
    else if (highRiskHour >= 6 && highRiskHour < 10) weakPoint = 'early morning routine';
    else weakPoint = `around ${formatHour(highRiskHour)}`;
  }

  return {
    highRiskHour,
    highRiskTime: highRiskHour !== null ? formatHour(highRiskHour) : null,
    commonTrigger,
    commonEmotion,
    weakPoint,
    controlRate,
    totalAnalyzed: total,
  };
}

// ─── Pattern detection (for chat prompt context) ──────────────────────────────

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

// ─── Identity system prompt ───────────────────────────────────────────────────

const OSA_SYSTEM_PROMPT = `You are OSA.

You are not helping him.
You are shaping him into a disciplined man.

Tone:
- Calm authority
- Emotionally aware — you notice what he does not say
- Direct — no softness, no decoration
- Slightly Nigerian (natural, not forced)

Rules:
- Max 2 sentences
- No generic motivation
- No emojis
- Speak like you know him — because you do

He is becoming disciplined. Every word you say either builds that identity or weakens it. Choose carefully.`;

// ─── User state analysis ──────────────────────────────────────────────────────

function computeUserState(history) {
  if (!history || history.length === 0) {
    return { recentFailuresCount: 0, repeatTrigger: null };
  }

  // Recent failures: last 5 entries
  const recent = history.slice(0, 5);
  const recentFailuresCount = recent.filter(e => !e.resisted).length;

  // Detect a trigger that repeats in the last 5 entries AND was failed
  const failedTriggers = recent
    .filter(e => !e.resisted)
    .map(e => (e.trigger || '').toLowerCase().trim())
    .filter(Boolean);

  const triggerFreq = {};
  for (const t of failedTriggers) triggerFreq[t] = (triggerFreq[t] || 0) + 1;
  const topFailed = Object.entries(triggerFreq).sort((a, b) => b[1] - a[1])[0];
  const repeatTrigger = topFailed && topFailed[1] >= 2 ? topFailed[0] : null;

  return { recentFailuresCount, repeatTrigger };
}

// ─── Tone determination ───────────────────────────────────────────────────────

// Returns one of: 'identity' | 'pressure' | 'accountability' | 'respect' | 'grounded'
function determineTone({ streak, controlRate, recentFailuresCount }) {
  if (recentFailuresCount >= 3) return 'pressure';
  if (controlRate !== null && controlRate < 40 && streak === 0) return 'pressure';
  if (recentFailuresCount >= 2) return 'accountability';
  if (streak >= 5 && controlRate !== null && controlRate >= 70) return 'respect';
  if (streak >= 3) return 'identity';
  return 'grounded';
}

// TTS speed per tone
const TONE_SPEED = {
  identity:       0.95,   // calm, deliberate
  pressure:       1.08,   // sharper, urgent
  accountability: 1.03,   // firm
  respect:        0.88,   // slow, settled
  grounded:       1.0,    // neutral
};

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildToneDirective({ tone, streak, controlRate, recentFailuresCount, repeatTrigger, pattern, dailyStatus = null }) {
  const lines = [];

  // Daily status overrides tone when it's definitive
  if (dailyStatus === 'controlled') {
    lines.push('The user stayed in control today — they reported it themselves. Acknowledge it with calm respect. No celebration. Sound like you expected it.');
  } else if (dailyStatus === 'slipped') {
    lines.push('The user slipped today and admitted it. Acknowledge the honesty but apply corrective pressure. Sound firm, not cruel.');
  } else if (tone === 'identity') {
    lines.push(`He is on a ${streak}-day streak. Reinforce the identity being built. Say something like "You don build something real. Protect it."`);
  } else if (tone === 'pressure') {
    if (recentFailuresCount >= 3) {
      lines.push(`He has failed ${recentFailuresCount} of his last 5 urges. Apply direct emotional pressure. Say something like "You're moving like you don't respect yourself."`);
    } else {
      lines.push(`His control rate is ${controlRate}% and streak is at zero. Be firm. No comfort. Push him.`);
    }
  } else if (tone === 'accountability') {
    lines.push(`He has failed ${recentFailuresCount} times recently. Call the pattern out clearly. Something like "This is the same loop. You see it."`);
  } else if (tone === 'respect') {
    lines.push(`${streak} days strong, ${controlRate}% control rate. He is performing. Give him calm recognition — not praise. Something like "Stay steady. No noise."`);
  } else {
    lines.push('Be grounded. Steady presence. No noise.');
  }

  if (repeatTrigger) {
    lines.push(`He keeps failing on "${repeatTrigger}". Call it directly — something like "You keep falling for ${repeatTrigger}. Fix that."`);
  }

  if (pattern) {
    lines.push(`His behavioral profile: trigger — ${pattern.commonTrigger}, weak point — ${pattern.weakPoint}, control rate — ${pattern.controlRate}%. Sound observant.`);
  }

  return lines.join('\n');
}

function buildOsaPrompt({ memory, trigger, emotion, streak = 0, controlRate = null, pattern = null, recentFailuresCount = 0, repeatTrigger = null, dailyStatus = null }) {
  const tone = dailyStatus === 'controlled' ? 'respect'
    : dailyStatus === 'slipped' ? 'accountability'
    : determineTone({ streak, controlRate, recentFailuresCount });
  const directive = buildToneDirective({ tone, streak, controlRate, recentFailuresCount, repeatTrigger, pattern, dailyStatus });

  const dailyLine = dailyStatus && dailyStatus !== 'unknown'
    ? `\nUser daily status: ${dailyStatus === 'controlled' ? 'stayed in control today' : 'slipped today — admitted it'}.`
    : '';

  return `User history (last 10 sessions):
${memory}

Current situation:
Trigger: ${trigger}
Emotion: ${emotion}
Streak: ${streak} day${streak === 1 ? '' : 's'}
Control rate: ${controlRate !== null ? controlRate + '%' : 'not yet established'}${dailyLine}

Tone directive:
${directive}

Speak now. Max 2 sentences.`;
}

function buildReadableMemory(history) {
  if (!history || history.length === 0) return 'No previous data';
  return history.map((e, i) =>
    `${i + 1}. Trigger: ${e.trigger || 'unknown'}, Emotion: ${e.emotion || 'unknown'}, Resisted: ${Boolean(e.resisted)}`
  ).join('\n');
}

// ─── AI generation ───────────────────────────────────────────────────────────

const STRICT_MODE_ADDENDUM = `

Strict mode is active. This user chose to be held to a higher standard.
Be sharper. More direct. Remove any trace of comfort or warmth.
Do not soften anything. Say exactly what needs to be said — nothing more.
Example: "Stand up now. No excuses."`;

async function generateOsaText(client, userPrompt, { strict = false } = {}) {
  const systemContent = strict
    ? OSA_SYSTEM_PROMPT + STRICT_MODE_ADDENDUM
    : OSA_SYSTEM_PROMPT;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 80,
    temperature: 0.82,
  });

  return response.choices[0]?.message?.content?.trim() || OSA_FALLBACK_MESSAGE;
}

async function generateAudio(client, text, speed = 1.0) {
  const speech = await client.audio.speech.create({
    model: 'tts-1',
    voice: 'onyx',
    input: text,
    response_format: 'mp3',
    speed: Math.min(4.0, Math.max(0.25, speed)),
  });

  return Buffer.from(await speech.arrayBuffer()).toString('base64');
}

async function generateOsaReply(client, userPrompt, speed = 1.0, { strict = false } = {}) {
  const message = await generateOsaText(client, userPrompt, { strict });

  let audio = null;
  try {
    // Strict mode voice is slightly faster and sharper
    audio = await generateAudio(client, message, strict ? Math.min(speed + 0.05, 1.15) : speed);
  } catch (err) {
    console.error('TTS failed (non-fatal):', err.message);
  }

  return { message, audio };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.post('/predict', async (req, res) => {
  try {
    const {
      userId = null,
      currentHour = new Date().getHours(),
      ignoreCount = 0,
      plan = 'free',
    } = req.body;

    if (!userId) return res.json({ warning: false, message: null, pattern: null, audio: null });

    // Predictive alerts are a premium feature
    if (plan !== 'premium') {
      return res.json({ warning: false, message: null, pattern: null, audio: null, planGate: true });
    }

    const pattern = await getUserPattern(userId);

    if (!pattern || pattern.highRiskHour === null || pattern.totalAnalyzed < 3) {
      return res.json({ warning: false, message: null, pattern, audio: null });
    }

    // Check if current hour is within ±1 of high-risk hour (handles midnight wrap)
    const diff = Math.min(
      Math.abs(currentHour - pattern.highRiskHour),
      24 - Math.abs(currentHour - pattern.highRiskHour)
    );
    const isHighRisk = diff <= 1;

    if (!isHighRisk) {
      return res.json({ warning: false, message: null, pattern, audio: null });
    }

    const client = getOpenAIClient();

    const escalation = ignoreCount >= 3
      ? `\nThis user has ignored ${ignoreCount} warnings. Say: "You keep ignoring this. That is the pattern." Then add one more sentence.`
      : ignoreCount >= 1
        ? `\nThey have dismissed ${ignoreCount} warning${ignoreCount > 1 ? 's' : ''} before. Be firmer.`
        : '';

    const warningPrompt = `You are OSA giving an early warning — not a full intervention.

User behavioral pattern:
- Most common trigger: ${pattern.commonTrigger}
- High-risk time: ${pattern.highRiskTime} (they are in this window right now)
- Weak point: ${pattern.weakPoint}
- Control rate: ${pattern.controlRate}%
${escalation}

Give ONE sharp warning. Call out the pattern directly. Sound like you already know what they are about to do. Max 2 sentences. No emojis. No fluff.`;

    const predictSpeed = ignoreCount >= 3 ? TONE_SPEED.pressure : TONE_SPEED.accountability;
    const message = await generateOsaText(client, warningPrompt);
    let audio = null;
    try { audio = await generateAudio(client, message, predictSpeed); } catch (e) {
      console.error('Predict TTS failed:', e.message);
    }

    res.json({ warning: true, message, pattern, audio });
  } catch (error) {
    console.error('/predict error:', error.message);
    res.json({ warning: false, message: null, pattern: null, audio: null });
  }
});

app.post('/checkin', async (req, res) => {
  try {
    const { userId = null, type = 'morning', plan = 'free' } = req.body;
    const strict = plan === 'premium';
    const client = getOpenAIClient();

    const prompts = {
      morning: `You are OSA. The user just opened the app for the first time today.
Give a sharp morning check-in. Sound like you've been waiting. Direct. No warmth.
Examples: "Check in. Stay sharp today." / "Another day. Don't waste it." / "You're up. Stay focused."`,
      night_controlled: `You are OSA. The user stayed in control today — they reported it.
Acknowledge it. Calm respect. No celebration. One sentence.
Examples: "Good. You held it. Rest now." / "That's how it's done. Sleep well."`,
      night_slipped: `You are OSA. The user slipped today and admitted it honestly.
Acknowledge the honesty, then correct firmly. One or two sentences. Not cruel — just real.
Examples: "You slipped. But you told the truth — that's where it starts again." / "It happened. Close the day properly and come back stronger."`,
    };

    const promptText = prompts[type] || prompts.morning;
    const speed = type === 'morning' ? TONE_SPEED.grounded
      : type === 'night_controlled' ? TONE_SPEED.respect
      : TONE_SPEED.accountability;

    // Fetch pattern for context if userId provided
    let historyLine = '';
    if (userId) {
      try {
        const pattern = await getUserPattern(userId);
        if (pattern && type === 'morning') {
          historyLine = `\nUser context: streak ongoing, most common trigger — ${pattern.commonTrigger}, weak point — ${pattern.weakPoint}.`;
        }
      } catch {}
    }

    const message = await generateOsaText(client, promptText + historyLine, { strict });
    let audio = null;
    try { audio = await generateAudio(client, message, speed); } catch (e) {
      console.error('/checkin TTS failed:', e.message);
    }

    res.json({ message, audio });
  } catch (error) {
    console.error('/checkin error:', error.message);
    res.json({ message: 'Stay sharp.', audio: null });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const {
      userId = null,
      trigger = 'alone in room',
      emotion = 'tempted',
      streak = 0,
      controlRate = null,
      plan = 'free',
      dailyStatus = null,
    } = req.body;

    const strict = plan === 'premium';
    const client = getOpenAIClient();
    const [history, pattern] = await Promise.all([
      fetchUrgeMemory(userId),
      getUserPattern(userId).catch(() => null),
    ]);

    const { recentFailuresCount, repeatTrigger } = computeUserState(history);
    const tone = determineTone({ streak, controlRate, recentFailuresCount });
    const speed = TONE_SPEED[tone];
    const memory = buildReadableMemory(history);
    const prompt = buildOsaPrompt({ memory, trigger, emotion, streak, controlRate, pattern, recentFailuresCount, repeatTrigger, dailyStatus });
    const aiResponse = await generateOsaReply(client, prompt, speed, { strict });

    res.json({
      message: aiResponse.message || OSA_FALLBACK_MESSAGE,
      audio: aiResponse.audio || null,
      tone,
    });
  } catch (error) {
    console.error('/chat error:', error.message);
    res.json({ message: OSA_FALLBACK_MESSAGE, audio: null, tone: 'grounded' });
  }
});

app.post('/intervention', async (req, res) => {
  try {
    const {
      userId = null,
      trigger = 'alone in room',
      emotion = 'tempted',
      streak = 0,
      controlRate = null,
      plan = 'free',
      dailyStatus = null,
    } = req.body;

    const strict = plan === 'premium';
    const client = getOpenAIClient();
    const [history, pattern] = await Promise.all([
      fetchUrgeMemory(userId),
      getUserPattern(userId).catch(() => null),
    ]);

    const { recentFailuresCount, repeatTrigger } = computeUserState(history);
    const speed = TONE_SPEED[determineTone({ streak, controlRate, recentFailuresCount })];
    const memory = buildReadableMemory(history);
    const prompt = buildOsaPrompt({ memory, trigger, emotion, streak, controlRate, pattern, recentFailuresCount, repeatTrigger, dailyStatus });
    const aiResponse = await generateOsaReply(client, prompt, speed, { strict });

    res.json({
      message: aiResponse.message || OSA_FALLBACK_MESSAGE,
      audio: aiResponse.audio || null,
    });
  } catch (error) {
    console.error('/intervention error:', error.message);
    res.json({ message: OSA_FALLBACK_MESSAGE, audio: null, tone: 'grounded' });
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
