/*
 * Galami Gold: investor certification gate.
 *
 * Load synchronously in <head> so gated content never flashes:
 *   <script src="cert.js"></script>
 *
 * Mark restricted content with:
 *   data-cert-gate          a section, blurred with an inline notice over it
 *   <body data-cert-page>   the whole page (everything except <nav>)
 *
 * investor-eligibility.html records a signed statement (Netlify form
 * "investor-certification") and calls GalamiCert.set(). Certification is
 * held in this browser for 12 months, matching the FPO statement validity.
 * This is a soft gate: it orders the flow correctly and creates a record,
 * but it is not access control.
 */
(function () {
  var KEY = 'galami_investor_cert';
  var VALID_MS = 365 * 24 * 60 * 60 * 1000;
  var LABELS = {
    hnw: 'Certified High Net Worth Individual',
    sophisticated: 'Self-Certified Sophisticated Investor'
  };

  function get() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY));
      if (c && c.ts && Date.now() - c.ts < VALID_MS) return c;
    } catch (e) {}
    return null;
  }

  function set(c) {
    c.ts = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    document.documentElement.classList.add('cert-ok');
    return c;
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    document.documentElement.classList.remove('cert-ok');
  }

  // Only same-site relative paths are accepted as a return destination.
  function safeNext(raw, fallback) {
    if (raw && /^[A-Za-z0-9_\-\/.#?=&%]+$/.test(raw) && raw.indexOf('//') === -1 && raw.indexOf(':') === -1) return raw;
    return fallback;
  }

  function certifyUrl(hash) {
    var here = location.pathname.split('/').pop() + location.search + location.hash;
    return 'investor-eligibility.html?next=' + encodeURIComponent(here) + (hash || '#certify');
  }

  window.GalamiCert = { get: get, set: set, clear: clear, safeNext: safeNext, labels: LABELS };

  if (get()) document.documentElement.classList.add('cert-ok');

  var css = [
    'html:not(.cert-ok) [data-cert-gate]{position:relative;min-height:340px}',
    'html:not(.cert-ok) [data-cert-gate]>*:not(.cert-lock){filter:blur(8px);opacity:.55;pointer-events:none;user-select:none}',
    'html:not(.cert-ok) body[data-cert-page]{overflow:hidden}',
    'html:not(.cert-ok) body[data-cert-page]>*:not(nav):not(.cert-lock):not(script){filter:blur(9px);pointer-events:none;user-select:none}',
    'html.cert-ok .cert-lock{display:none!important}',
    '.cert-lock{position:absolute;inset:0;z-index:20;display:flex;align-items:flex-start;justify-content:center;padding:48px 16px 24px;background:rgba(10,10,8,.55)}',
    '.cert-lock.cert-lock-page{position:fixed;z-index:9000;align-items:center;padding:24px 16px;background:rgba(10,10,8,.72);overflow-y:auto}',
    '.cert-lock-card{max-width:540px;width:100%;background:#111109;border:1px solid rgba(201,168,76,.4);border-top:2px solid #c9a84c;padding:36px 32px;text-align:center;font-family:Montserrat,Archivo,sans-serif;color:#f0f0f0;box-shadow:0 30px 80px rgba(0,0,0,.5)}',
    '.cert-lock-eyebrow{font-size:10px;letter-spacing:.25em;text-transform:uppercase;color:#c9a84c;margin-bottom:14px}',
    '.cert-lock-card h3{font-family:Poppins,sans-serif;font-weight:400;font-size:22px;line-height:1.3;color:#fff;margin:0 0 14px}',
    '.cert-lock-card p{font-size:13px;line-height:1.8;color:#b0b0a4;margin:0 0 22px}',
    '.cert-lock-actions{display:flex;flex-direction:column;gap:10px;align-items:center}',
    '.cert-lock-btn{display:inline-block;background:#c9a84c;color:#0a0a08;padding:14px 26px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;text-decoration:none;font-weight:600}',
    '.cert-lock-btn:hover{background:#e8c97a}',
    '.cert-lock-link{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#c9a84c;text-decoration:none}',
    '.cert-lock-link:hover{color:#e8c97a}',
    '.cert-badge{display:none;font-size:11px;letter-spacing:.08em;color:#b0b0a4;border:1px solid rgba(201,168,76,.3);padding:10px 14px;margin-bottom:16px;line-height:1.6}',
    'html.cert-ok .cert-badge{display:block}',
    '.cert-badge strong{color:#c9a84c;font-weight:500}',
    '.cert-badge a{color:#c9a84c}'
  ].join('');
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function lockCard(isPage) {
    var wrap = document.createElement('div');
    wrap.className = 'cert-lock' + (isPage ? ' cert-lock-page' : '');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Investor certification required');
    wrap.innerHTML =
      '<div class="cert-lock-card">' +
        '<div class="cert-lock-eyebrow">Certified Investors Only</div>' +
        '<h3>' + (isPage ? 'This page is restricted' : 'Program details are restricted') + '</h3>' +
        '<p>Information about our investment programs is available only to investors who have certified themselves as a ' +
        '<strong style="color:#f0f0f0;font-weight:500">high net worth individual</strong> or ' +
        '<strong style="color:#f0f0f0;font-weight:500">self-certified sophisticated investor</strong> under the UK Financial Promotion Order. ' +
        'It takes about two minutes.</p>' +
        '<div class="cert-lock-actions">' +
          '<a class="cert-lock-btn" href="' + certifyUrl('#certify') + '">Complete Investor Certification</a>' +
          '<a class="cert-lock-link" href="investor-eligibility.html#who-can-invest">What does this mean? &rarr;</a>' +
          (isPage ? '<a class="cert-lock-link" style="color:#b0b0a4" href="index.html">&larr; Back to homepage</a>' : '') +
        '</div>' +
      '</div>';
    return wrap;
  }

  function fillCertFields(c) {
    document.querySelectorAll('input[name="cert_status"]').forEach(function (i) {
      i.value = c ? LABELS[c.category] || c.category : 'Not certified';
    });
    document.querySelectorAll('input[name="cert_date"]').forEach(function (i) {
      i.value = c ? c.date : '';
    });
    document.querySelectorAll('[data-cert-name]').forEach(function (el) {
      el.textContent = c ? (LABELS[c.category] || c.category) + ' · signed ' + c.date : '';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var c = get();
    fillCertFields(c);
    if (c) return;

    // inert keeps keyboard and screen-reader users out of the blurred content too
    if (document.body.hasAttribute('data-cert-page')) {
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (!/^(NAV|SCRIPT)$/.test(el.tagName)) el.setAttribute('inert', '');
      });
      document.body.appendChild(lockCard(true));
    }
    document.querySelectorAll('[data-cert-gate]').forEach(function (el) {
      Array.prototype.forEach.call(el.children, function (child) { child.setAttribute('inert', ''); });
      el.appendChild(lockCard(false));
    });
  });
})();
