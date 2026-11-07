/*
 * Galami Gold: site assistant chat widget.
 *
 * Load on any page, before </body>:
 *   <script src="assistant.js" defer></script>
 *
 * Talks to netlify/functions/assistant.mjs. Reads investor certification
 * from cert.js (window.GalamiCert) or, on pages without cert.js, from the
 * same localStorage key. The conversation is kept in sessionStorage so it
 * survives moving between pages in one visit.
 */
(function () {
  if (window.__galamiAssistant) return;
  window.__galamiAssistant = true;

  var ENDPOINT = '/.netlify/functions/assistant';
  var STORE = 'galami_assistant_chat';
  var CERT_KEY = 'galami_investor_cert';
  var CERT_MS = 365 * 24 * 60 * 60 * 1000;
  var GREETING = 'Hello, and welcome to Galami Gold. Whether you are looking to invest, buy or sell gold, or raise finance for a mining project, I can help and put you in touch with our team. What brings you here today?';
  var STARTERS = [
    'I am interested in investing',
    'I want to buy gold',
    'I have gold to sell',
    'We are a mine seeking investment'
  ];

  function certified() {
    try {
      if (window.GalamiCert) return !!window.GalamiCert.get();
      var c = JSON.parse(localStorage.getItem(CERT_KEY));
      return !!(c && c.ts && Date.now() - c.ts < CERT_MS);
    } catch (e) { return false; }
  }

  function load() {
    try { var m = JSON.parse(sessionStorage.getItem(STORE)); return Array.isArray(m) ? m : []; }
    catch (e) { return []; }
  }
  function save() {
    try { sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-30))); } catch (e) {}
  }

  // ── Minimal, safe markdown: paragraphs, lists, **bold**, site links ─────
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function safeHref(u) {
    if (/^\/[A-Za-z0-9_\-\/.#?=&]*$/.test(u) && u.indexOf('//') === -1) return u;
    if (/^mailto:accounts@galamigold\.com$/i.test(u)) return u;
    return null;
  }
  function inline(s) {
    s = esc(s);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, text, href) {
      var h = safeHref(href.replace(/&amp;/g, '&'));
      return h ? '<a href="' + esc(h) + '">' + text + '</a>' : text;
    });
    s = s.replace(/accounts@galamigold\.com(?![^<]*<\/a>)/g, '<a href="mailto:accounts@galamigold.com">accounts@galamigold.com</a>');
    return s;
  }
  function render(text) {
    var out = [], list = null;
    function flush() {
      if (!list) return;
      out.push('<ul>' + list.map(function (i) {
        return '<li>' + i.text + (i.sub.length ? '<ul><li>' + i.sub.join('</li><li>') + '</li></ul>' : '') + '</li>';
      }).join('') + '</ul>');
      list = null;
    }
    text.split(/\n/).forEach(function (line) {
      var item = line.match(/^(\s*)(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (item) {
        if (!list) { list = []; }
        var li = inline(item[2]);
        if (item[1].length >= 2 && list.length) list[list.length - 1].sub.push(li);
        else list.push({ text: li, sub: [] });
        return;
      }
      flush();
      var h = line.match(/^#{1,4}\s+(.*)$/);
      if (h) out.push('<p><strong>' + inline(h[1]) + '</strong></p>');
      else if (line.trim()) out.push('<p>' + inline(line) + '</p>');
    });
    flush();
    return out.join('');
  }

  // ── Styles ────────────────────────────────────────────────────────────
  var css = [
    '#ga-assistant{--ga-gold:#c9a84c;--ga-gold-l:#e8c97a;--ga-bg:#0d0d0a;--ga-panel:#111109;--ga-line:rgba(201,168,76,.28);--ga-text:#ecebe4;--ga-muted:#a3a296;position:fixed;right:20px;bottom:20px;z-index:9500;font-family:Montserrat,Archivo,system-ui,sans-serif;color:var(--ga-text)}',
    'html:not(.cert-ok) body[data-cert-page]>#ga-assistant{filter:none!important;pointer-events:auto!important;user-select:auto!important}',
    '#ga-assistant *{box-sizing:border-box}',
    '.ga-launch{display:flex;align-items:center;gap:10px;background:var(--ga-panel);color:var(--ga-gold);border:1px solid var(--ga-gold);padding:13px 18px;font:500 11px/1 Montserrat,system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;cursor:pointer;box-shadow:0 12px 40px rgba(0,0,0,.45);transition:background .2s,color .2s}',
    '.ga-launch:hover,.ga-launch:focus-visible{background:var(--ga-gold);color:#0a0a08;outline:none}',
    '.ga-launch svg{width:16px;height:16px;flex:none}',
    '.ga-open .ga-launch{display:none}',
    '.ga-panel{display:none;flex-direction:column;width:380px;max-width:calc(100vw - 32px);height:min(600px,calc(100vh - 40px));background:var(--ga-bg);border:1px solid var(--ga-line);border-top:2px solid var(--ga-gold);box-shadow:0 30px 80px rgba(0,0,0,.6)}',
    '.ga-open .ga-panel{display:flex}',
    '.ga-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--ga-line)}',
    '.ga-title{font:400 15px/1.2 Poppins,system-ui,sans-serif;color:#fff}',
    '.ga-sub{font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--ga-gold);margin-top:4px}',
    '.ga-head-btns{display:flex;gap:4px}',
    '.ga-icon{background:none;border:0;color:var(--ga-muted);cursor:pointer;padding:6px;line-height:0}',
    '.ga-icon:hover,.ga-icon:focus-visible{color:var(--ga-gold);outline:none}',
    '.ga-icon svg{width:16px;height:16px}',
    '.ga-log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}',
    '.ga-msg{max-width:88%;font-size:13px;line-height:1.65;padding:10px 13px}',
    '.ga-msg p{margin:0 0 8px}.ga-msg p:last-child{margin:0}',
    '.ga-msg ul{margin:4px 0 8px;padding-left:18px}.ga-msg li{margin:2px 0}',
    '.ga-msg a{color:var(--ga-gold-l);text-decoration:underline;text-underline-offset:2px}',
    '.ga-msg strong{color:#fff;font-weight:600}',
    '.ga-bot{align-self:flex-start;background:var(--ga-panel);border:1px solid rgba(201,168,76,.14)}',
    '.ga-user{align-self:flex-end;background:rgba(201,168,76,.14);border:1px solid rgba(201,168,76,.3);white-space:pre-wrap}',
    '.ga-typing{display:inline-flex;gap:4px;padding:4px 0}',
    '.ga-typing i{width:5px;height:5px;background:var(--ga-gold);border-radius:50%;opacity:.3;animation:ga-b 1.2s infinite}',
    '.ga-typing i:nth-child(2){animation-delay:.2s}.ga-typing i:nth-child(3){animation-delay:.4s}',
    '@keyframes ga-b{0%,80%,100%{opacity:.3}40%{opacity:1}}',
    '.ga-starters{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}',
    '.ga-chip{background:none;border:1px solid var(--ga-line);color:var(--ga-text);font:400 11.5px/1.3 Montserrat,system-ui,sans-serif;padding:7px 10px;cursor:pointer;text-align:left}',
    '.ga-chip:hover,.ga-chip:focus-visible{border-color:var(--ga-gold);color:var(--ga-gold-l);outline:none}',
    '.ga-form{display:flex;gap:8px;padding:12px;border-top:1px solid var(--ga-line)}',
    '.ga-input{flex:1;resize:none;background:var(--ga-panel);border:1px solid var(--ga-line);color:var(--ga-text);font:400 13px/1.5 Montserrat,system-ui,sans-serif;padding:9px 11px;max-height:110px;min-height:40px}',
    '.ga-input:focus{outline:none;border-color:var(--ga-gold)}',
    '.ga-input::placeholder{color:#77766c}',
    '.ga-send{background:var(--ga-gold);border:0;color:#0a0a08;width:42px;cursor:pointer;line-height:0;flex:none}',
    '.ga-send:hover,.ga-send:focus-visible{background:var(--ga-gold-l);outline:none}',
    '.ga-send:disabled{opacity:.45;cursor:default}',
    '.ga-send svg{width:16px;height:16px}',
    '.ga-note{font-size:10px;line-height:1.5;color:#86857a;padding:0 12px 10px}',
    '.ga-note a{color:var(--ga-muted)}',
    '@media (max-width:520px){#ga-assistant{right:12px;bottom:12px}.ga-open#ga-assistant{left:0;right:0;bottom:0}.ga-panel{width:100%;max-width:none;height:min(100dvh,640px);border-left:0;border-right:0}.ga-launch{padding:12px 14px}}',
    '@media (prefers-reduced-motion:reduce){.ga-typing i{animation:none;opacity:.7}.ga-log{scroll-behavior:auto}}'
  ].join('');

  var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_RESET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';

  var messages = load();
  var busy = false;
  var root, log, input, sendBtn;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function scroll() { log.scrollTop = log.scrollHeight; }

  function addBubble(role, text) {
    var b = el('div', 'ga-msg ' + (role === 'user' ? 'ga-user' : 'ga-bot'));
    if (role === 'user') b.textContent = text; else b.innerHTML = render(text);
    log.appendChild(b);
    scroll();
    return b;
  }

  function paint() {
    log.innerHTML = '';
    addBubble('assistant', GREETING);
    if (!messages.length) {
      var chips = el('div', 'ga-starters');
      STARTERS.forEach(function (q) {
        var c = el('button', 'ga-chip');
        c.type = 'button';
        c.textContent = q;
        c.addEventListener('click', function () { send(q); });
        chips.appendChild(c);
      });
      log.appendChild(chips);
    }
    messages.forEach(function (m) { addBubble(m.role, m.content); });
  }

  function setBusy(v) {
    busy = v;
    sendBtn.disabled = v;
  }

  function send(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    var chips = log.querySelector('.ga-starters');
    if (chips) chips.remove();
    messages.push({ role: 'user', content: text.slice(0, 1500) });
    save();
    addBubble('user', text);
    input.value = '';
    autosize();
    setBusy(true);

    var bubble = el('div', 'ga-msg ga-bot', '<span class="ga-typing" aria-label="Assistant is typing"><i></i><i></i><i></i></span>');
    log.appendChild(bubble);
    scroll();

    var reply = '';
    function finish(text, keep) {
      reply = text;
      bubble.innerHTML = render(reply);
      if (keep) { messages.push({ role: 'assistant', content: reply }); save(); }
      else { messages.pop(); save(); }
      setBusy(false);
      scroll();
      input.focus();
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages, certified: certified() })
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          throw new Error(j && j.error ? j.error : 'unavailable');
        });
      }
      if (!res.body || !res.body.getReader) return res.text().then(function (t) { finish(t, true); });
      var reader = res.body.getReader();
      var dec = new TextDecoder();
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { finish(reply + dec.decode(), true); return; }
          reply += dec.decode(r.value, { stream: true });
          bubble.innerHTML = render(reply);
          scroll();
          return pump();
        });
      }
      return pump();
    }).catch(function (err) {
      var msg = err && /too many/i.test(err.message) ? err.message :
        'Sorry, the assistant is unavailable right now. You can reach investor relations at accounts@galamigold.com or +971 526 88 88 57.';
      finish(msg, false);
    });
  }

  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 110) + 'px';
  }

  function open() {
    root.classList.add('ga-open');
    try { sessionStorage.setItem(STORE + '_open', '1'); } catch (e) {}
    scroll();
    input.focus();
  }
  function close() {
    root.classList.remove('ga-open');
    try { sessionStorage.removeItem(STORE + '_open'); } catch (e) {}
    root.querySelector('.ga-launch').focus();
  }

  function build() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    root = el('div');
    root.id = 'ga-assistant';
    root.innerHTML =
      '<button type="button" class="ga-launch" aria-haspopup="dialog" aria-controls="ga-panel">' + ICON_CHAT + 'Ask Galami</button>' +
      '<div class="ga-panel" id="ga-panel" role="dialog" aria-label="Galami Gold assistant">' +
        '<div class="ga-head"><div><div class="ga-title">Galami Gold Assistant</div><div class="ga-sub">AI · Investor Relations</div></div>' +
          '<div class="ga-head-btns">' +
            '<button type="button" class="ga-icon ga-reset" aria-label="Start a new conversation" title="New conversation">' + ICON_RESET + '</button>' +
            '<button type="button" class="ga-icon ga-close" aria-label="Close assistant" title="Close">' + ICON_CLOSE + '</button>' +
          '</div></div>' +
        '<div class="ga-log" aria-live="polite"></div>' +
        '<form class="ga-form"><textarea class="ga-input" rows="1" maxlength="1500" placeholder="Type your message…" aria-label="Your question"></textarea>' +
          '<button type="submit" class="ga-send" aria-label="Send">' + ICON_SEND + '</button></form>' +
        '<div class="ga-note">AI assistant. Answers may be incomplete and are not financial advice. Contact details you share are passed to our team (see our <a href="/privacy.html#assistant">Privacy Policy</a>). Capital at risk; see our <a href="/risk.html">Risk Disclosure</a>.</div>' +
      '</div>';
    document.body.appendChild(root);

    log = root.querySelector('.ga-log');
    input = root.querySelector('.ga-input');
    sendBtn = root.querySelector('.ga-send');

    root.querySelector('.ga-launch').addEventListener('click', open);
    root.querySelector('.ga-close').addEventListener('click', close);
    root.querySelector('.ga-reset').addEventListener('click', function () {
      if (busy) return;
      messages = [];
      save();
      paint();
      input.focus();
    });
    root.querySelector('.ga-form').addEventListener('submit', function (e) {
      e.preventDefault();
      send(input.value);
    });
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('ga-open')) close();
    });

    paint();
    try { if (sessionStorage.getItem(STORE + '_open')) root.classList.add('ga-open'); } catch (e) {}
  }

  // After load, so cert.js has already locked gated pages (it marks the
  // page's existing children inert on DOMContentLoaded).
  if (document.readyState === 'complete') build();
  else window.addEventListener('load', build);
})();
