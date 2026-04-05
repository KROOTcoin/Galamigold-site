// BabyLoveGrowth → Netlify Auto-Publish
// Receives article from BabyLoveGrowth webhook
// Uploads directly to Netlify via their Files API (no GitHub needed)

const https = require('https');

const WEBHOOK_SECRET  = process.env.WEBHOOK_SECRET;
const NETLIFY_TOKEN   = process.env.NETLIFY_TOKEN;   // Netlify personal access token
const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID; // Your site ID

// ── Helper: HTTPS request ──────────────────────────────────────────────────
function request(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Also commit to GitHub for backup ──────────────────────────────────────
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO  = 'KROOTcoin/Galamigold-site';

async function commitToGitHub(filename, content) {
  if (!GITHUB_TOKEN) return;
  const encoded = Buffer.from(content).toString('base64');
  // Check if file exists
  const existing = await request('GET', 'api.github.com', 
    `/repos/${GITHUB_REPO}/contents/${filename}?ref=main`,
    { 'Authorization': `token ${GITHUB_TOKEN}`, 'User-Agent': 'GalamiGold' }
  );
  const sha = existing.status === 200 ? existing.body.sha : undefined;
  await request('PUT', 'api.github.com',
    `/repos/${GITHUB_REPO}/contents/${filename}`,
    { 'Authorization': `token ${GITHUB_TOKEN}`, 'User-Agent': 'GalamiGold' },
    { message: `Auto-publish: ${filename}`, content: encoded, branch: 'main', ...(sha ? { sha } : {}) }
  );
}

// ── Build styled article HTML ──────────────────────────────────────────────
function buildArticlePage(article) {
  const { title, slug, metaDescription, content_html, heroImageUrl, jsonLd, faqJsonLd } = article;
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const schemaScript = jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : '';
  const faqScript = faqJsonLd ? `<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</script>` : '';
  const heroStyle = heroImageUrl
    ? `background-image:url('${heroImageUrl}');background-size:cover;background-position:center;`
    : 'background:var(--deep);';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} | Galami Gold</title>
<meta name="description" content="${metaDescription || ''}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://galamigold.com/${slug}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${metaDescription || ''}">
<meta property="og:url" content="https://galamigold.com/${slug}">
<meta property="og:site_name" content="Galami Gold">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600&display=swap" onload="this.onload=null;this.rel='stylesheet'">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
${schemaScript}${faqScript}
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--gold:#C9A84C;--gold-light:#E8C97A;--obsidian:#0A0A08;--deep:#111109;--charcoal:#1A1A16;--smoke:#2A2A24;--ash:#B0B0A4;--ivory:#F0F0F0;--ff-display:'Poppins',sans-serif;--ff-body:'Montserrat',sans-serif}
body{font-family:var(--ff-body);background:var(--obsidian);color:var(--ivory);overflow-x:hidden;font-weight:300}
nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:1.2rem 5%;background:rgba(10,10,8,0.97);backdrop-filter:blur(4px);border-bottom:1px solid rgba(201,168,76,0.1)}
.nav-links{display:flex;gap:2rem;list-style:none}
.nav-links a{color:var(--ash);text-decoration:none;font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;transition:color 0.3s}
.nav-links a:hover{color:var(--gold)}
.nav-cta{border:1px solid var(--gold);color:var(--gold);padding:0.5rem 1.3rem;font-size:0.62rem;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;transition:all 0.3s}
.nav-cta:hover{background:var(--gold);color:var(--obsidian)}
.article-hero{position:relative;height:55vh;min-height:380px;overflow:hidden;margin-top:80px;${heroStyle}}
.article-hero-overlay{position:absolute;inset:0;background:linear-gradient(to right,rgba(10,10,8,0.9) 0%,rgba(10,10,8,0.5) 100%)}
.article-hero-content{position:relative;z-index:2;height:100%;display:flex;align-items:flex-end;padding:0 5% 4rem}
.eyebrow{font-size:0.58rem;letter-spacing:0.25em;text-transform:uppercase;color:var(--gold);margin-bottom:1rem;display:flex;align-items:center;gap:0.8rem}
.eyebrow::before{content:"";display:block;width:24px;height:1px;background:var(--gold)}
h1{font-family:var(--ff-display);font-size:clamp(1.6rem,2.8vw,2.6rem);font-weight:400;color:#fff;line-height:1.25;max-width:700px}
.article-body{max-width:800px;margin:0 auto;padding:4rem 5%}
.article-body h2{font-family:var(--ff-display);font-size:1.5rem;font-weight:400;color:var(--ivory);margin:2.5rem 0 1rem;padding-top:2rem;border-top:1px solid var(--smoke)}
.article-body h3{font-size:1.1rem;color:var(--ivory);margin:1.5rem 0 0.8rem}
.article-body p{font-size:0.87rem;line-height:2;color:var(--ash);margin-bottom:1.3rem}
.article-body ul,.article-body ol{margin:1rem 0 1.5rem 1.5rem;color:var(--ash);font-size:0.85rem;line-height:2}
.article-body a{color:var(--gold);text-decoration:none}
.article-body table{width:100%;border-collapse:collapse;margin:2rem 0;font-size:0.82rem}
.article-body th{background:var(--charcoal);color:var(--gold);padding:0.8rem 1rem;text-align:left;font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase}
.article-body td{padding:0.8rem 1rem;border-bottom:1px solid var(--smoke);color:var(--ash)}
.article-back{display:inline-flex;align-items:center;gap:0.5rem;font-size:0.62rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--ash);text-decoration:none;margin-bottom:2.5rem;transition:color 0.2s}
.article-back:hover{color:var(--gold)}
.article-back::before{content:"←"}
.article-cta{background:var(--charcoal);border-left:2px solid var(--gold);padding:2.5rem 3rem;margin:3rem 0}
.article-cta h3{font-family:var(--ff-display);font-size:1.4rem;margin-bottom:1rem;color:var(--ivory);font-weight:400}
.article-cta p{margin-bottom:1.5rem}
.btn-primary{background:var(--gold);color:var(--obsidian);padding:0.9rem 2rem;font-family:var(--ff-body);font-size:0.62rem;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;font-weight:500;display:inline-block;margin-right:1rem}
.gold-divider{width:50px;height:1px;background:linear-gradient(to right,var(--gold),transparent);margin:1.5rem 0}
footer{background:var(--deep);padding:4rem 5% 2.5rem;border-top:1px solid var(--smoke);margin-top:5rem}
.footer-bottom{border-top:1px solid var(--smoke);padding-top:1.5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;margin-top:3rem}
.footer-copy{font-size:0.65rem;color:var(--ash)}
@media(max-width:900px){.nav-links{display:none}}
</style>
</head>
<body>
<nav>
  <a href="/" style="display:flex;align-items:center;text-decoration:none;">
    <img src="/favicon-32.png" alt="Galami Gold" style="height:32px;width:auto;margin-right:0.5rem;">
    <span style="font-family:var(--ff-display);font-size:1.1rem;color:var(--gold);letter-spacing:0.05em;">GALAMI <span style="color:var(--ivory);font-weight:300;">GOLD</span></span>
  </a>
  <ul class="nav-links">
    <li><a href="/about.html">About</a></li>
    <li><a href="/zambia.html">Zambia Program</a></li>
    <li><a href="/guinea.html">Guinea Program</a></li>
    <li><a href="/insights.html">Market Insights</a></li>
    <li><a href="/news.html">News</a></li>
    <li><a href="/contact.html">Contact</a></li>
  </ul>
  <a href="/contact.html" class="nav-cta">Enquire Now</a>
</nav>
<div class="article-hero">
  <div class="article-hero-overlay"></div>
  <div class="article-hero-content">
    <div>
      <div class="eyebrow">Galami Gold · Research &amp; Analysis · ${date}</div>
      <h1>${title}</h1>
    </div>
  </div>
</div>
<div class="article-body">
  <a href="/news.html" class="article-back">Back to News</a>
  <div class="gold-divider"></div>
  ${content_html}
  <div class="article-cta">
    <div style="font-size:0.58rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);margin-bottom:0.8rem;">Invest with Galami Gold</div>
    <h3>Ready to invest in physical gold trade finance?</h3>
    <p>Both the Zambia–Dubai and Guinea–Dubai programs are open to qualified investors. Minimum investments from $100,000 USD or €125,000 EUR.</p>
    <a href="/zambia.html" class="btn-primary">Zambia Program — 5% / trade</a>
    <a href="/guinea.html" class="btn-primary" style="background:transparent;border:1px solid var(--gold);color:var(--gold);">Guinea Program — 2% / trade</a>
  </div>
</div>
<footer>
  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:2rem;margin-bottom:3rem;">
    <div>
      <div style="font-size:0.58rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);margin-bottom:0.5rem;">Dubai HQ</div>
      <div style="font-size:0.75rem;color:var(--ash);line-height:1.8;">Galami FZCO, IFZA Business Park<br>DDP, Premises no-35133-001, Dubai, UAE</div>
    </div>
    <div>
      <div style="font-size:0.58rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);margin-bottom:0.5rem;">Contact</div>
      <div style="font-size:0.75rem;color:var(--ash);line-height:1.8;">accounts@galamigold.com<br>+971 556 125 339</div>
    </div>
  </div>
  <div class="footer-bottom">
    <p class="footer-copy">© ${new Date().getFullYear()} Galami FZCO Dubai. All rights reserved.</p>
    <div style="display:flex;gap:1.5rem;">
      <a href="/privacy.html" style="font-size:0.65rem;color:var(--ash);text-decoration:none;">Privacy</a>
      <a href="/risk.html" style="font-size:0.65rem;color:var(--ash);text-decoration:none;">Risk Disclosure</a>
    </div>
  </div>
</footer>
</body>
</html>`;
}


// ── Update news.html in GitHub with new article card ──────────────────────
async function updateNewsPage(slug, title, metaDescription, heroImageUrl) {
  if (!GITHUB_TOKEN) return;
  
  // Fetch current news.html from GitHub
  const fileRes = await request('GET', 'api.github.com',
    `/repos/${GITHUB_REPO}/contents/news.html?ref=main`,
    { 'Authorization': `token ${GITHUB_TOKEN}`, 'User-Agent': 'GalamiGold' }
  );
  if (fileRes.status !== 200) throw new Error('Could not fetch news.html');
  
  const currentHtml = Buffer.from(fileRes.body.content, 'base64').toString('utf8');
  const sha = fileRes.body.sha;
  
  // Build new card
  const imgUrl = heroImageUrl || 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=600&q=80';
  const desc = (metaDescription || '').substring(0, 150);
  const newCard = `<a href="${slug}" class="post-card" data-tag="Market Analysis" style="position:relative;">
  <div class="post-img-wrap"><div class="post-img" style="height:210px;background-image:url('${imgUrl}');"></div></div>
  <div style="padding:1.8rem 2rem;">
    <div class="post-tag">Market Analysis</div>
    <h3 style="font-family:var(--ff-display);font-size:1.15rem;font-weight:400;color:var(--ivory);line-height:1.4;margin-bottom:0.8rem;">${title}</h3>
    <p style="font-size:0.75rem;color:var(--ash);line-height:1.8;margin-bottom:1rem;">${desc}</p>
    <div class="post-meta">Apr 2026 · 5 min <span style="color:var(--gold);margin-left:auto;">Read article →</span></div>
  </div>
</a>`;

  // Insert before the first existing post-card
  const insertPoint = currentHtml.indexOf('class="post-card"');
  if (insertPoint === -1) throw new Error('Could not find post-card insertion point');
  
  // Go back to find the opening <a tag
  const aTagStart = currentHtml.lastIndexOf('<a ', insertPoint);
  const updatedHtml = currentHtml.slice(0, aTagStart) + newCard + '\n  ' + currentHtml.slice(aTagStart);
  
  // Commit updated news.html
  await request('PUT', 'api.github.com',
    `/repos/${GITHUB_REPO}/contents/news.html`,
    { 'Authorization': `token ${GITHUB_TOKEN}`, 'User-Agent': 'GalamiGold' },
    { 
      message: `Add article to news page: ${title}`,
      content: Buffer.from(updatedHtml).toString('base64'),
      branch: 'main',
      sha
    }
  );
}

// ── Main handler ───────────────────────────────────────────────────────────
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  // Verify secret
  const auth = event.headers['authorization'] || event.headers['Authorization'] || '';
  if (WEBHOOK_SECRET && auth.replace('Bearer ', '') !== WEBHOOK_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  try {
    const article = JSON.parse(event.body);
    const { slug, title } = article;
    if (!slug || !title) return { statusCode: 400, body: 'Missing slug or title' };

    const html = buildArticlePage(article);
    const filename = `${slug}.html`;

    // Step 1: Get latest deploy to find deploy ID for file upload
    const deploysRes = await request('GET', 'api.netlify.com',
      `/api/v1/sites/${NETLIFY_SITE_ID}/deploys?per_page=1`,
      { 'Authorization': `Bearer ${NETLIFY_TOKEN}` }
    );

    // Step 2: Commit article to GitHub
    try { 
      await commitToGitHub(filename, html);
      console.log('Article committed to GitHub');
      // Step 2b: Update news.html in GitHub
      await updateNewsPage(slug, title, article.metaDescription, article.heroImageUrl);
      console.log('news.html updated in GitHub');
    } catch(e) { console.log('GitHub commit failed:', e.message); }

    // Step 3: Create a new deploy with the file
    const deployRes = await request('POST', 'api.netlify.com',
      `/api/v1/sites/${NETLIFY_SITE_ID}/deploys`,
      { 'Authorization': `Bearer ${NETLIFY_TOKEN}` },
      { files: { [`/${filename}`]: require('crypto').createHash('sha1').update(html).digest('hex') }, async: false }
    );

    if (deployRes.status !== 200 && deployRes.status !== 201) {
      throw new Error(`Deploy create failed: ${JSON.stringify(deployRes.body)}`);
    }

    const deployId = deployRes.body.id;
    const required = deployRes.body.required || [];
    console.log(`Deploy ${deployId} created, required files: ${required.length}`);

    // Step 4: Upload the file if required
    if (required.length > 0) {
      const uploadRes = await new Promise((resolve, reject) => {
        const fileData = Buffer.from(html);
        const req = https.request({
          hostname: 'api.netlify.com',
          path: `/api/v1/deploys/${deployId}/files/${filename}`,
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${NETLIFY_TOKEN}`,
            'Content-Type': 'application/octet-stream',
            'Content-Length': fileData.length
          }
        }, (res) => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => resolve({ status: res.statusCode }));
        });
        req.on('error', reject);
        req.write(fileData);
        req.end();
      });
      console.log(`File uploaded: ${uploadRes.status}`);
    }

    console.log(`✓ Published: ${filename}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, file: filename, url: `https://galamigold.com/${slug}` })
    };

  } catch (err) {
    console.error('Publish error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
