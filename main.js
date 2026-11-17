(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------------- language ---------------- */
  const lang = window.FUTA_LANG || 'en';
  const TOAST_EN = { 'toast.ca': 'CA drops soon. Stay standing. 🐾', 'toast.x': 'X link coming soon', 'toast.copied': 'Contract address copied' };
  const tr = (k) => (typeof window.t === 'function' ? window.t(k) : TOAST_EN[k]) || TOAST_EN[k] || k;

  /* ---------------- toast ---------------- */
  const toast = $('#toast');
  let toastT;
  const say = (msg) => {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('show'), 2600);
  };

  /* ---------------- CA + X placeholders ---------------- */
  // When the contract is live, set CA to the address string and it becomes copyable.
  const CA = '';
  // When the X account is live, set X_URL to the profile link.
  const X_URL = '';

  $$('.ca').forEach((btn) => {
    if (CA) btn.querySelector('.ca__val').textContent = CA.slice(0, 4) + '…' + CA.slice(-4);
    btn.addEventListener('click', async () => {
      if (!CA) return say(tr('toast.ca'));
      try { await navigator.clipboard.writeText(CA); say(tr('toast.copied')); }
      catch { say(CA); }
    });
  });
  $$('.x-btn').forEach((a) => {
    if (X_URL) { a.href = X_URL; a.target = '_blank'; a.rel = 'noopener'; return; }
    a.addEventListener('click', (e) => { e.preventDefault(); say(tr('toast.x')); });
  });

  /* ---------------- live age ---------------- */
  // Born 5 July 2003 (JST)
  const birth = { y: 2003, m: 6, d: 5 };
  const pad = (n) => String(n).padStart(2, '0');
  const jstNow = () => {
    const now = new Date();
    return new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000);
  };
  const ageEls = { y: $('#ageY'), d: $('#ageD'), h: $('#ageH'), m: $('#ageM'), s: $('#ageS') };
  const tickAge = () => {
    const n = jstNow();
    let years = n.getFullYear() - birth.y;
    let last = new Date(n.getFullYear(), birth.m, birth.d);
    if (n < last) { years -= 1; last = new Date(n.getFullYear() - 1, birth.m, birth.d); }
    const ms = n - last;
    const days = Math.floor(ms / 86400000);
    ageEls.y.textContent = years;
    ageEls.d.textContent = days;
    ageEls.h.textContent = pad(n.getHours());
    ageEls.m.textContent = pad(n.getMinutes());
    ageEls.s.textContent = pad(n.getSeconds());
  };
  tickAge();
  setInterval(tickAge, 1000);

  /* ---------------- word splitter ---------------- */
  const seg = (lang === 'ja' && typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;
  const segment = (text) => {
    if (lang !== 'ja') return text.split(/(\s+)/);
    const clean = text.replace(/\s+/g, '');
    const parts = seg ? [...seg.segment(clean)].map((x) => x.segment) : [...clean];
    // keep Japanese punctuation off the start of a line: glue closers to the previous piece, openers to the next
    const out = [];
    for (const p of parts) {
      const prev = out[out.length - 1];
      if (prev && (/^[、。，．！？」』）)ー…・]+$/.test(p) || /[「『（(]$/.test(prev))) out[out.length - 1] = prev + p;
      else out.push(p);
    }
    return out;
  };
  const splitWords = (el, inner = false) => {
    const walk = (node) => {
      const out = document.createDocumentFragment();
      node.childNodes.forEach((c) => {
        if (c.nodeType === 3) {
          segment(c.textContent).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { if (lang !== 'ja') out.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            if (inner) { const s = document.createElement('span'); s.textContent = part; w.appendChild(s); }
            else w.textContent = part;
            out.appendChild(w);
          });
        } else if (c.nodeType === 1) {
          const clone = c.cloneNode(false);
          clone.appendChild(walk(c));
          out.appendChild(clone);
        }
      });
      return out;
    };
    const frag = walk(el);
    el.innerHTML = '';
    el.appendChild(frag);
    return $$('.w', el);
  };

  /* ---------------- falling bamboo leaves ---------------- */
  const canvas = $('#leaves');
  const ctx = canvas.getContext('2d');
  let W, H, DPR, leaves = [], scrollVel = 0;
  const resize = () => {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.width = innerWidth * DPR;
    H = canvas.height = innerHeight * DPR;
  };
  const colors = ['#8fa65a', '#6f8a3e', '#b7c77a', '#d4561c', '#ef7a2e'];
  const mkLeaf = (initial) => ({
    x: Math.random() * W,
    y: initial ? Math.random() * H : -40 * DPR,
    len: (14 + Math.random() * 22) * DPR,
    vy: (0.35 + Math.random() * 0.7) * DPR,
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 0.008 + Math.random() * 0.014,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.02,
    c: colors[(Math.random() * colors.length) | 0],
    a: 0.25 + Math.random() * 0.45,
  });
  const drawLeaf = (l) => {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.rot);
    ctx.globalAlpha = l.a;
    ctx.fillStyle = l.c;
    ctx.beginPath();
    ctx.moveTo(-l.len / 2, 0);
    ctx.quadraticCurveTo(0, -l.len * 0.22, l.len / 2, 0);
    ctx.quadraticCurveTo(0, l.len * 0.22, -l.len / 2, 0);
    ctx.fill();
    ctx.restore();
  };
  const loop = () => {
    ctx.clearRect(0, 0, W, H);
    const boost = Math.max(-6, Math.min(6, scrollVel)) * 0.6 * DPR;
    for (const l of leaves) {
      l.sway += l.swaySpeed;
      l.y += l.vy - boost * 0.5;
      l.x += Math.sin(l.sway) * 0.6 * DPR;
      l.rot += l.vr + Math.sin(l.sway) * 0.004;
      if (l.y > H + 40 * DPR) Object.assign(l, mkLeaf(false));
      if (l.y < -60 * DPR) l.y = H + 30 * DPR;
      drawLeaf(l);
    }
    scrollVel *= 0.92;
    requestAnimationFrame(loop);
  };
  resize();
  addEventListener('resize', resize);
  if (!reduce) {
    const count = innerWidth < 700 ? 12 : 22;
    leaves = Array.from({ length: count }, () => mkLeaf(true));
    loop();
  }

  /* ---------------- custom cursor ---------------- */
  const cursor = $('#cursor');
  if (cursor && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; cursor.style.opacity = 1; });
    document.addEventListener('mouseleave', () => (cursor.style.opacity = 0));
    const follow = () => {
      cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
      cursor.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(follow);
    };
    follow();
    $$('a, button, figure, .tl').forEach((el) => {
      el.addEventListener('mouseenter', () => cursor.classList.add('is-hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('is-hover'));
    });
  }

  /* ---------------- magnetic ---------------- */
  if (!reduce && matchMedia('(hover: hover)').matches) {
    $$('.magnetic').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.3;
        const y = (e.clientY - r.top - r.height / 2) * 0.3;
        el.style.transform = `translate(${x}px, ${y}px)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform .5s cubic-bezier(.2,.9,.2,1.2), background .3s, color .3s';
        el.style.transform = '';
        setTimeout(() => (el.style.transition = ''), 500);
      });
    });
  }

  /* ---------------- certificate tilt ---------------- */
  const card = $('#certCard');
  if (card && matchMedia('(hover: hover)').matches) {
    const inner = $('.record__card-inner', card);
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      inner.style.transform = `rotateY(${(px - 0.5) * 16}deg) rotateX(${(0.5 - py) * 16}deg)`;
      inner.style.setProperty('--mx', px * 100 + '%');
      inner.style.setProperty('--my', py * 100 + '%');
    });
    card.addEventListener('mouseleave', () => (inner.style.transform = ''));
  }

  /* ---------------- nav ---------------- */
  const nav = $('#nav');
  let lastY = 0;
  const onScrollNav = (y) => {
    nav.classList.toggle('is-scrolled', y > 40);
    nav.classList.toggle('is-hidden', y > lastY && y > 400);
    lastY = y;
  };

  /* ---------------- fallback without GSAP ---------------- */
  const loader = $('#loader');
  if (!hasGsap || reduce) {
    loader.remove();
    addEventListener('scroll', () => onScrollNav(scrollY), { passive: true });
    $$('.count').forEach((el) => (el.textContent = Number(el.dataset.to).toLocaleString('en-US')));
    $('.stand__media').style.clipPath = 'inset(0)';
    $('.stand__media').style.setProperty('--shade', 1);
    return;
  }

  /* ================= GSAP ================= */
  gsap.registerPlugin(ScrollTrigger);
  document.body.classList.add('loading');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) scrollTo(0, 0);

  // smooth scroll
  let lenis = null;
  if (typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    window.__lenis = lenis;
    lenis.on('scroll', (e) => { ScrollTrigger.update(); onScrollNav(e.scroll); scrollVel = e.velocity || 0; });
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
    $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const t = $(id);
      if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: 0, duration: 1.6 }); }
    }));
  } else {
    addEventListener('scroll', () => { onScrollNav(scrollY); }, { passive: true });
  }

  /* ---- loader ---- */
  const num = { v: 0 };
  const tlLoad = gsap.timeline();
  tlLoad
    .from('.loader__kanji', { yPercent: 40, opacity: 0, duration: .8, ease: 'power3.out' })
    .to(num, {
      v: 23, duration: 1.6, ease: 'power2.inOut',
      onUpdate: () => { $('#loaderNum').textContent = Math.round(num.v); },
    }, '<.1')
    .to('#loaderBar', { width: '100%', duration: 1.6, ease: 'power2.inOut' }, '<')
    .to('.loader > *', { y: -30, opacity: 0, stagger: .05, duration: .4, ease: 'power2.in' })
    .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: .9, ease: 'expo.inOut' }, '-=.1')
    .add(() => { loader.remove(); document.body.classList.remove('loading'); lenis && lenis.start(); ScrollTrigger.refresh(); })
    .add(heroIntro(), '-=.55');

  function heroIntro() {
    const tl = gsap.timeline();
    tl.from('.hero__word .ch', { yPercent: 115, rotate: 8, duration: 1.2, stagger: .07, ease: 'expo.out' })
      .from('.hero__dollar', { scale: 0, rotate: -90, duration: .9, ease: 'back.out(2)' }, '<.2')
      .from('.hero__portrait', { scale: .5, opacity: 0, duration: 1.2, ease: 'expo.out' }, '<')
      .from('#coin img', { rotationY: -720, duration: 2.2, ease: 'expo.out' }, '<')
      .from('.hero__kanji', { opacity: 0, xPercent: 20, duration: 1.4, ease: 'power3.out' }, '<')
      .from('.hero__meta span, .hero__bottom > *', { y: 30, opacity: 0, stagger: .08, duration: .8, ease: 'power3.out' }, '<.3')
      .from('.nav > *', { y: -30, opacity: 0, stagger: .08, duration: .8, ease: 'power3.out' }, '<');
    return tl;
  }

  /* ---- hero parallax ---- */
  gsap.to('.hero__title', { yPercent: -35, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__portrait', { yPercent: 25, rotate: 6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__kanji', { yPercent: -70, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // portrait follows the mouse a little
  const portrait = $('#coin');
  if (matchMedia('(hover: hover)').matches) {
    const qx = gsap.quickTo(portrait, 'x', { duration: .8, ease: 'power3' });
    const qy = gsap.quickTo(portrait, 'y', { duration: .8, ease: 'power3' });
    const qr = gsap.quickTo(portrait, 'rotationY', { duration: .8, ease: 'power3' });
    const qrx = gsap.quickTo(portrait, 'rotationX', { duration: .8, ease: 'power3' });
    $('#hero').addEventListener('mousemove', (e) => {
      const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
      qx(nx * 30); qy(ny * 30); qr(nx * 28); qrx(-ny * 22);
    });
  }

  /* ---- marquee speeds up with scroll ---- */
  gsap.to('.marquee', { rotate: 2, ease: 'none', scrollTrigger: { trigger: '.marquee', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ---- the stand: pinned reveal ---- */
  const standWords = splitWords($('#standText'));
  const tlStand = gsap.timeline({
    scrollTrigger: { trigger: '.stand', start: 'top top', end: 'bottom bottom', scrub: .6 },
  });
  tlStand
    .fromTo('.stand__media', { clipPath: 'inset(30% 34% 30% 34% round 400px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'power2.inOut', duration: 1 })
    .fromTo('.stand__media img', { scale: 1.3 }, { scale: 1, ease: 'power2.inOut', duration: 1 }, 0)
    .fromTo('.stand__media', { '--shade': 0 }, { '--shade': 1, duration: .5 }, .6)
    .to(standWords, { opacity: 1, stagger: .06, duration: .2, ease: 'none' }, 1);

  /* ---- counters ---- */
  $$('.count').forEach((el) => {
    const to = Number(el.dataset.to);
    const o = { v: 0 };
    gsap.to(o, {
      v: to, duration: 2, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('en-US'); },
    });
  });
  gsap.from('.stat', { y: 80, opacity: 0, stagger: .15, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.stats', start: 'top 75%' } });

  /* ---- life: horizontal scroll (desktop) ---- */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 761px)', () => {
    const track = $('#lifeTrack');
    const dist = () => track.scrollWidth - innerWidth;
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.life', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: .8, invalidateOnRefresh: true, anticipatePin: 1,
      },
    });
    gsap.to('#lifeProgress', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.life', start: 'top top', end: () => '+=' + dist(), scrub: true } });
    $$('.tl__img img').forEach((img) => {
      gsap.fromTo(img, { xPercent: -8 }, { xPercent: 8, ease: 'none', scrollTrigger: { trigger: img.parentElement, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    });
    $$('.tl__year').forEach((y) => {
      gsap.from(y, { yPercent: 60, opacity: 0, ease: 'power3.out', scrollTrigger: { trigger: y, containerAnimation: tween, start: 'left 90%', toggleActions: 'play none none reverse' } });
    });
  });
  mm.add('(max-width: 760px)', () => {
    $$('.tl').forEach((t) => gsap.from(t, { y: 60, opacity: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: t, start: 'top 85%' } }));
  });
  gsap.from('.life__head h2', { y: 80, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.life', start: 'top 80%' } });

  /* ---- record ---- */
  const recWords = splitWords($('.record__copy h2'), true);
  gsap.from(recWords.map((w) => w.firstChild), { yPercent: 110, duration: 1, stagger: .05, ease: 'expo.out', scrollTrigger: { trigger: '.record__copy h2', start: 'top 80%' } });
  gsap.from('.record__card', { y: 120, rotate: -6, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.record', start: 'top 70%' } });
  gsap.from('.seal', { scale: 0, rotate: -180, duration: 1.2, ease: 'back.out(1.6)', scrollTrigger: { trigger: '.record', start: 'top 55%' } });
  gsap.from('.record__copy p, .record__copy blockquote', { y: 40, opacity: 0, stagger: .12, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: '.record__big', start: 'top 80%' } });
  gsap.fromTo('.record__bg', { scale: .7 }, { scale: 1.15, ease: 'none', scrollTrigger: { trigger: '.record', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ---- gallery parallax ---- */
  $$('.gcol').forEach((col) => {
    const sp = parseFloat(col.dataset.speed) || 0;
    gsap.fromTo(col, { yPercent: -sp * 50 }, { yPercent: sp * 50, ease: 'none', scrollTrigger: { trigger: '.gallery__cols', start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  $$('.gcol figure').forEach((f) => {
    gsap.from(f, { clipPath: 'inset(100% 0 0 0)', duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: f, start: 'top 92%' } });
  });
  gsap.from('.gallery__head h2', { y: 80, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.gallery', start: 'top 75%' } });

  /* ---- manifesto ---- */
  const manWords = splitWords($('#manifesto'));
  gsap.to(manWords, { opacity: 1, stagger: .1, ease: 'none', scrollTrigger: { trigger: '.manifesto', start: 'top 70%', end: 'bottom 70%', scrub: true } });

  /* ---- donate ---- */
  $$('.donate__title span').forEach((line) => {
    const inner = document.createElement('span');
    inner.style.display = 'block';
    while (line.firstChild) inner.appendChild(line.firstChild);
    line.appendChild(inner);
  });
  gsap.from('.donate__title > span > span', { yPercent: 105, duration: 1.1, stagger: .1, ease: 'expo.out', scrollTrigger: { trigger: '.donate__title', start: 'top 80%' } });
  gsap.from('.dcard', { x: 80, opacity: 0, stagger: .12, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: '.donate__cards', start: 'top 80%' } });
  gsap.from('.donate__copy > *', { y: 40, opacity: 0, stagger: .1, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: '.donate__grid', start: 'top 80%' } });

  /* ---- footer ---- */
  gsap.from('.foot__big', { yPercent: 40, scale: .85, opacity: 0, ease: 'power3.out', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'top 30%', scrub: true } });

  addEventListener('load', () => ScrollTrigger.refresh());
})();
