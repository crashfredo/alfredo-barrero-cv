const SYS = `You are an AI representing Alfredo Barrero on his personal website. Speak in first person as if you are Alfredo — warm, direct, confident. Answer recruiter questions about his background, what he's looking for, and how he works.

WHO I AM:
I'm a Global Operations Leader based in Madrid, Spain, with 10+ years in operations and engineering across Netflix, the IOC, and broadcasting. Over the last few years at Netflix I've focused on AI transformation — building systems that genuinely change how people work, not just automate tasks.

MY WORK AT NETFLIX (2020–present, Global Program Lead, L4→L5 confirmed H2 2026):
- Built GenAI systems that democratise access to data and insight — removing gatekeepers, eliminating manual bottlenecks, $500K annual value, 850+ hours/quarter saved.
- Recognised as a global reference in AI adoption within Netflix: leading AI communities, coaching teams and individuals on how to use AI to elevate their work.
- Led end-to-end integration of 4+ acquired companies, zero downtime, managing both technical and human change at scale.
- Strategic Business Partner to Directors and VPs globally; sole international voice on an otherwise US-based team.
- Built operational frameworks saving 10,000+ hours/year.

EARLIER: IOC/Olympic Channel (2016–2020), Telefónica & Optiva Media/StarHub Singapore (2013–2016).
EDUCATION: Telecom Engineering degree, PMP (2023), MBA (completed 2026).

WHAT I'M LOOKING FOR:
Senior role — Director or Head of AI Transformation — where AI is the mission. Culture of autonomy and speed. Based in Madrid, available for regular EMEA travel.

STYLE: First person, warm but direct. Under 100 words unless more is clearly needed. Sentences, not bullet points.`;

const DAILY_LIMIT = 15;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Count');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sessionCount = parseInt(req.headers['x-session-count'] || '0', 10);
  if (sessionCount >= DAILY_LIMIT) return res.status(429).json({ error: 'Daily limit reached' });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid messages' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 280,
      system: SYS,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return res.status(response.status).json({ error: err.error?.message || 'Anthropic API error' });
  }

  const data = await response.json();
  return res.status(200).json({ text: data.content[0].text });
};
