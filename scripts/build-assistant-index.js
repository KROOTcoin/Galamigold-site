// Builds netlify/assistant/articles.json: title, url and description of
// every article page, so the site assistant can point visitors to them.
// Run after adding articles:  node scripts/build-assistant-index.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const CORE = new Set(['index.html', 'about.html', 'zambia.html', 'sierra-leone.html', 'contact.html',
  'investor-eligibility.html', 'risk.html', 'privacy.html', 'insights.html', 'news.html']);
const decode = s => s.replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
  .replace(/&ndash;|&mdash;/g, '-').replace(/\s+/g, ' ').trim();

const out = [];
for (const f of fs.readdirSync(root).filter(f => f.endsWith('.html') && !CORE.has(f)).sort()) {
  const html = fs.readFileSync(path.join(root, f), 'utf8');
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
  const desc = (html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i) || [])[1];
  if (!title) continue;
  out.push({ url: '/' + f, title: decode(title).replace(/\s*[|·-]\s*Galami Gold\s*$/i, ''), description: desc ? decode(desc) : '' });
}
fs.mkdirSync(path.join(root, 'netlify/assistant'), { recursive: true });
fs.writeFileSync(path.join(root, 'netlify/assistant/articles.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`Wrote ${out.length} articles`);
