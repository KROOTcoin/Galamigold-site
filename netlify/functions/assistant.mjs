// Galami Gold site assistant: POST /.netlify/functions/assistant
//
// Body: { messages: [{ role: "user"|"assistant", content: string }], certified: boolean }
// Reply: the assistant's answer as a streamed text/plain body.
//
// Environment (set in Netlify > Site configuration > Environment variables):
//   ANTHROPIC_API_KEY   required
//   ASSISTANT_MODEL     optional, default claude-opus-5-5
//   ASSISTANT_EFFORT    optional, default low (low | medium | high)
//   LEAD_POST_URL       optional, where leads are posted; default is this
//                       site's own URL, which Netlify Forms picks up as the
//                       "assistant-lead" form (defined hidden in contact.html)
//
// Leads: when a visitor gives their name and a contact, the model calls the
// submit_lead tool. The lead (with the chat transcript) is posted to Netlify
// Forms, so it appears under Forms > assistant-lead and in any form
// notification emails set up there.
//
// "certified" comes from the visitor's browser (cert.js), so like the page
// gate it orders the flow rather than enforcing access. Program details it
// unlocks are the same ones the certified pages already show.

import Anthropic from '@anthropic-ai/sdk';
import promptLib from '../assistant/prompt.js';

const { SYSTEM } = promptLib;

const MODEL = process.env.ASSISTANT_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.ASSISTANT_EFFORT || 'low';
const MAX_TURNS = 20;          // messages kept from the conversation
const MAX_CHARS = 1500;        // per visitor message
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30;           // requests per IP per window, per function instance

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?galamigold\.com$/,
  /^https:\/\/[a-z0-9-]+(--[a-z0-9-]+)?\.netlify\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

const FALLBACK_TEXT =
  "Sorry, I can't help with that here. For anything about Galami Gold, please contact our investor relations team at accounts@galamigold.com or +971 526 88 88 57.";

const LEAD_TYPES = ['investor', 'gold_seller', 'gold_buyer', 'mining_company', 'partner', 'other'];
const TOOLS = [{
  name: 'submit_lead',
  description: "Pass a visitor's enquiry and contact details to Galami's senior team. Call it once the visitor has given their name and at least one way to contact them (email or phone/WhatsApp). Include everything learned in the conversation in summary.",
  eager_input_streaming: true,
  input_schema: {
    type: 'object',
    properties: {
      lead_type: { type: 'string', enum: LEAD_TYPES },
      name: { type: 'string' },
      company: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string', description: 'Phone or WhatsApp number' },
      country: { type: 'string' },
      summary: { type: 'string', description: 'What they want and every useful detail: amounts, volumes, origin, form, terms, timing, prepayment stance, funding needed.' },
    },
    required: ['lead_type', 'name', 'summary'],
  },
}];

function str(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }

async function submitLead(input, { messages, certified, base }) {
  if (!input || typeof input !== 'object') return 'Invalid input. Ask the visitor to confirm their name and contact details.';
  const lead = {
    lead_type: LEAD_TYPES.includes(input.lead_type) ? input.lead_type : 'other',
    name: str(input.name, 200),
    company: str(input.company, 200),
    email: str(input.email, 200),
    phone: str(input.phone, 60),
    country: str(input.country, 100),
    summary: str(input.summary, 4000),
  };
  if (!lead.name || !(lead.email || lead.phone)) {
    return 'Not submitted: a name and an email or phone number are needed. Ask the visitor for them.';
  }
  const transcript = messages
    .map(m => (m.role === 'user' ? 'Visitor: ' : 'Assistant: ') +
      (typeof m.content === 'string' ? m.content : m.content.filter(b => b.type === 'text').map(b => b.text).join(' ')))
    .join('\n\n').slice(-8000);
  const form = new URLSearchParams({
    'form-name': 'assistant-lead',
    ...lead,
    certified: certified ? 'yes' : 'no',
    transcript,
  });
  try {
    const url = process.env.LEAD_POST_URL || (base + '/');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    console.log('lead submitted', lead.lead_type);
    return 'Lead passed to the senior team.';
  } catch (err) {
    // Keep the lead recoverable from the function logs.
    console.error('LEAD NOT SAVED', err?.message || err, JSON.stringify(lead));
    return 'Saving failed. Thank the visitor and ask them to also email accounts@galamigold.com or call +971 526 88 88 57 so nothing is missed.';
  }
}

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_MAX;
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Keep only well-formed turns, trimmed, alternating, starting and ending with the visitor.
function cleanMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = [];
  for (const m of raw.slice(-MAX_TURNS)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return null;
    const content = m.content.trim().slice(0, m.role === 'user' ? MAX_CHARS : 6000);
    if (!content) continue;
    const last = msgs[msgs.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + content;
    else msgs.push({ role: m.role, content });
  }
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return null;
  return msgs;
}

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.some(re => re.test(origin))) return json(403, { error: 'Forbidden' });

  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: 'Assistant is not configured' });

  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  if (rateLimited(ip)) return json(429, { error: 'Too many messages. Please wait a few minutes.' });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request' }); }
  const messages = cleanMessages(body?.messages);
  if (!messages) return json(400, { error: 'Bad request' });

  const certified = body.certified === true;
  const system = certified ? SYSTEM.certified : SYSTEM.uncertified;
  const base = process.env.URL || new URL(req.url).origin;
  const client = new Anthropic();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let sent = false;
      try {
        const convo = [...messages];
        let final;
        for (let round = 0; round < 3; round++) {
          let gap = sent;   // separate text from a previous round
          const s = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 4000,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            output_config: { effort: EFFORT },
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            tools: TOOLS,
            messages: convo,
          });
          for await (const event of s) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              if (gap) { controller.enqueue(encoder.encode('\n\n')); gap = false; }
              controller.enqueue(encoder.encode(event.delta.text));
              sent = true;
            }
          }
          final = await s.finalMessage();
          if (final.stop_reason !== 'tool_use') break;
          const results = [];
          for (const block of final.content) {
            if (block.type !== 'tool_use') continue;
            const out = block.name === 'submit_lead'
              ? await submitLead(block.input, { messages, certified, base })
              : 'Unknown tool.';
            results.push({ type: 'tool_result', tool_use_id: block.id, content: out });
          }
          convo.push({ role: 'assistant', content: final.content });
          convo.push({ role: 'user', content: results });
        }
        if (final?.stop_reason === 'refusal') {
          controller.enqueue(encoder.encode((sent ? '\n\n' : '') + FALLBACK_TEXT));
        } else if (!sent) {
          controller.enqueue(encoder.encode(FALLBACK_TEXT));
        }
      } catch (err) {
        console.error('assistant error', err?.status || '', err?.message || err);
        controller.enqueue(encoder.encode((sent ? '\n\n' : '') +
          "Sorry, the assistant is unavailable right now. You can reach investor relations at accounts@galamigold.com or +971 526 88 88 57."));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
