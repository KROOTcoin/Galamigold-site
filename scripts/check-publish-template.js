// Checks the article template in netlify/functions/publish.js (the BabyLoveGrowth webhook that
// publishes new articles). Builds a page from a fake article and checks for: one h1 per page,
// no return figures, no links or mentions of the old galamigold.net site, and an old-site list
// that matches the galamigold.net rules in _redirects.
// Run:  npm run check:publish        (add a file path to also save the built page there)
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { buildArticlePage, OLD_SITE_PATHS } = require('../netlify/functions/publish.js');

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
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exitCode = failed ? 1 : 0;
