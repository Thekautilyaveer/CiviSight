const logger = require('./logger');

const GEMINI_MODEL = 'gemini-2.5-flash';

// Ask Gemini whether a chat message is a request to raise a support ticket,
// and extract a subject/details plus a friendly reply. Returns a structured object.
const interpretMessage = async (message) => {
  const key = process.env.GEMINI_API;
  if (!key) {
    throw new Error('GEMINI_API is not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

  const prompt = `You are the support assistant for CiviSight, a government compliance dashboard used by Georgia counties and the ACCG.

Decide whether the user's message is asking to RAISE / OPEN a support ticket (for example: they literally say "raise a ticket", or they report a bug/problem, or request help that needs human follow-up).

Respond with ONLY a JSON object of this exact shape:
{
  "isTicket": boolean,        // true if a support ticket should be created
  "subject": string,          // short ticket subject (max ~8 words); "" if not a ticket
  "details": string,          // a clear 1-3 sentence summary of the issue/request; "" if not a ticket
  "reply": string             // a short, friendly chat reply to show the user
}

If isTicket is true, the reply should confirm that a ticket has been raised and that the team will follow up.
If isTicket is false, just answer helpfully in the reply.

User message: """${message}"""`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });
  } catch (err) {
    logger.error('Gemini request failed:', err.message);
    throw err;
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    logger.warn('Gemini returned non-JSON; falling back. Raw:', text.slice(0, 200));
    parsed = { isTicket: false, reply: text || "Sorry, I couldn't process that." };
  }

  return {
    isTicket: !!parsed.isTicket,
    subject: (parsed.subject || '').trim() || 'Support ticket from CiviSight chat',
    details: (parsed.details || '').trim() || message,
    reply: (parsed.reply || '').trim() ||
      (parsed.isTicket ? "I've raised a ticket for you — our team will follow up shortly." : 'How can I help?')
  };
};

module.exports = { interpretMessage };
