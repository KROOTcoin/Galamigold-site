# Galami Gold — Website

Live site: https://brilliant-pony-87549a.netlify.app  
GitHub: https://github.com/KROOTcoin/Galamigold-site  
Built with: Pure HTML/CSS/JS — hosted on Netlify (drag & drop zip to deploy)

---

## Site Structure

| File | Description |
|------|-------------|
| `index.html` | Homepage — video hero, parallax sections, investment programs, live gold ticker |
| `about.html` | About page — company structure, partners, partnership enquiry form |
| `zambia.html` | Zambia–Dubai Program — full detail, $100K USD, 5% per trade |
| `guinea.html` | Guinea–Dubai Program — full detail, €125K EUR, 2% per trade |
| `insights.html` | Market Insights — live gold prices via gold-api.com, Chart.js chart, calculators |
| `news.html` | News & Blog — 17 static articles linking to Wix blog |
| `contact.html` | Contact page — Netlify Forms investor enquiry |
| `risk.html` | Risk Disclosure — FCA/FSCS regulatory page |
| `privacy.html` | Privacy Policy — UK GDPR compliant |
| `gold-broker-roles-2026.html` | Full article page |
| `institutional-gold-trading-benefits.html` | Full article page |
| `gold-asset-examples-diversification.html` | Full article page |
| `gold-portfolio-diversification.html` | Full article page |
| `otc-gold-trading-guide.html` | Full article page |
| `gold_wall.mp4` | Hero video background (homepage) |
| `refinery_smelting.mp4` | Parallax video background (homepage quote section) |
| `netlify.toml` | Netlify configuration |

---

## Design System

| Token | Value |
|-------|-------|
| `--gold` | `#C9A84C` |
| `--gold-light` | `#E8C97A` |
| `--obsidian` | `#0A0A08` |
| `--deep` | `#111109` |
| `--charcoal` | `#1A1A16` |
| `--smoke` | `#2A2A24` |
| `--ash` | `#B0B0A4` |
| `--ivory` | `#F0F0F0` |
| Display font | Poppins Regular (400) |
| Body font | Montserrat 300/400/500 |

---

## Company Details

- **Parent:** Galami FZCO Dubai — IFZA Business Park, DDP, Premises no-35133-001
- **UK entity:** Galami UK Ltd — 71-75 Shelton Street, Covent Garden, London WC2H 9JQ
- **Import division:** Roycroft Precious Metals Trading FZCO — DSO-IFZA, Dubai Silicon Oasis
- **Refinery partner:** Mamba Gold FZCO (Dubai)
- **Contact:** accounts@galamigold.com · +971 556 125 339

## Investment Programs

| Program | Min | Return | Frequency | Currency | Instrument |
|---------|-----|--------|-----------|----------|------------|
| Zambia–Dubai | $100,000 | 5% per trade | Bi-weekly | USD/USDT | Loan Note — Galami UK Ltd |
| Guinea–Dubai | €125,000 | 2% per trade | Bi-weekly | EUR | Loan Note — Galami UK Ltd |

---

## How to Deploy

1. Make any edits to HTML files
2. Zip all files (files must be at root of zip, NOT inside a subfolder)
3. Go to Netlify dashboard → drag zip onto deploy area
4. Site updates within seconds

```bash
# Quick zip command (run from galamigold-site folder):
zip -j galamigold-deploy.zip *.html *.toml *.mp4
```

---

## APIs Used

- **Gold prices:** https://api.gold-api.com/price/XAU (free, no key, CORS enabled)
- **Price history:** https://api.gold-api.com/price/XAU/history?start_date=...&end_date=...
- **Chart library:** Chart.js v4.4.1 via cdnjs

---

## Blog / BabyLoveGrowth

- BabyLoveGrowth.ai publishes articles to Wix blog at galamigold.net/blog
- The news.html page is **static** — manually updated when new posts go live
- To add new articles: share new Wix blog post URLs and they'll be added to news.html
- 5 articles have full local pages; 12 link to Wix directly

---

## Future Improvements

- [ ] Connect custom domain galamigold.net to Netlify
- [ ] Set up Netlify Forms email notifications in dashboard
- [ ] Build remaining 12 article pages locally
- [ ] Submit sitemap to Google Search Console once domain connected
- [ ] GitHub Actions for auto blog updates
