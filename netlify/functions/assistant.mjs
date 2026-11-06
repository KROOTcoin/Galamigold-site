// Galami Gold site assistant: POST /.netlify/functions/assistant
//
// Body: { messages: [{ role: "user"|"assistant", content: string }], certified: boolean }
// Reply: the assistant's answer as a streamed text/plain body.
//
// Environment (set in Netlify > Site configuration > Environment variables):
//   ANTHROPIC_API_KEY   required
//   ASSISTANT_MODEL     optional, default claude-opus-5-5
//   ASSISTANT_EFFORT    optional, default low (low | medium | high)
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

  const system = body.certified === true ? SYSTEM.certified : SYSTEM.uncertified;
  const client = new Anthropic();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let sent = false;
      try {
        const s = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 4000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: EFFORT },
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          messages,
        });
        for await (const event of s) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
            sent = true;
          }
        }
        const final = await s.finalMessage();
        if (final.stop_reason === 'refusal') {
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
