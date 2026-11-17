/* =========================================================
   Futacoin Bamboo Ledger (client)
   Standalone on purpose: it doesn't depend on GSAP, ScrollTrigger or Lenis, so the tracker
   keeps working even if the animation layer fails to load.
   All accounting happens server-side in /api/meter; this file only displays it.
   ========================================================= */
(() => {
  'use strict';
  const API = '/api/meter';
  const REFRESH_MS = 30000;
  const TIMEOUT_MS = 12000;
  const JA = (window.FUTA_LANG || 'en') === 'ja';

  // targets for the gauge
  const GOALS = [
    { usd: 5000, en: 'First shoot', ja: '最初の芽' },
    { usd: 20000, en: 'A small grove', ja: '小さな竹林' },
    { usd: 50000, en: 'A real forest', ja: '本物の森' },
    { usd: 100000, en: 'Legend-sized', ja: '伝説級' },
    { usd: 250000, en: 'The whole mountainside', ja: '山まるごと' }
  ];

  const T = JA ? {
    connecting: '接続中', awaiting: 'ローンチ待ち', ready: '準備完了 · 最初の取引待ち', live: 'ライブ · 確定データ',
    cached: 'キャッシュ', unavailableS: '取得不可', offline: 'オフライン', unavailable: '取得不可', soon: '近日公開',
    prelaunch: '$FUTAのローンチと同時に記録が始まります', noneYet: 'まだなし',
    rate: p => `1 SOL = $${p} で換算 · 概算（未寄付）`, rateNa: '現在USD換算は利用できません',
    footNew: '最初の取引で開始。クリエイター報酬は、Red Panda Networkへ送られる前にここに貯まります。',
    footLive: '取引で集まった報酬が、請求とUSDCへの変換を経てRed Panda Networkへ支払われるのを待っています。確定すると上の合計に加算されます。',
    crankLast: a => `オンチェーンでUSDC支払い済み。最終寄付 ${a}`, crank: 'オンチェーンでUSDC支払い済み。合計に数えられるのはここだけ',
    lock: n => `🔒 クリエイター報酬の${n}% → donate.gg → Red Panda Network · 永久ロック`,
    upd: a => `確定データ更新 ${a}`, updStale: a => `確定データ（キャッシュ）最終確認 ${a}`,
    vaultsNew: 'ボールトは最初の取引で開きます', vaultsNa: 'ボールト残高は取得不可',
    settledNa: '確定データを取得できません。再試行中', down: 'トラッカーに接続できません。再試行中',
    ago: (n, u) => n + { s: '秒前', m: '分前', h: '時間前', d: '日前' }[u],
    goal: (pct, usd) => `$${usd}の${pct}%`, onWay: p => ` · +${p}%が進行中`,
    aria: v => `Red Panda Networkへの確定寄付 $${v}`
  } : {
    connecting: 'Connecting', awaiting: 'Awaiting launch', ready: 'Ready · waiting for first trade', live: 'Live · settled data',
    cached: 'Cached', unavailableS: 'Unavailable', offline: 'Offline', unavailable: 'unavailable', soon: 'Coming soon',
    prelaunch: 'The ledger opens the moment $FUTA launches', noneYet: 'None yet',
    rate: p => `at $${p} per SOL · estimate, not yet donated`, rateNa: 'USD estimate unavailable right now',
    footNew: 'Opens with the first trade. Creator rewards collect here before they are sent to Red Panda Network.',
    footLive: 'Collected from trading, waiting to be claimed, converted to USDC and paid to Red Panda Network. It joins the total above once it settles.',
    crankLast: a => `Paid out in USDC on-chain. Last donation ${a}`, crank: 'Paid out in USDC on-chain. This is what the ledger counts',
    lock: n => `🔒 ${n}% of creator rewards → donate.gg → Red Panda Network · locked forever`,
    upd: a => `Settled data updated ${a}`, updStale: a => `Settled data cached, last confirmed ${a}`,
    vaultsNew: 'vaults open with the first trade', vaultsNa: 'vault balances unavailable',
    settledNa: 'Settled data unavailable right now. Retrying', down: 'The ledger is unreachable right now. Retrying',
    ago: (n, u) => n + u + ' ago',
    goal: (pct, usd) => `${pct}% of $${usd}`, onWay: p => ` · +${p}% on the way`,
    aria: v => `$${v} settled to Red Panda Network`
  };

  const $ = (s, c = document) => c.querySelector(s);
  const card = $('.led-card');
  if (!card) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const els = {
    live: $('[data-m-live]'), status: $('[data-m-status]'), receipts: $('[data-m-receipts]'), solIn: $('[data-m-sol]'),
    last: $('[data-m-last]'), ca: $('[data-m-ca]'), updated: $('[data-m-updated]'), lock: $('[data-m-lock]'),
    tVault: $('[data-t-vault]'), tVaultLink: $('[data-t-vault-link]'), tPending: $('[data-t-pending]'),
    tPendingLink: $('[data-t-pending-link]'), tSent: $('[data-t-sent]'), tSentLink: $('[data-t-sent-link]'), tCrank: $('[data-t-crank]'),
    goalName: $('[data-goal-name]'), goalPct: $('[data-goal-pct]'), gSet: $('[data-g-set]'), gIn: $('[data-g-in]'), gPct: $('[data-g-pct]')
  };
  els.status.textContent = T.connecting;

  /* ---------- gauge ticks ---------- */
  const ticks = $('.gauge-ticks');
  if (ticks) {
    const NS = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 60; i++) {
      const l = document.createElementNS(NS, 'line');
      const big = i % 5 === 0;
      l.setAttribute('x1', 160); l.setAttribute('x2', 160);
      l.setAttribute('y1', 4); l.setAttribute('y2', big ? 16 : 10);
      l.setAttribute('transform', `rotate(${i * 6} 160 160)`);
      if (big) l.setAttribute('class', 'big');
      ticks.appendChild(l);
    }
  }

  /* ---------- rolling odometer ---------- */
  function makeOdometer(el) {
    let n = 0, slots = [], commas = [];
    function build(digits) {
      el.innerHTML = ''; slots = []; commas = [];
      for (let k = digits - 1; k >= 0; k--) {
        const wrap = document.createElement('span'); wrap.className = 'odo-d';
        const strip = document.createElement('span'); strip.className = 'odo-s';
        strip.innerHTML = '01234567890'.split('').map(d => `<span>${d}</span>`).join('');
        wrap.appendChild(strip); el.appendChild(wrap);
        slots.push({ wrap, strip, k });
        if (k > 0 && k % 3 === 0) { const c = document.createElement('span'); c.className = 'odo-c'; c.textContent = ','; el.appendChild(c); commas.push({ c, k }); }
      }
    }
    function set(f) {
      f = Math.max(0, f);
      const len = String(Math.floor(f)).length;
      if (len > n) { n = len; build(n); }
      for (const s of slots) {
        const p = 10 ** s.k, base = Math.floor(f / p) % 10, lower = f % p;
        const frac = lower > p - 1 ? lower - (p - 1) : 0;
        s.strip.style.transform = `translateY(${-(base + frac)}em)`;
        s.wrap.classList.toggle('lead', s.k >= len && s.k > 0);
      }
      for (const { c, k } of commas) c.classList.toggle('lead', k >= len);
      el.setAttribute('aria-label', T.aria(Math.floor(f).toLocaleString('en-US')));
    }
    return { set };
  }
  const odo = makeOdometer($('[data-odo]'));
  odo.set(0);

  /* ---------- gauge: settled arc in front, incoming (not yet donated) arc behind it, lighter ---------- */
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const lv = { front: 0, back: 0 }, lvShown = { front: 0, back: 0 };
  let gaugeAnim = 0;
  const paintGauge = () => {
    els.gSet.style.strokeDasharray = `${(lvShown.front * 100).toFixed(2)} 100`;
    els.gIn.style.strokeDasharray = `${(lvShown.back * 100).toFixed(2)} 100`;
  };
  function gaugeTo(front, back = front) {
    lv.front = clamp01(front); lv.back = Math.max(lv.front, clamp01(back));
    if (!inView) return;
    cancelAnimationFrame(gaugeAnim);
    const from = { ...lvShown }, t0 = performance.now(), dur = reduce ? 1 : 2200;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      lvShown.front = from.front + (lv.front - from.front) * e;
      lvShown.back = from.back + (lv.back - from.back) * e;
      paintGauge();
      if (k < 1) gaugeAnim = requestAnimationFrame(step);
    };
    gaugeAnim = requestAnimationFrame(step);
  }

  /* ---------- "on the way": SOL collected but not donated yet ---------- */
  const pend = { wrap: $('[data-p-wrap]'), sol: $('[data-p-sol]'), usd: $('[data-p-usd]'), rate: $('[data-p-rate]'), foot: $('[data-p-foot]') };
  let pShown = 0, pTarget = null, pPrice = null, pAnim = 0;
  const fmtSol = x => x.toLocaleString('en-US', { minimumFractionDigits: x >= 1000 ? 1 : 3, maximumFractionDigits: x >= 1000 ? 1 : 3 });
  const fmtUsd = x => '$' + Math.round(x).toLocaleString('en-US');
  function paintPending(x) {
    pend.sol.textContent = fmtSol(x);
    pend.usd.textContent = pPrice ? fmtUsd(x * pPrice) : '—';
  }
  function pendingTo(solAmount, price) {
    pPrice = price || pPrice;
    const first = pTarget === null;
    pTarget = solAmount;
    pend.wrap.classList.toggle('is-empty', solAmount <= 0);
    if (!inView || reduce) { if (!inView && !first) return; pShown = solAmount; paintPending(solAmount); return; }
    cancelAnimationFrame(pAnim);
    const from = pShown, t0 = performance.now(), dur = from === 0 ? 2400 : 1400;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      pShown = from + (solAmount - from) * e;
      paintPending(pShown);
      if (k < 1) pAnim = requestAnimationFrame(step);
    };
    pAnim = requestAnimationFrame(step);
  }

  /* ---------- odometer tween (no GSAP): easeOutCubic ---------- */
  let shown = 0, target = 0, anim = 0, inView = false;
  function animateTo(v) {
    target = v;
    if (!inView) return;
    cancelAnimationFrame(anim);
    if (reduce) { shown = v; odo.set(v); return; }
    const from = shown, dur = from === 0 ? 2600 : 1500, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      shown = from + (v - from) * e;
      odo.set(shown);
      if (k < 1) anim = requestAnimationFrame(step); else shown = v;
    };
    anim = requestAnimationFrame(step);
  }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !inView) { inView = true; animateTo(target); gaugeTo(lv.front, lv.back); if (pTarget !== null) pendingTo(pTarget); }
  }, { threshold: 0.2 }).observe(card);

  function pop(text) {
    if (reduce) return;
    const p = document.createElement('div');
    p.className = 'res-pop'; p.textContent = text;
    $('.res-main').appendChild(p);
    p.animate([{ transform: 'translateY(30px) scale(.6)', opacity: 0 }, { transform: 'translateY(-50px) scale(1)', opacity: 1, offset: .3 },
      { transform: 'translateY(-50px) scale(1)', opacity: 1, offset: .75 }, { transform: 'translateY(-100px) scale(1)', opacity: 0 }],
      { duration: 2600, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => p.remove();
  }

  /* ---------- formatting ---------- */
  const usdE6 = v => {
    const n = Number(BigInt(v)) / 1e6;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: n < 1000 ? 2 : 0, maximumFractionDigits: n < 1000 ? 2 : 0 });
  };
  const sol = lam => (Number(BigInt(lam)) / 1e9).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' SOL';
  const ago = iso => {
    const s = Math.max(1, Math.floor((Date.now() - Date.parse(iso)) / 1000));
    if (s < 90) return T.ago(s, 's'); if (s < 3600) return T.ago(Math.floor(s / 60), 'm');
    if (s < 86400) return T.ago(Math.floor(s / 3600), 'h'); return T.ago(Math.floor(s / 86400), 'd');
  };
  const short = a => a.slice(0, 4) + '…' + a.slice(-4);
  const setLink = (a, href) => { if (href) { a.href = href; a.classList.remove('off'); } else a.classList.add('off'); };
  const setLive = (cls, text) => { els.live.classList.remove('is-idle', 'is-error', 'is-pre'); if (cls) els.live.classList.add(cls); els.status.textContent = text; };

  function setGoal(usd, incomingUsd = 0) {
    const g = GOALS.find(x => usd < x.usd) || GOALS[GOALS.length - 1];
    const pct = Math.min(100, usd / g.usd * 100), inPct = Math.max(0, Math.min(100 - pct, incomingUsd / g.usd * 100));
    const f = p => (p < 10 && p > 0 ? p.toFixed(1) : Math.floor(p));
    els.goalName.textContent = JA ? g.ja : g.en;
    els.goalPct.textContent = T.goal(f(pct), g.usd.toLocaleString('en-US')) + (inPct >= .1 ? T.onWay(f(inPct)) : '');
    els.gPct.textContent = f(pct) + '%';
    // keep a visible sliver on the gauge even at zero, so it never looks broken
    const front = Math.max(.012, pct / 100);
    gaugeTo(front, front + inPct / 100);
  }

  /* ---------- render ---------- */
  let last = null;
  function renderPrelaunch() {
    setLive('is-pre', T.awaiting);
    els.ca.textContent = T.soon; els.ca.removeAttribute('href');
    for (const k of ['receipts', 'solIn', 'last']) els[k].textContent = '—';
    els.tVault.textContent = '—'; els.tPending.textContent = '—'; els.tSent.textContent = '$0';
    els.updated.textContent = T.prelaunch;
    animateTo(0);
    setGoal(0);
    pend.sol.textContent = '—'; pend.usd.textContent = '—';
  }

  function render(d) {
    last = d;
    if (d.prelaunch) return renderPrelaunch();
    const s = d.settled, p = d.pending;
    els.ca.textContent = short(d.mint);
    els.ca.href = 'https://solscan.io/token/' + d.mint;

    // not donated yet = unclaimed creator fees (bonding curve + PumpSwap) + SOL already in the donation pipe
    const price = d.price && d.price.solUsd;
    let pendingSol = null;
    if (p) pendingSol = Number(BigInt(p.creatorVaultLamports) + BigInt(p.ammVaultLamports) + BigInt(p.donation ? p.donation.pendingLamports : '0')) / 1e9;
    else if (d.onchain === 'not_created') pendingSol = 0;
    if (pendingSol !== null) {
      pendingTo(pendingSol, price);
      pend.rate.textContent = price ? T.rate(price.toFixed(2)) : T.rateNa;
      pend.foot.textContent = d.onchain === 'not_created' ? T.footNew : T.footLive;
    } else { pend.sol.textContent = '—'; pend.usd.textContent = '—'; }
    const incomingUsd = pendingSol && price ? pendingSol * price : 0;

    if (s) {
      const usd = Math.floor(Number(BigInt(s.donatedUsdE6)) / 1e6);
      if (shown > 0 && usd > target) pop('+$' + (usd - target).toLocaleString('en-US'));
      animateTo(usd);
      setGoal(Number(BigInt(s.donatedUsdE6)) / 1e6, incomingUsd);
      els.receipts.textContent = Number(s.receipts).toLocaleString('en-US');
      els.solIn.textContent = sol(s.sourceLamports);
      els.last.textContent = s.lastSettlement ? ago(s.lastSettlement.at) : T.noneYet;
      els.tSent.textContent = usdE6(s.donatedUsdE6);
      setLink(els.tSentLink, s.lastSettlement && 'https://solscan.io/tx/' + s.lastSettlement.tx);
      els.tCrank.textContent = s.lastSettlement ? T.crankLast(ago(s.lastSettlement.at)) : T.crank;
    } else {
      for (const k of ['receipts', 'solIn', 'last', 'tSent']) els[k].textContent = T.unavailable;
    }

    if (p) {
      els.tVault.textContent = sol(BigInt(p.creatorVaultLamports) + BigInt(p.ammVaultLamports));
      els.tPending.textContent = p.donation ? sol(p.donation.pendingLamports) : sol('0');
      setLink(els.tVaultLink, p.accounts && 'https://solscan.io/account/' + (BigInt(p.ammVaultLamports) > 0n ? p.accounts.pumpswapVault : p.accounts.creatorVault));
      setLink(els.tPendingLink, p.donation && 'https://solscan.io/account/' + p.donation.address);
      if (p.locked) {
        els.lock.hidden = false;
        els.lock.textContent = T.lock(Math.round(p.shareBps / 100));
      }
    } else if (d.onchain === 'not_created') {
      // the chain answered: this mint is not trading yet, so there is nothing in the vaults
      els.tVault.textContent = sol('0'); els.tPending.textContent = sol('0');
      setLink(els.tVaultLink, null); setLink(els.tPendingLink, null);
    } else {
      els.tVault.textContent = T.unavailable; els.tPending.textContent = T.unavailable;
    }

    const stale = (s && s.stale) || !s;
    if (!s) setLive('is-error', T.unavailableS);
    else if (stale) setLive('is-idle', T.cached);
    else if (d.onchain === 'not_created' && Number(s.receipts) === 0) setLive('is-pre', T.ready);
    else setLive(null, T.live);
    updateStatusLine();
  }

  function updateStatusLine() {
    if (!last || last.prelaunch) return;
    const s = last.settled;
    if (!s || !s.fetchedAt) { els.updated.textContent = T.settledNa; return; }
    const parts = [s.stale ? T.updStale(ago(s.fetchedAt)) : T.upd(ago(s.fetchedAt))];
    if (last.onchain === 'not_created') parts.push(T.vaultsNew);
    else if (last.errors && last.errors.chain) parts.push(T.vaultsNa);
    els.updated.textContent = parts.join(' · ');
  }
  setInterval(updateStatusLine, 15000);

  /* ---------- polling ---------- */
  let busy = false;
  async function load() {
    if (busy || document.hidden) return;
    busy = true;
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(API, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      render(await r.json());
    } catch (e) {
      if (last) { setLive('is-idle', T.cached); updateStatusLine(); }
      else { renderPrelaunch(); setLive('is-error', T.offline); els.updated.textContent = T.down; }
    } finally { clearTimeout(timer); busy = false; }
  }
  load();
  setInterval(load, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  addEventListener('online', load);
})();
