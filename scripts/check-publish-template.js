// Checks the article template in netlify/functions/publish.js (the BabyLoveGrowth webhook that
// publishes new articles). Builds a page from a fake article and checks for: one h1 per page,
// no return figures, no links or mentions of the old galamigold.net site, and an old-site list
// that matches the galamigold.net rules in _redirects. Then runs the webhook against a fake
// GitHub API and checks that it only commits to GitHub and never creates a Netlify deploy itself.
// Run:  npm run check:publish        (add a file path to also save the built page there)
const fs = require('fs');
const path = require('path');
const https = require('https');
const assert = require('assert');
const { EventEmitter } = require('events');
const { buildArticlePage, OLD_SITE_PATHS, handler } = require('../netlify/functions/publish.js');

const root = path.join(__dirname, '..');
let failed = 0;
function check(name, fn) {
  try { fn(); console.log(`ok    ${name}`); }
  catch (e) { failed++; console.log(`FAIL  ${name}\n      ${e.message}`); }
}

check('the old-site list matches the galamigold.net rules in _redirects', () => {
  const rules = fs.readFileSync(path.join(root, '_redirects'), 'utf8').split(/\r?\n/)
    .map(line => line.trim().split(/\s+/))
    .filter(([from]) => /^https:\/\/(www\.)?galamigold\.net\//.test(from || ''))
    .map(([from, to]) => [from.replace(/^https:\/\/(www\.)?galamigold\.net/, ''), to.replace(/^https:\/\/galamigold\.com/, '')]);
  assert.ok(rules.length > 0, 'no galamigold.net rules found in _redirects');
  for (const [from, to] of rules) {
    if (from === '/*') assert.strictEqual(to, '/', 'the catch-all rule should go to the homepage');
    else assert.strictEqual(OLD_SITE_PATHS[from], to, `${from} goes to ${to} in _redirects`);
  }
  const inRules = new Set(rules.map(([from]) => from));
  for (const from of Object.keys(OLD_SITE_PATHS)) assert.ok(inRules.has(from), `${from} is missing from _redirects`);
});

// Shaped like real BabyLoveGrowth content: a body h1, links to the old Wix blog in each form seen
// in past articles, a screenshot captioned with the old address, and plain-text mentions.
const article = {
  title: 'Gold Settlement Basics for Investors',
  slug: 'gold-settlement-basics-for-investors',
  metaDescription: 'A fake article for checking the publish template.',
  content_html: [
    '<h1 id="gold-settlement-basics-for-investors" tabindex="-1">Gold Settlement Basics for Investors</h1>',
    '<p>Read <a href="https://galamigold.net/post/risk-management-gold-trading" target="_blank" rel="noopener">risk management</a> first.</p>',
    '<p>See <a href="https://www.galamigold.net/post/what-is-otc-gold-trading-guide-institutional-investors/" target="_blank" rel="noopener">OTC trading</a>.</p>',
    '<p>The <a href="http://galamigold.net/blog?page=2#top">blog</a>.</p>',
    '<p>An <a href="https://galamigold.net/post/a-post-not-in-the-list" target="_blank" rel="noopener">unknown post</a>.</p>',
    '<p><img src="https://example.com/galamigold.jpg" alt="https://galamigold.net"></p>',
    '<p><strong>Website:</strong> <a href="https://galamigold.net" target="_blank" rel="noopener">https://galamigold.net</a></p>',
    '<p>Visit galamigold.net. Or www.galamigold.net to learn more.</p>',
    '<p>Current site: <a href="https://galamigold.com/news" target="_blank" rel="noopener">news</a>. Outside: <a href="https://www.lbma.org.uk/" rel="nofollow noopener noreferrer" target="_blank">LBMA</a>.</p>',
    '<h1 class="lead">A second heading</h1>',
  ].join('\n'),
};
const html = buildArticlePage(article);

check('one h1 per page, the hero title', () => {
  const h1s = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || [];
  assert.deepStrictEqual(h1s, [`<h1>${article.title}</h1>`]);
});

check('content h1s become div.article-title, styled like the h1', () => {
  assert.ok(html.includes('<div class="article-title" id="gold-settlement-basics-for-investors" tabindex="-1">Gold Settlement Basics for Investors</div>'));
  assert.ok(html.includes('<div class="article-title lead">A second heading</div>'));
  assert.ok(html.includes('h1,.article-title{font-family:var(--ff-display)'), 'CSS rule h1,.article-title missing');
});

check('galamigold.net links go to the matching galamigold.com page, same tab', () => {
  for (const link of [
    '<a href="/gold-trading-risk-management-strategies-institutions">risk management</a>',
    '<a href="/otc-gold-trading-guide">OTC trading</a>',
    '<a href="/news">blog</a>',
    '<a href="/">unknown post</a>',
    '<strong>Website:</strong> <a href="/">https://galamigold.com</a>',
  ]) assert.ok(html.includes(link), `missing: ${link}`);
});

check('mentions of galamigold.net in the text name galamigold.com', () => {
  assert.ok(html.includes('<img src="https://example.com/galamigold.jpg" alt="Galami Gold">'), 'screenshot alt text');
  assert.ok(html.includes('<p>Visit galamigold.com. Or galamigold.com to learn more.</p>'), 'plain text');
  assert.ok(!/galamigold\.net/i.test(html), `still mentions galamigold.net: ${(html.match(/.{0,40}galamigold\.net.{0,40}/i) || [])[0]}`);
});

check('other links are left alone', () => {
  assert.ok(html.includes('<a href="https://galamigold.com/news" target="_blank" rel="noopener">news</a>'));
  assert.ok(html.includes('<a href="https://www.lbma.org.uk/" rel="nofollow noopener noreferrer" target="_blank">LBMA</a>'));
});

check('the call to action matches the live articles', () => {
  const cta = (html.match(/<div class="article-cta">[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];
  assert.ok(cta.includes('Minimum investments from $115,000 USD or €125,000 EUR.'), 'minimums');
  assert.ok(cta.includes('class="btn-primary">Zambia–Dubai Program</a>'), 'Zambia button');
  assert.ok(cta.includes('">Sierra Leone–Dubai Program</a>'), 'Sierra Leone button');
  // Without this, .article-body a (gold) beats .btn-primary and the gold button's text disappears.
  assert.ok(html.includes('.article-body a.btn-primary{color:var(--obsidian)}'), 'dark text on the gold button');
});

check('no return figures anywhere in the template', () => {
  const page = buildArticlePage({ title: 'T', slug: 't', content_html: '' });
  const text = page.replace(/<style>[\s\S]*?<\/style>/i, '').replace(/<[^>]*>/g, ' ');
  const hit = text.match(/.{0,40}(\d\s*%|per\s*cent|\/\s*trade|per trade|yield|interest rate).{0,40}/i);
  assert.ok(!hit, `found: ${hit && hit[0].trim()}`);
});

if (process.argv[2]) fs.writeFileSync(process.argv[2], html);

// ── The webhook itself ─────────────────────────────────────────────────────
// It must publish by committing to GitHub main and leave the deploy to that commit's Netlify
// build. A deploy it made itself would hold only the new article, and Netlify deploys are the
// whole site, so every other page, the redirects and the functions would vanish until the build
// landed (that happened with each article from June to August 2026).

// Replaces https.request with a fake that records each call and answers with respond(call).
function fakeHttps(respond) {
  const calls = [];
  const real = https.request;
  https.request = (opts, onResponse) => {
    const call = { method: opts.method, host: opts.hostname, path: opts.path, body: '' };
    calls.push(call);
    const req = new EventEmitter();
    req.write = (chunk) => { call.body += chunk; };
    req.end = () => {
      const { status, body } = respond(call);
      const res = new EventEmitter();
      res.statusCode = status;
      onResponse(res);
      res.emit('data', JSON.stringify(body || {}));
      res.emit('end');
    };
    return req;
  };
  return { calls, restore: () => { https.request = real; } };
}

async function runWebhook(respond, token = 'test-token') {
  const fake = fakeHttps(respond);
  const saved = { token: process.env.GITHUB_TOKEN, log: console.log, error: console.error };
  if (token) process.env.GITHUB_TOKEN = token; else delete process.env.GITHUB_TOKEN;
  console.log = console.error = () => {};
  try {
    const res = await handler({
      httpMethod: 'POST',
      headers: { authorization: `Bearer ${process.env.WEBHOOK_SECRET || ''}` },
      body: JSON.stringify(article),
    });
    return { res, calls: fake.calls };
  } finally {
    fake.restore();
    console.log = saved.log; console.error = saved.error;
    if (saved.token === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = saved.token;
  }
}

// A GitHub API that commits fine; `existing` is the response to the file lookup.
const github = (existing = { status: 404, body: { message: 'Not Found' } }, commit = { status: 201, body: { commit: { sha: 'abc1234def' } } }) =>
  (call) => call.method === 'GET' ? existing : commit;

async function checkAsync(name, fn) {
  try { await fn(); console.log(`ok    ${name}`); }
  catch (e) { failed++; console.log(`FAIL  ${name}\n      ${e.message}`); }
}

(async () => {
  const file = `${article.slug}.html`;

  await checkAsync('publishes by committing the page to GitHub main, same response as before', async () => {
    const { res, calls } = await runWebhook(github());
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.body), { success: true, file, url: `https://galamigold.com/${article.slug}` });
    const put = calls.find(c => c.method === 'PUT');
    assert.ok(put, 'no commit was made');
    assert.strictEqual(put.host, 'api.github.com');
    assert.strictEqual(put.path, `/repos/KROOTcoin/Galamigold-site/contents/${file}`);
    const sent = JSON.parse(put.body);
    assert.strictEqual(sent.branch, 'main');
    assert.strictEqual(sent.message, `Auto-publish: ${file}`);
    assert.strictEqual(Buffer.from(sent.content, 'base64').toString(), html, 'committed page differs from the template output');
  });

  await checkAsync('never calls the Netlify API (no deploy of its own)', async () => {
    const { calls } = await runWebhook(github());
    const hosts = [...new Set(calls.map(c => c.host))];
    assert.deepStrictEqual(hosts, ['api.github.com'], `called ${hosts.join(', ')}`);
  });

  await checkAsync('updates an article that already exists (sends its sha)', async () => {
    const { res, calls } = await runWebhook(github({ status: 200, body: { sha: 'oldsha123' } }));
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(JSON.parse(calls.find(c => c.method === 'PUT').body).sha, 'oldsha123');
  });

  await checkAsync('a failed commit returns an error and deploys nothing', async () => {
    const { res, calls } = await runWebhook(github(undefined, { status: 409, body: { message: 'main was modified' } }));
    assert.strictEqual(res.statusCode, 500);
    assert.match(JSON.parse(res.body).error, /GitHub commit failed \(409\): main was modified/);
    assert.ok(calls.every(c => c.host === 'api.github.com'), 'called something other than GitHub');
  });

  await checkAsync('a failed file lookup (bad token) returns an error before committing', async () => {
    const { res, calls } = await runWebhook(github({ status: 401, body: { message: 'Bad credentials' } }));
    assert.strictEqual(res.statusCode, 500);
    assert.match(JSON.parse(res.body).error, /GitHub file lookup failed \(401\): Bad credentials/);
    assert.ok(!calls.some(c => c.method === 'PUT'), 'committed anyway');
  });

  await checkAsync('no GITHUB_TOKEN returns an error and makes no requests', async () => {
    const { res, calls } = await runWebhook(github(), null);
    assert.strictEqual(res.statusCode, 500);
    assert.match(JSON.parse(res.body).error, /GITHUB_TOKEN is not set/);
    assert.strictEqual(calls.length, 0);
  });

  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exitCode = failed ? 1 : 0;
})();
