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

async function sendLeadEmail(lead, ip) {
  if (!process.env.RESEND_API_KEY) { console.log('[EMAIL] No RESEND_API_KEY configured'); return; }
  const role = lead.role ? ` · ${lead.role}` : '';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Nemo <onboarding@resend.dev>',
      to: ['abarrerolabajos@gmail.com'],
      subject: `Nemo: ${lead.name} from ${lead.company}`,
      html: `<p><strong>${lead.name}</strong>${role} · <strong>${lead.company}</strong> just used your chat.</p><p style="color:#6B7280;font-size:12px">${new Date().toUTCString()} · IP: ${ip}</p>`,
    }),
  });
  const data = await res.json();
  if (!res.ok) console.log('[EMAIL] Resend error:', JSON.stringify(data));
  else console.log('[EMAIL] Sent OK, id:', data.id);
}

async function verifyRecaptcha(token) {
  if (!token || !process.env.RECAPTCHA_SECRET_KEY) return true;
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
  });
  const data = await res.json();
  return data.success && data.score >= 0.5;
}

// In-memory IP rate limit (best-effort: resets if the function instance restarts,
// but catches the vast majority of abuse within a single warm instance)
const IP_LIMIT = 15;
const IP_WINDOW_MS = 24 * 60 * 60 * 1000;
const ipLog = new Map();

function checkIp(ip) {
  const now = Date.now();
  const entry = ipLog.get(ip) || { count: 0, resetAt: now + IP_WINDOW_MS };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + IP_WINDOW_MS; }
  if (entry.count >= IP_LIMIT) return false;
  entry.count++;
  ipLog.set(ip, entry);
  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Count');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

  if (!checkIp(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again tomorrow.' });
  }

  const { messages, lead, recaptchaToken } = req.body;

  const human = await verifyRecaptcha(recaptchaToken);
  if (!human) {
    return res.status(403).json({ error: 'reCAPTCHA verification failed. Please reload and try again.' });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid messages' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Log lead on first message so Alfredo can see who used the chat in Vercel logs
  if (messages.length === 1 && lead && lead.name && lead.company) {
    const role = lead.role ? ` · ${lead.role}` : '';
    console.log(`[LEAD] ${new Date().toISOString()} | ${lead.name} | ${lead.company}${role} | IP: ${ip}`);
    sendLeadEmail(lead, ip).catch(() => {});
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
