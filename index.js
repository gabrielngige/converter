// ═══════════════════════════════════════════════════════════════════
// DATA LAYER — localStorage persistence
// ═══════════════════════════════════════════════════════════════════

const LS = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k,v) => localStorage.setItem(k, JSON.stringify(v)),
  del: k => localStorage.removeItem(k)
};

function loadState() {
  return {
    apiKey: LS.get('xchange_apiKey') || '',
    baseCur: LS.get('xchange_base') || 'USD',
    rates: LS.get('xchange_rates') || null,
    ratesFetchedAt: LS.get('xchange_fetchedAt') || null,
    wallet: LS.get('xchange_wallet') || {},       // { CODE: { balance, linkedFundingId } }
    txHistory: LS.get('xchange_tx') || [],         // [{ from, to, amtFrom, amtTo, rate, ts }]
    funding: LS.get('xchange_funding') || [],      // [{ id, type, name, number, currencies }]
  };
}

let S = loadState();

function saveWalletState() { LS.set('xchange_wallet', S.wallet); }
function saveTxState()     { LS.set('xchange_tx', S.txHistory); }
function saveFundingState(){ LS.set('xchange_funding', S.funding); }

// ═══════════════════════════════════════════════════════════════════
// CURRENCY / RATE DATA
// ═══════════════════════════════════════════════════════════════════

// Hardcoded fallback rates (USD base) — replaced by live API data when key is set
const FALLBACK_RATES = {
  USD:1, EUR:0.9201, GBP:0.7893, JPY:153.42, CHF:0.9043, CAD:1.3621, AUD:1.5312,
  NZD:1.6589, CNY:7.2351, HKD:7.8201, SGD:1.3412, INR:83.42, MXN:17.12, BRL:5.0231,
  ZAR:18.6401, AED:3.6725, SAR:3.7510, NGN:1601.5, KES:129.85, EGP:48.70,
  TRY:32.15, PLN:3.9821, SEK:10.4123, NOK:10.7821, DKK:6.8642,
  THB:35.21, MYR:4.7123, IDR:15832.5, PHP:57.32, VND:24853.0,
  COP:3921.5, ARS:871.25, CLP:945.12, PKR:278.5, BDT:109.7,
  UAH:38.5, ILS:3.72, CZK:23.41, HUF:359.2, RON:4.57
};

const CRYPTO_DATA = [
  {sym:'BTC', name:'Bitcoin',  rate:67842.30, chg:2.14},
  {sym:'ETH', name:'Ethereum', rate:3521.45,  chg:1.87},
  {sym:'BNB', name:'BNB',      rate:412.33,   chg:-0.54},
  {sym:'SOL', name:'Solana',   rate:182.71,   chg:3.21},
  {sym:'XRP', name:'XRP',      rate:0.5431,   chg:-1.12},
  {sym:'USDC',name:'USD Coin', rate:1.0001,   chg:0.01},
  {sym:'ADA', name:'Cardano',  rate:0.4812,   chg:-2.3},
  {sym:'DOGE',name:'Dogecoin', rate:0.1523,   chg:5.4},
];

const CURRENCY_META = {
  USD:'US Dollar', EUR:'Euro', GBP:'British Pound', JPY:'Japanese Yen', CHF:'Swiss Franc',
  CAD:'Canadian Dollar', AUD:'Australian Dollar', NZD:'New Zealand Dollar', CNY:'Chinese Yuan',
  HKD:'Hong Kong Dollar', SGD:'Singapore Dollar', INR:'Indian Rupee', MXN:'Mexican Peso',
  BRL:'Brazilian Real', ZAR:'South African Rand', AED:'UAE Dirham', SAR:'Saudi Riyal',
  NGN:'Nigerian Naira', KES:'Kenyan Shilling', EGP:'Egyptian Pound', TRY:'Turkish Lira',
  PLN:'Polish Zloty', SEK:'Swedish Krona', NOK:'Norwegian Krone', DKK:'Danish Krone',
  THB:'Thai Baht', MYR:'Malaysian Ringgit', IDR:'Indonesian Rupiah', PHP:'Philippine Peso',
  VND:'Vietnamese Dong', COP:'Colombian Peso', ARS:'Argentine Peso', CLP:'Chilean Peso',
  PKR:'Pakistani Rupee', BDT:'Bangladeshi Taka', UAH:'Ukrainian Hryvnia',
  ILS:'Israeli Shekel', CZK:'Czech Koruna', HUF:'Hungarian Forint', RON:'Romanian Leu',
  BTC:'Bitcoin', ETH:'Ethereum', BNB:'BNB', SOL:'Solana',
  XRP:'XRP', USDC:'USD Coin', ADA:'Cardano', DOGE:'Dogecoin'
};

const GROUPS = {
  'Major':   ['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD','CNY'],
  'Africa & Mid East': ['KES','NGN','ZAR','EGP','AED','SAR'],
  'Asia':    ['HKD','SGD','INR','THB','MYR','IDR','PHP','VND','PKR','BDT'],
  'Americas':['MXN','BRL','COP','ARS','CLP'],
  'Europe':  ['TRY','PLN','SEK','NOK','DKK','UAH','CZK','HUF','RON','ILS'],
  'Crypto':  ['BTC','ETH','BNB','SOL','XRP','USDC','ADA','DOGE']
};

let activeRates = {}; // base=USD always internally
let ratesSource = 'fallback';

function buildRates(rawRatesUSDBase) {
  activeRates = { ...rawRatesUSDBase };
  // Add crypto (rate = USD per 1 crypto)
  CRYPTO_DATA.forEach(c => { activeRates[c.sym] = 1 / c.rate; });
}

function getConvertedRate(from, to) {
  const rFrom = activeRates[from] || 1;
  const rTo   = activeRates[to]   || 1;
  return rTo / rFrom;
}

// ═══════════════════════════════════════════════════════════════════
// API — ExchangeRate-API v6
// ═══════════════════════════════════════════════════════════════════

async function fetchLiveRates(key) {
  const url = `https://v6.exchangerate-api.com/v6/${key}/latest/USD`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.result !== 'success') throw new Error(json['error-type'] || 'API error');
  return json.conversion_rates; // { USD:1, EUR:..., ... }
}

async function loadRates(force = false) {
  setApiStatus('loading');

  // Use cached rates if <1hr old and not forced
  if (!force && S.rates && S.ratesFetchedAt) {
    const age = Date.now() - S.ratesFetchedAt;
    if (age < 60 * 60 * 1000) {
      buildRates(S.rates);
      ratesSource = 'cache';
      setApiStatus('cache');
      convert();
      return;
    }
  }

  if (S.apiKey) {
    try {
      const rates = await fetchLiveRates(S.apiKey);
      S.rates = rates;
      S.ratesFetchedAt = Date.now();
      LS.set('xchange_rates', rates);
      LS.set('xchange_fetchedAt', S.ratesFetchedAt);
      buildRates(rates);
      ratesSource = 'live';
      setApiStatus('live');
    } catch(e) {
      console.warn('API fetch failed:', e.message);
      buildRates(S.rates || FALLBACK_RATES);
      ratesSource = 'error';
      setApiStatus('error', e.message);
    }
  } else {
    buildRates(FALLBACK_RATES);
    ratesSource = 'fallback';
    setApiStatus('fallback');
  }
  convert();
  updateSettingsStats();
}

function setApiStatus(state, errMsg) {
  const dot = document.getElementById('apiDot');
  const msg = document.getElementById('apiMsg');
  dot.className = 'api-dot';
  if (state === 'live') {
    dot.classList.add('live');
    const ts = new Date(S.ratesFetchedAt).toLocaleTimeString();
    msg.innerHTML = `<strong>Live rates</strong> — ExchangeRate-API · fetched ${ts}`;
  } else if (state === 'cache') {
    dot.classList.add('live');
    const ts = new Date(S.ratesFetchedAt).toLocaleTimeString();
    msg.innerHTML = `<strong>Cached rates</strong> — ExchangeRate-API · fetched ${ts}`;
  } else if (state === 'loading') {
    msg.innerHTML = `Fetching live rates…`;
  } else if (state === 'error') {
    dot.classList.add('err');
    msg.innerHTML = `<strong>API error</strong> — using cached fallback. ${errMsg || ''}`;
  } else {
    msg.innerHTML = `Using <strong>mock rates</strong> — add your API key to get live data`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// UI — SELECT POPULATION
// ═══════════════════════════════════════════════════════════════════

function buildSelect(el, defaultVal) {
  el.innerHTML = '';
  Object.entries(GROUPS).forEach(([g, codes]) => {
    const og = document.createElement('optgroup');
    og.label = g;
    codes.forEach(code => {
      const o = document.createElement('option');
      o.value = code;
      o.textContent = `${code} — ${CURRENCY_META[code] || code}`;
      if (code === defaultVal) o.selected = true;
      og.appendChild(o);
    });
    el.appendChild(og);
  });
}

function buildMultiSelect(el) {
  el.innerHTML = '';
  Object.entries(GROUPS).forEach(([g, codes]) => {
    const og = document.createElement('optgroup');
    og.label = g;
    codes.filter(c => !CRYPTO_DATA.find(x=>x.sym===c)).forEach(code => {
      const o = document.createElement('option');
      o.value = code;
      o.textContent = `${code} — ${CURRENCY_META[code] || code}`;
      og.appendChild(o);
    });
    el.appendChild(og);
  });
}

// ═══════════════════════════════════════════════════════════════════
// CONVERTER LOGIC
// ═══════════════════════════════════════════════════════════════════

const fmtNum = (n, code) => {
  if (isNaN(n)) return '—';
  const isCrypto = CRYPTO_DATA.some(c => c.sym === code);
  if (isCrypto) {
    const s = n.toFixed(8);
    return parseFloat(s).toLocaleString(undefined, {maximumFractionDigits:8});
  }
  if (n >= 1000) return n.toLocaleString(undefined, {maximumFractionDigits:2, minimumFractionDigits:2});
  return n.toFixed(2);
};

function convert() {
  const from  = document.getElementById('fromCur').value;
  const to    = document.getElementById('toCur').value;
  const amt   = parseFloat(document.getElementById('amountIn').value) || 0;
  const rate  = getConvertedRate(from, to);
  const result= amt * rate;

  document.getElementById('amountOut').value = fmtNum(result, to);

  const fmtRate = fmtNum(rate, to);
  document.getElementById('rateLabel').textContent = `1 ${from} = ${fmtRate} ${to}`;

  const ts = S.ratesFetchedAt ? new Date(S.ratesFetchedAt).toLocaleTimeString() : 'mock data';
  document.getElementById('rateTs').textContent = ts;
}

// ═══════════════════════════════════════════════════════════════════
// CRYPTO GRID
// ═══════════════════════════════════════════════════════════════════

function renderCryptoGrid() {
  const grid = document.getElementById('cryptoGrid');
  grid.innerHTML = '';
  CRYPTO_DATA.forEach(c => {
    const el = document.createElement('div');
    el.className = 'crypto-tile';
    const sign = c.chg >= 0 ? '+' : '';
    const cls  = c.chg >= 0 ? 'pos' : 'neg';
    el.innerHTML = `<div class="ct-sym">${c.sym}</div><div class="ct-price">$${c.rate.toLocaleString()}</div><div class="ct-chg"><span class="${cls}">${sign}${c.chg}%</span> 24h</div>`;
    el.addEventListener('click', () => {
      document.getElementById('toCur').value = c.sym;
      convert();
      showToast(`Switched to ${c.sym}`, 'green');
    });
    grid.appendChild(el);
  });
}

// ═══════════════════════════════════════════════════════════════════
// WALLET RENDER
// ═══════════════════════════════════════════════════════════════════

function renderWallet() {
  const content = document.getElementById('walletContent');
  const entries = Object.entries(S.wallet);

  if (!entries.length) {
    content.innerHTML = `<div class="wallet-empty"><strong>No wallets yet</strong><p>Convert a currency and tap "Save to wallet" to create one.</p></div>`;
  } else {
    const grid = document.createElement('div');
    grid.className = 'wallet-grid';
    entries.forEach(([code, data]) => {
      const bal     = data.balance || 0;
      const usdRate = activeRates[code] || 1;
      const usdVal  = bal / usdRate;
      const linked  = data.linkedFundingId ? S.funding.find(f => f.id === data.linkedFundingId) : null;
      const tile = document.createElement('div');
      tile.className = 'wallet-tile';
      tile.innerHTML = `
        <button class="wt-del" data-code="${code}" title="Remove">×</button>
        <div class="wt-code">${code}</div>
        <div class="wt-name">${CURRENCY_META[code] || code}</div>
        <div class="wt-bal">${fmtNum(bal, code)}</div>
        <div class="wt-usd">≈ $${fmtNum(usdVal, 'USD')} USD</div>
        ${linked ? `<div class="wt-linked">✓ ${linked.name}</div>` : ''}
      `;
      grid.appendChild(tile);
    });
    content.innerHTML = '';
    content.appendChild(grid);

    content.querySelectorAll('.wt-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        delete S.wallet[code];
        saveWalletState();
        renderWallet();
        showToast(`${code} wallet removed`);
      });
    });
  }

  renderTxHistory();
}

function renderTxHistory() {
  const el = document.getElementById('txContent');
  if (!S.txHistory.length) {
    el.innerHTML = `<div class="wallet-empty" style="padding:1.5rem"><strong>No transactions yet</strong></div>`;
    return;
  }
  const rows = S.txHistory.slice().reverse().slice(0, 30).map(tx => {
    const d = new Date(tx.ts);
    const ds = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
    return `<div class="tx-row">
      <span class="tx-pair">${tx.from} → ${tx.to}</span>
      <span class="tx-amt"><div class="tx-from">${fmtNum(tx.amtFrom, tx.from)} ${tx.from}</div><div class="tx-to">${fmtNum(tx.amtTo, tx.to)} ${tx.to}</div></span>
      <span class="tx-date">${ds}</span>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="tx-list">${rows}</div>`;
}

// ═══════════════════════════════════════════════════════════════════
// FUNDING ACCOUNTS
// ═══════════════════════════════════════════════════════════════════

function renderFunding() {
  const grid  = document.getElementById('fundingGrid');
  const empty = document.getElementById('fundingEmpty');
  if (!S.funding.length) {
    grid.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = S.funding.map(f => {
    const badges = (f.currencies || []).map(c => `<span class="fc-cur-badge">${c}</span>`).join('');
    return `<div class="funding-card">
      <button class="fc-del" data-id="${f.id}" title="Remove">×</button>
      <div class="fc-type">${f.type}</div>
      <div class="fc-name">${f.name}</div>
      <div class="fc-detail">${f.number || '—'}</div>
      <div class="fc-linked-curs">${badges}</div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.fc-del').forEach(btn => {
    btn.addEventListener('click', () => {
      S.funding = S.funding.filter(f => f.id !== btn.dataset.id);
      saveFundingState();
      renderFunding();
      showToast('Account removed');
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Save to wallet modal
document.getElementById('saveWalletBtn').addEventListener('click', () => {
  const from   = document.getElementById('fromCur').value;
  const to     = document.getElementById('toCur').value;
  const amtIn  = parseFloat(document.getElementById('amountIn').value) || 0;
  const amtOut = parseFloat(document.getElementById('amountOut').value) || 0;
  const rate   = getConvertedRate(from, to);

  document.getElementById('stwMain').textContent = `${fmtNum(amtOut, to)} ${to}`;
  document.getElementById('stwSub').textContent  = `from ${fmtNum(amtIn, from)} ${from} · rate ${fmtNum(rate, to)}`;

  // Populate funding picker
  const pick = document.getElementById('stwFundingPick');
  pick.innerHTML = '<option value="">None — no funding account</option>';
  S.funding.forEach(f => {
    const o = document.createElement('option');
    o.value = f.id; o.textContent = `${f.name} (${f.type})`;
    pick.appendChild(o);
  });

  openModal('modalSaveWallet');

  document.getElementById('confirmSaveWallet').onclick = () => {
    const fundingId = pick.value || null;
    // Add to wallet
    if (!S.wallet[to]) S.wallet[to] = { balance: 0, linkedFundingId: null };
    S.wallet[to].balance += amtOut;
    if (fundingId) S.wallet[to].linkedFundingId = fundingId;
    saveWalletState();

    // Record transaction
    S.txHistory.push({ from, to, amtFrom: amtIn, amtTo: amtOut, rate, ts: Date.now() });
    saveTxState();

    closeModal('modalSaveWallet');
    showToast(`${fmtNum(amtOut, to)} ${to} saved to wallet`, 'green');
    updateSettingsStats();
  };
});

// Add currency wallet
document.getElementById('addCurBtn').addEventListener('click', () => {
  buildSelect(document.getElementById('addCurSelect'), 'EUR');
  openModal('modalAddCur');
});
document.getElementById('confirmAddCur').addEventListener('click', () => {
  const code = document.getElementById('addCurSelect').value;
  const bal  = parseFloat(document.getElementById('addCurBal').value) || 0;
  if (!S.wallet[code]) S.wallet[code] = { balance: 0, linkedFundingId: null };
  S.wallet[code].balance += bal;
  saveWalletState();
  closeModal('modalAddCur');
  renderWallet();
  showToast(`${code} wallet created`, 'green');
});

// Link funding account
document.getElementById('addFundingBtn').addEventListener('click', () => {
  buildMultiSelect(document.getElementById('fundCurList'));
  openModal('modalFunding');
});
document.getElementById('confirmFunding').addEventListener('click', () => {
  const type = document.getElementById('fundType').value;
  const name = document.getElementById('fundName').value.trim();
  const num  = document.getElementById('fundNumber').value.trim();
  const curs = Array.from(document.getElementById('fundCurList').selectedOptions).map(o => o.value);
  if (!name) { showToast('Please enter an account name', 'red'); return; }
  S.funding.push({ id: `f${Date.now()}`, type, name, number: num, currencies: curs });
  saveFundingState();
  closeModal('modalFunding');
  renderFunding();
  showToast(`${name} linked`, 'green');
  updateSettingsStats();
});

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
});

// ═══════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════

function updateSettingsStats() {
  document.getElementById('statWallets').textContent  = Object.keys(S.wallet).length;
  document.getElementById('statTxs').textContent      = S.txHistory.length;
  document.getElementById('statFunding').textContent  = S.funding.length;
  document.getElementById('statLastFetch').textContent= S.ratesFetchedAt
    ? new Date(S.ratesFetchedAt).toLocaleString() : 'Never';
}

document.getElementById('apiKeyInput').value = S.apiKey || '';
document.getElementById('saveApiKey').addEventListener('click', () => {
  const key = document.getElementById('apiKeyInput').value.trim();
  S.apiKey = key; LS.set('xchange_apiKey', key);
  showToast('API key saved — fetching rates…', 'green');
  loadRates(true);
});

document.getElementById('clearDataBtn').addEventListener('click', () => {
  if (!confirm('Clear all wallet, transaction, and funding data? API key will be kept.')) return;
  S.wallet = {}; S.txHistory = []; S.funding = [];
  saveWalletState(); saveTxState(); saveFundingState();
  renderWallet(); renderFunding();
  updateSettingsStats();
  showToast('Data cleared');
});

document.getElementById('refreshBtn').addEventListener('click', () => {
  showToast('Refreshing rates…');
  loadRates(true);
});

// Base currency selector (info display)
buildSelect(document.getElementById('baseCurSelect'), 'USD');

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════

function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`panel-${name}`)?.classList.add('active');
  document.querySelector(`.nav-tab[data-panel="${name}"]`)?.classList.add('active');
  if (name === 'wallet')   renderWallet();
  if (name === 'funding')  renderFunding();
  if (name === 'settings') updateSettingsStats();
}

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => switchPanel(tab.dataset.panel));
});

// ═══════════════════════════════════════════════════════════════════
// QUICK PILLS & SWAP
// ═══════════════════════════════════════════════════════════════════

document.querySelectorAll('.pill').forEach(p => {
  p.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    document.getElementById('amountIn').value = p.dataset.v;
    convert();
  });
});

document.getElementById('swapBtn').addEventListener('click', () => {
  const from = document.getElementById('fromCur');
  const to   = document.getElementById('toCur');
  const tmp  = from.value; from.value = to.value; to.value = tmp;
  convert();
});

document.getElementById('amountIn').addEventListener('input', convert);
document.getElementById('fromCur').addEventListener('change', convert);
document.getElementById('toCur').addEventListener('change',   convert);

// ═══════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════

let toastTimer;
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ` ${type}` : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); }, 2800);
}

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════

buildSelect(document.getElementById('fromCur'), 'USD');
buildSelect(document.getElementById('toCur'),   'KES');
renderCryptoGrid();
loadRates();