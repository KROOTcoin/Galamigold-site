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

// ── Clean BabyLoveGrowth content before it goes into the page ─────────────
// galamigold.net was the old Wix blog and every page on it is gone, but BabyLoveGrowth content
// still links to it. Each known old page maps to the matching galamigold.com page. This is the
// same list as the galamigold.net rules at the top of _redirects (PR #10): keep the two in step.
const OLD_SITE_PATHS = {
  '/blog': '/news',
  '/blog/tags/gold-as-a-safe-haven-asset-class': '/why-gold-is-a-safe-haven-asset-the-investors-guide',
  '/gold-market-insights': '/insights',
  '/home': '/',
  '/invest-in-gold': '/',
  '/post/6-key-tips-for-gold-traders-to-grow-portfolio-success': '/what-is-disciplined-execution',
  '/post/adalgold-com-alternatives-5': '/news',
  '/post/advantages-of-gold-trading-for-investors': '/advantages-of-wholesale-gold-trading-for-investors',
  '/post/amalfi-gold-com-alternatives-7': '/news',
  '/post/build-trust-gold-trading-platforms-2026-investors': '/how-to-ensure-transparency',
  '/post/capital-deployment-gold-trading-beat-benchmarks-2026': '/capital-deployment-guide-to-gold-for-institutional-investors',
  '/post/earngoldinvest-com-alternatives-7': '/news',
  '/post/essential-tips-evaluating-gold-traders-2026': '/gold-broker-checklist',
  '/post/examples-gold-investment-risks-institutions-2026': '/operational-risk-in-gold-trading-what-you-must-know',
  '/post/gold-as-a-safe-haven-asset-class': '/why-gold-is-a-safe-haven-asset-the-investors-guide',
  '/post/gold-broker-role-institutional-trading-edge-2026': '/gold-broker-roles-2026',
  '/post/gold-investment-strategies-5-10-physical-gold-allocation': '/why-gold-attracts-high-net-worth-investors-18-allocation',
  '/post/gold-investment-strategy-guide-safer-portfolio-growth': '/gold-as-an-asset-class-risk-diversification-and-strategy',
  '/post/gold-investment-terminology-explained-for-institutional-investors': '/what-is-bullion',
  '/post/gold-investment-tfsa-guide-investing-in-gold-through-a-tfsa': '/news',
  '/post/gold-portfolio-diversification-reduces-risk': '/gold-portfolio-diversification',
  '/post/gold-portfolio-risk-management-2026': '/gold-hedging-strategies-institutional-portfolio-stability',
  '/post/gold-safeguarding-60-diversification-cuts-risk-2026': '/gold-portfolio-diversification',
  '/post/gold-tfsa-investment-guide-how-to-invest-in-gold-using-a-tfsa': '/news',
  '/post/gold-trading-platforms-institutional-investors-2026': '/gold-trading-solutions-for-wealth-managers',
  '/post/gold-trading-regulations-2026-aml-penalties-highlight-risks': '/role-of-aml-in-gold-trade',
  '/post/gold-trading-standards-institutional-investors-2026': '/role-of-global-standards-in-gold-trade',
  '/post/gold-trading-step-by-step-institutional-guide-2026': '/step-by-step-gold-transaction-process-2026-guide',
  '/post/gold-trading-strategies-optimize-risk-returns-2026': '/gold-trading-risk-management-strategies-institutions',
  '/post/gold-trading-terminology-institutional-guide-2026': '/iso-4217-xau-explained',
  '/post/goldenmint-net-alternatives-8': '/news',
  '/post/goldiama-com-alternatives-8': '/news',
  '/post/harnessing-technology-optimize-gold-trading-strategies': '/gold-trading-solutions-for-wealth-managers',
  '/post/how-to-build-trust-in-gold-trading-institutions': '/trust-matters-gold-trading',
  '/post/how-to-invest-in-gold-for-portfolio-diversification-2026': '/gold-as-an-asset-class-risk-diversification-and-strategy',
  '/post/how-to-optimize-investment-strategies-gold': '/what-is-gold-asset-structuring',
  '/post/how-to-trade-gold-strategic-portfolio-growth-2026': '/capital-deployment-guide-to-gold-for-institutional-investors',
  '/post/how-trust-shapes-gold-trading-strategies-investors': '/trust-matters-gold-trading',
  '/post/institutional-gold-investing-considerations': '/capital-management-guide',
  '/post/institutional-gold-trading-benefits-portfolio-growth': '/institutional-gold-trading-benefits',
  '/post/key-factors-gold-trading-institutional-investors-2026': '/2026-gold-trading-trends-institutional-investors',
  '/post/lamiegold-com-alternatives-6': '/news',
  '/post/manage-risk-gold-investment': '/gold-trading-risk-management-strategies-institutions',
  '/post/mastering-the-art-of-physical-gold-buying-gold-buying-strategies': '/types-of-physical-gold-products-2026-investor-guide',
  '/post/optimize-gold-transactions-institutional-investors': '/gold-trade-settlement-explained-for-investors-and-traders',
  '/post/partner-gold-traders-risk-management-transparency': '/how-to-select-gold-partners-institutional-guide-2026',
  '/post/physical-gold-trading-guide-institutional-investors': '/what-is-bulk-gold-trading-investors-2026-guide',
  '/post/risk-management-gold-trading': '/gold-trading-risk-management-strategies-institutions',
  '/post/securely-buying-online-gold-bullion-canada-a-comprehensive-guide': '/what-is-bullion',
  '/post/top-gold-asset-examples-portfolio-diversification': '/gold-asset-examples-diversification',
  '/post/trading-gold-vs-other-metals-institutional-insights': '/gold-market-dynamics-explained',
  '/post/trust-in-gold-investment': '/trust-matters-gold-trading',
  '/post/trust-in-gold-investments-2026-portfolio-guide': '/trust-matters-gold-trading',
  '/post/types-gold-trading-choose-best-approach-2026': '/gold-asset-examples-diversification',
  '/post/understanding-the-key-differences-between-buying-physical-gold-and-gold-trading-operations': '/advantages-of-wholesale-gold-trading-for-investors',
  '/post/understanding-the-operational-mechanics-of-physical-gold-trading-and-its-key-components': '/step-by-step-gold-transaction-process-2026-guide',
  '/post/what-is-institutional-gold-trading-complete-guide': '/institutional-gold-trading-benefits',
  '/post/what-is-otc-gold-trading-guide-institutional-investors': '/otc-gold-trading-guide',
  '/post/why-gold-matters-institutional-investors-2026': '/benefits-physical-gold-institutional-investors',
  '/post/why-gold-trading-attracts-investors': '/why-gold-attracts-high-net-worth-investors-18-allocation',
  '/post/why-gold-trading-platform-matters': '/what-is-non-bank-gold-trading-a-2026-investor-guide',
  '/post/why-invest-in-gold-stability': '/why-gold-is-a-safe-haven-asset-the-investors-guide',
  '/work-with-us': '/contact',
};

// Point links to galamigold.net (with or without www) at the matching galamigold.com page,
// root-relative and in the same tab, as PR #9 did for the existing articles. Anything not in the
// list goes to the homepage, like the catch-all rule in _redirects. Then, as PR #9 did, a
// screenshot captioned with the old address gets the alt text "Galami Gold", and any other
// mention of the old address in the text ("Website: https://galamigold.net") names galamigold.com.
function rewriteOldSiteLinks(html) {
  return html.replace(/<a\b[^>]*>/gi, (tag) => {
    const m = tag.match(/\shref\s*=\s*(["'])\s*(?:https?:)?\/\/(?:www\.)?galamigold\.net(?![\w-]|\.\w)([^"'?#]*)[^"']*\1/i);
    if (!m) return tag;
    const oldPath = (m[2] || '').replace(/\/+$/, '').toLowerCase() || '/';
    let target = OLD_SITE_PATHS[oldPath];
    if (!target) {
      if (oldPath !== '/') console.log(`Unmapped galamigold.net link sent to the homepage: ${oldPath}`);
      target = '/';
    }
    return tag
      .replace(m[0], ` href="${target}"`)
      .replace(/\s(?:target|rel)\s*=\s*(["'])[^"']*\1/gi, '');
  })
    .replace(/\salt\s*=\s*(["'])\s*(?:https?:\/\/)?(?:www\.)?galamigold\.net\/?\s*\1/gi, ' alt="Galami Gold"')
    .replace(/(?:www\.)?galamigold\.net(?![\w-]|\.\w)/gi, 'galamigold.com');
}

// The page hero holds the article's one h1. BabyLoveGrowth content starts with its own h1, so
// every h1 in the content becomes a div.article-title, which the CSS styles exactly like the h1
// (the same fix PR #9 made to the existing articles).
function demoteContentHeadings(html) {
  return html
    .replace(/<h1\b([^>]*)>/gi, (tag, attrs) => /\sclass\s*=/i.test(attrs)
      ? `<div${attrs.replace(/(\sclass\s*=\s*)(["'])/i, '$1$2article-title ')}>`
      : `<div class="article-title"${attrs}>`)
    .replace(/<\/h1\s*>/gi, '</div>');
}

function cleanContent(html) {
  return demoteContentHeadings(rewriteOldSiteLinks(html || ''));
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
h1,.article-title{font-family:var(--ff-display);font-size:clamp(1.6rem,2.8vw,2.6rem);font-weight:400;color:#fff;line-height:1.25;max-width:700px}
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
.article-body a.btn-primary{color:var(--obsidian)}
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
    <li><a href="/sierra-leone.html">Sierra Leone Program</a></li>
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
  ${cleanContent(content_html)}
  <div class="article-cta">
    <div style="font-size:0.58rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);margin-bottom:0.8rem;">Invest with Galami Gold</div>
    <h3>Ready to invest in physical gold trade finance?</h3>
    <p>Both the Zambia–Dubai and Sierra Leone–Dubai programs are open to qualified investors. Minimum investments from $115,000 USD or €125,000 EUR.</p>
    <a href="/zambia.html" class="btn-primary">Zambia–Dubai Program</a>
    <a href="/sierra-leone.html" class="btn-primary" style="background:transparent;border:1px solid var(--gold);color:var(--gold);">Sierra Leone–Dubai Program</a>
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
      <div style="font-size:0.75rem;color:var(--ash);line-height:1.8;">accounts@galamigold.com<br>+971 526 88 88 57</div>
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

    // Step 2: Commit to GitHub (backup + triggers if linked)
    try { await commitToGitHub(filename, html); } catch(e) { console.log('GitHub backup failed:', e.message); }

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

// For scripts/check-publish-template.js
exports.buildArticlePage = buildArticlePage;
exports.OLD_SITE_PATHS = OLD_SITE_PATHS;
