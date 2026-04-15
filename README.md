# Xchange — Currency Converter

A clean, production-grade currency converter with multi-currency wallet support, crypto rates, and funding account linking. Deploys as a single `index.html` with zero build steps.

## Features
- **30+ global currencies** across 6 regions + 8 cryptocurrencies
- **Live rates** via ExchangeRate-API (free tier: 1,500 req/month)
- **Fallback mock rates** — works offline, no key required
- **Wallet system** — save balances per currency, persisted in localStorage
- **Transaction history** — log of all saved conversions
- **Funding accounts** — link bank, card, mobile money, or crypto wallets
- **Zero dependencies** — pure HTML/CSS/JS, no build step

## Quick start

```bash
git clone https://github.com/YOUR_USERNAME/xchange.git
cd xchange 
open index.html   # works locally in any browser
```

## Live API setup

1. Get a free key at [exchangerate-api.com](https://www.exchangerate-api.com) (no credit card needed)
2. Open the app → **Settings** → paste your key → **Save & fetch**
3. Rates update automatically every hour (cached in localStorage)

## GitHub Pages deployment

The included GitHub Actions workflow deploys automatically on every push to `main`.

**One-time setup:**
1. Go to your repo → **Settings** → **Pages**
2. Set source to **GitHub Actions**
3. Push to `main` — the workflow handles the rest

Your app will be live at:
```
https://YOUR_USERNAME.github.io/xchange/
```

## Project structure

```
xchange/
├── index.html                  # Entire app — converter, wallet, funding, settings
└── .github/
    └── workflows/
        └── deploy.yml          # GitHub Actions CI/CD → GitHub Pages
```

## Roadmap
- [ ] Integrate Fixer.io / Open Exchange Rates as alternative providers
- [ ] Real funding account OAuth (M-Pesa, Stripe, Plaid)
- [ ] Push notifications for rate alerts
- [ ] PWA / installable mobile widget
- [ ] Multi-currency portfolio chart

## Tech stack
- **Frontend**: HTML5, CSS3 (custom properties), vanilla JS (ES2020)
- **Data**: ExchangeRate-API v6 (REST)
- **Storage**: localStorage (no backend required for MVP)
- **CI/CD**: GitHub Actions → GitHub Pages
