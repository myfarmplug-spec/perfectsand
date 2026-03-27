require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.post('/chat', async (req, res) => {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { message } = req.body;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are Osa, a calm, strong, disciplined mentor.
You help users overcome urges, fear, and weakness.
Keep responses short, powerful, and direct.`,
        },
        {
          role: 'user',
          content: message,
        },
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
