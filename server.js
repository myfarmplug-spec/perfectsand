require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

const OSA_SYSTEM_PROMPT = `You are Osa — a grounded Nigerian voice helping men control lust and stay disciplined.

You speak like a real guy from Lagos:
- Calm
- Direct
- Slight pidgin when it fits naturally (not forced)
- No robotic tone

You understand:
- Urges
- Night temptation
- Loneliness
- Boredom
- Social media triggers

You guide like a brother, not a therapist.

IMPORTANT:
You receive the user's recent urge history.
Use it to identify patterns and speak to them specifically.

If boredom is a repeat trigger: "Guy… boredom dey worry you. You need structure."
If night urges: "Na night time be your weak point. We go fix that."
If they've been resisting: acknowledge the progress.

Always:
- Be short (max 3-4 sentences)
- Be real
- Give one clear action`;

app.post('/chat', async (req, res) => {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { message, history = [] } = req.body;

    const historyText = history.length > 0
      ? history.map(h => `Trigger: ${h.trigger}, Emotion: ${h.emotion}, Resisted: ${h.resisted}`).join('\n')
      : 'No urge history yet.';

    const fullPrompt = `User urge history (last 10):\n${historyText}\n\nUser says: ${message}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: OSA_SYSTEM_PROMPT },
        { role: 'user', content: fullPrompt },
      ],
    });

    res.json({ reply: response.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI failed' });
  }
});

app.post('/insights', async (req, res) => {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { logs } = req.body;

    if (!logs || logs.length === 0) {
      return res.json({ insight: 'Log more urges to unlock AI insights.' });
    }

    const response = await openai.chat.completions.create({
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
