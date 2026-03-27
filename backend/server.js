require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const OSA_FALLBACK_MESSAGE = 'Stay with it. This will pass.';
const INTERVENTION_INSERT_DEFAULTS = { trigger: 'alone in room', emotion: 'tempted' };
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

app.use(cors({ origin: '*' }));
app.use(express.json());

function getOpenAIClient() {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  return openai;
}

async function fetchUrgeMemory(userId) {
  if (!supabase || !userId) {
    return [];
  }

  const { data, error } = await supabase
    .from('urges')
    .select('trigger, emotion, resisted, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

function buildReadableMemory(history) {
  return history?.map((entry) =>
    `Trigger: ${entry.trigger || 'unknown'}, Emotion: ${entry.emotion || 'unknown'}, Resisted: ${Boolean(entry.resisted)}`
  ).join('\n') || 'No previous data';
}

function buildOsaPrompt({ memory, trigger, emotion }) {
  return `
You are OSA.

You speak like a calm Nigerian older brother helping someone control urges.

Your tone:

* grounded
* direct
* emotionally present
* slightly Nigerian (natural, not forced)

Rules:

* max 2 sentences
* no long talk
* no motivational quotes

Examples:
"I dey here. Relax first."
"Stand up. No sit there."
"This feeling go pass."

User history:
${memory}

Current situation:
Trigger: ${trigger}
Emotion: ${emotion}

If pattern repeats, call it out.

Speak now.
`;
}

function extractResponseText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const output = Array.isArray(response?.output) ? response.output : [];
  for (const item of output) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue;

    for (const content of item.content) {
      if (content?.type === 'output_text' && typeof content.text === 'string' && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return OSA_FALLBACK_MESSAGE;
}

function extractResponseAudio(response) {
  if (Array.isArray(response?.output_audio) && response.output_audio[0]?.audio) {
    return response.output_audio[0].audio;
  }

  const output = Array.isArray(response?.output) ? response.output : [];
  for (const item of output) {
    if (item?.type === 'output_audio' && typeof item.data === 'string' && item.data) {
      return item.data;
    }
  }

  return null;
}

async function createInlineAudioResponse(client, prompt) {
  const response = await client.responses.create({
    model: 'gpt-4o-mini',
    input: prompt,
    modalities: ['text', 'audio'],
    audio: {
      voice: 'alloy',
      format: 'mp3',
    },
  });

  return {
    message: extractResponseText(response),
    audio: extractResponseAudio(response),
  };
}

async function createFallbackVoiceResponse(client, prompt) {
  const response = await client.responses.create({
    model: 'gpt-4o-mini',
    input: prompt,
  });

  const message = extractResponseText(response);
  const speech = await client.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: 'alloy',
    input: message,
    response_format: 'mp3',
  });

  return {
    message,
    audio: Buffer.from(await speech.arrayBuffer()).toString('base64'),
  };
}

async function generateOsaReply(client, prompt) {
  try {
    const response = await createInlineAudioResponse(client, prompt);

    if (response.audio) {
      return response;
    }
  } catch (error) {
    console.error('Inline audio response unavailable:', error);
  }

  return createFallbackVoiceResponse(client, prompt);
}

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
    const prompt = buildOsaPrompt({ memory, trigger, emotion });
    const aiResponse = await generateOsaReply(client, prompt);

    res.json({
      message: aiResponse.message || OSA_FALLBACK_MESSAGE,
      audio: aiResponse.audio || null,
    });
  } catch (error) {
    console.error(error);
    res.json({ message: OSA_FALLBACK_MESSAGE, audio: null });
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

app.post('/intervention', async (req, res) => {
  try {
    const {
      userId = null,
      trigger = INTERVENTION_INSERT_DEFAULTS.trigger,
      emotion = INTERVENTION_INSERT_DEFAULTS.emotion,
    } = req.body;

    const client = getOpenAIClient();
    const history = await fetchUrgeMemory(userId);
    const memory = buildReadableMemory(history);
    const prompt = buildOsaPrompt({ memory, trigger, emotion });
    const aiResponse = await generateOsaReply(client, prompt);

    res.json({
      message: aiResponse.message || OSA_FALLBACK_MESSAGE,
      audio: aiResponse.audio || null,
    });
  } catch (error) {
    console.error(error);
    res.json({ message: OSA_FALLBACK_MESSAGE, audio: null });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Voice of Osa backend running on http://localhost:${PORT}`);
});
