// Futacoin promo score: 110 BPM, 55 beats (30.0 s). Fully synthesized, no samples.
// Beats 0-11 filtered intro with a koto-like hirajoshi line, 12-15 snare-roll riser, drop on 16 (the Guinness reveal),
// groove to 45, final hit on 46 (end card), outro under the CA.
// The beat markers must match promo.html.
// Usage: node score.js audio/score.wav
const fs = require('fs');
const SR = 44100, BPM = 110, BEAT = 60 / BPM, BEATS = 55, TOTAL = BEATS * BEAT;
const RISE = 12, DROP = 16, HIT = 46, INTRO_CUTS = [0, 4, 8, 9, 10, 11], FILLS = [23, 31, 39];
const outFile = process.argv[2] || 'audio/score.wav';
const N = Math.ceil(SR * (TOTAL + 1));
const L = new Float32Array(N), R = new Float32Array(N), SL = new Float32Array(N), SRr = new Float32Array(N);
const DUCK = new Float32Array(N).fill(1), K = new Float32Array(N);   // K: kick bus, never ducked
let seed = 2003;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647), noise = () => rnd() * 2 - 1;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12), ix = t => Math.round(t * SR), bt = b => b * BEAT;
const put = (i, l, r, send = 0) => { if (i < 0 || i >= N) return; L[i] += l; R[i] += r; if (send) { SL[i] += l * send; SRr[i] += r * send; } };
class LP { constructor() { this.y = 0; } p(x, a) { this.y += a * (x - this.y); return this.y; } }
const lpA = f => 1 - Math.exp(-2 * Math.PI * Math.min(f, SR * .45) / SR);

function kick(t0, amp = 1, duck = true, cut = 0) {
  const n = ix(.36), i0 = ix(t0), fl = new LP(); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += 2 * Math.PI * (48 + 140 * Math.exp(-t * 38)) / SR;
    let v = Math.tanh(Math.sin(ph) * Math.exp(-t * 9) * 1.8) * amp + (i < 60 ? noise() * .3 * amp * (1 - i / 60) : 0);
    if (cut) v = fl.p(v, lpA(cut));
    if (i0 + i < N) K[i0 + i] += v;
  }
  if (duck) { const sn = ix(.26); for (let i = 0; i < sn; i++) { const j = i0 + i; if (j < N) DUCK[j] = Math.min(DUCK[j], 1 - .8 * Math.pow(1 - i / sn, 1.6)); } }
}
function clap(t0, amp) {
  const i0 = ix(t0), a = new LP(), b = new LP();
  for (const off of [0, .011, .023]) {
    const n = ix(.16), j0 = i0 + ix(off);
    for (let i = 0; i < n; i++) {
      const t = i / SR, x = noise(), bp = a.p(x, lpA(3800)) - b.p(x, lpA(900));
      const v = bp * Math.exp(-t * (off === .023 ? 22 : 70)) * amp;
      put(j0 + i, v * .9, v * 1.1, .6);
    }
  }
}
function snare(t0, amp) {
  const n = ix(.14), i0 = ix(t0), a = new LP(); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += 2 * Math.PI * (190 + 80 * Math.exp(-t * 30)) / SR;
    const x = noise(), hp = x - a.p(x, lpA(1400));
    const v = (hp * .8 * Math.exp(-t * 32) + Math.sin(ph) * .5 * Math.exp(-t * 40)) * amp;
    put(i0 + i, v, v, .35);
  }
}
function hat(t0, amp, pan = 0, len = .045) {
  const n = ix(len), i0 = ix(t0); let prev = 0;
  for (let i = 0; i < n; i++) { const x = noise(), hp = x - prev; prev = x; const v = hp * Math.exp(-(i / SR) * (3 / len)) * amp; put(i0 + i, v * (1 - pan), v * (1 + pan), .1); }
}
function bass(t0, dur, m, amp) {
  const f = mtof(m), n = ix(dur), i0 = ix(t0), fl = new LP(); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += f / SR; ph -= Math.floor(ph);
    let v = Math.sin(2 * Math.PI * ph) * .7 + fl.p(ph * 2 - 1, lpA(300 + 1400 * Math.exp(-t * 12))) * .55;
    v = Math.tanh(v * 1.6) * Math.min(1, t / .006) * Math.min(1, (dur - t) / .03) * amp;
    put(i0 + i, v, v);
  }
}
function stab(t0, notes, amp, dur = .22, bright = 5200) {
  const n = ix(dur + .25), i0 = ix(t0);
  for (const m of notes) {
    const f = mtof(m), fl = new LP(), ph = [rnd(), rnd(), rnd()], det = [-.09, 0, .1], pan = (rnd() - .5) * .8;
    for (let i = 0; i < n; i++) {
      const t = i / SR; let v = 0;
      for (let d = 0; d < 3; d++) { ph[d] += f * Math.pow(2, det[d] / 12) / SR; ph[d] -= Math.floor(ph[d]); v += ph[d] * 2 - 1; }
      v = fl.p(v / 3, lpA(500 + bright * Math.exp(-t * 9))) * Math.min(1, t / .004) * (t > dur ? Math.max(0, 1 - (t - dur) / .25) : 1) * amp;
      put(i0 + i, v * (1 - pan * .5), v * (1 + pan * .5), .5);
    }
  }
}
function pluck(t0, m, amp, pan = 0) {
  const f = mtof(m), n = ix(.4), i0 = ix(t0), fl = new LP(); let ph = rnd();
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += f / SR; ph -= Math.floor(ph);
    let v = fl.p((Math.abs(ph * 4 - 2) - 1) * .6 + (ph * 2 - 1) * .4, lpA(700 + 6500 * Math.exp(-t * 18)));
    v *= Math.exp(-t * 9) * Math.min(1, t / .003) * amp;
    put(i0 + i, v * (1 - pan), v * (1 + pan), .45);
  }
}
function sweep(t0, t1, amp, f0, f1, down = false) {
  const n = ix(t1 - t0), i0 = ix(t0), a = new LP(), b = new LP(), c = new LP(), d = new LP();
  for (let i = 0; i < n; i++) {
    const k = i / n, kk = down ? 1 - k : k, env = Math.pow(kk, 2) * amp, al = lpA(f0 + (f1 - f0) * kk * kk);
    put(i0 + i, a.p(b.p(noise(), al), al) * env, c.p(d.p(noise(), al), al) * env, .4);
  }
}
function riseTone(t0, t1, amp) {
  const n = ix(t1 - t0), i0 = ix(t0); let ph = 0;
  for (let i = 0; i < n; i++) { const k = i / n; ph += 2 * Math.PI * (220 * Math.pow(2, k * 2)) / SR; const v = Math.sin(ph) * k * k * amp; put(i0 + i, v, v, .5); }
}
function impact(t0, amp) {
  const n = ix(2.2), i0 = ix(t0), fl = new LP(), fr = new LP(); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += 2 * Math.PI * (38 + 70 * Math.exp(-t * 10)) / SR;
    const sub = Math.sin(ph) * Math.exp(-t * 3) * .9, al = lpA(11000 * Math.exp(-t * 2.6) + 300);
    put(i0 + i, (sub + fl.p(noise(), al) * Math.exp(-t * 3) * .55) * amp, (sub + fr.p(noise(), al) * Math.exp(-t * 3) * .55) * amp, .7);
  }
}

/* ---------------- arrangement (D minor: Dm - Bb - F - C) ---------------- */
const CH = [{ b: 38, c: [62, 65, 69, 72] }, { b: 34, c: [58, 62, 65, 70] }, { b: 41, c: [60, 65, 69, 72] }, { b: 36, c: [60, 64, 67, 72] }];
// intro: muffled kick, stabs on the picture cuts
for (let b = 0; b < RISE; b++) kick(bt(b), .5 + b * .03, false, 260 + b * 70);
for (const b of INTRO_CUTS) stab(bt(b), CH[b < 6 ? 0 : 1].c, .12, .14, 2600 + b * 220);
for (let b = 0; b < RISE; b++) { bass(bt(b) + BEAT / 2, BEAT * .4, 26, .2 + b * .015); hat(bt(b) + BEAT / 2, .05 + b * .006, .2); }
sweep(bt(RISE - 5), bt(RISE), .14, 300, 4000);
const KOTO = [74, 76, 77, 81, 82, 81, 77, 76, 74, 69, 70, 74, 76, 77, 81, 86, 82, 81, 77, 76, 81, 82, 86, 88];
for (let s = 0; s < RISE * 2; s++) pluck(bt(s / 2), KOTO[s], .09 + s * .002, s % 2 ? .35 : -.35);
// riser: snare roll that doubles each beat
[[0, 2], [1, 4], [2, 8], [3, 12]].forEach(([o, div]) => { for (let k = 0; k < div; k++) snare(bt(RISE + o) + k * BEAT / div, .2 + o * .09 + k * .01); });
sweep(bt(RISE), bt(DROP), .5, 400, 12000);
riseTone(bt(RISE), bt(DROP), .12);
for (let o = 0; o < 3; o++) stab(bt(RISE + o), [62 + o * 2, 69 + o * 2], .1 + o * .03, .1, 6000);
// drop + groove
impact(bt(DROP), .8);
sweep(bt(DROP), bt(DROP + 2), .3, 9000, 300, true);
for (let b = DROP; b < HIT; b++) {
  const bar = Math.floor((b - DROP) / 4), ch = CH[bar % 4], t = bt(b), pos = (b - DROP) % 4;
  kick(t, .95);
  if (pos % 2 === 1) clap(t, .5);
  hat(t + BEAT / 2, .16, .25, .07);
  for (let s = 0; s < 4; s++) hat(t + s * BEAT / 4, s % 2 ? .05 : .035, s % 2 ? -.3 : .3);
  bass(t + BEAT / 2, BEAT * .42, ch.b - 12, .5); bass(t + BEAT * .75, BEAT * .2, ch.b, .28);
  if (pos === 0) stab(t, ch.c, .16, .3); if (pos === 2) stab(t + BEAT / 2, ch.c, .11, .16); if (pos === 3) stab(t + BEAT * .75, ch.c.map(m => m + 12), .07, .1, 7000);
  const tones = [...ch.c, ch.c[0] + 12, ch.c[1] + 12];
  for (let s = 0; s < 4; s++) pluck(t + s * BEAT / 4, tones[[0, 3, 1, 4, 2, 5, 3, 1, 4, 2, 5, 0, 3, 5, 1, 4][(pos * 4 + s)]] + 12, s === 0 ? .1 : .065, s % 2 ? .5 : -.5);
  if (pos === 0) pluck(t, [86, 82, 81, 77, 86, 88, 89, 86][bar % 8], .14, 0);
  if (pos === 2) pluck(t + BEAT / 2, [81, 77, 76, 74, 81, 82, 81, 77][bar % 8], .1, 0);
}
// fills into the cuts
for (const b of FILLS) { for (let k = 0; k < 4; k++) snare(bt(b) + BEAT / 2 + k * BEAT / 8, .25 + k * .05); sweep(bt(b), bt(b + 1), .22, 800, 9000); }
for (let k = 0; k < 8; k++) snare(bt(HIT - 1) + k * BEAT / 8, .22 + k * .05);
sweep(bt(HIT - 2), bt(HIT), .45, 500, 12000); riseTone(bt(HIT - 2), bt(HIT), .08);
// final hit, then a half-time outro under the end card (the CA has to be readable, not silent)
impact(bt(HIT), .85); kick(bt(HIT), 1);
stab(bt(HIT), [50, 62, 65, 69, 74, 77], .2, 2.6, 3600);
for (let s = 0; s < 12; s++) pluck(bt(HIT) + s * BEAT / 2, [74, 77, 81, 86, 81, 77][s % 6] + (s > 5 ? 12 : 0), .11 * Math.pow(.86, s), s % 2 ? .5 : -.5);
for (let b = HIT + 2; b < BEATS - 2; b += 2) {
  const ch = CH[Math.floor((b - HIT) / 4) % 4], t = bt(b);
  kick(t, .7);
  bass(t + BEAT / 2, BEAT * .8, ch.b - 12, .32);
  stab(t, ch.c, .07, .5, 2200);
  hat(t + BEAT, .08, .2, .06);
}

/* ---------------- delay, reverb, master ---------------- */
{ const d = ix(BEAT * .75); for (let i = d; i < N; i++) { SL[i] += SRr[i - d] * .3; SRr[i] += SL[i - d] * .3; } }
function reverb(inp, combs, aps) {
  const out = new Float32Array(N);
  for (const [len, fbk] of combs) { const buf = new Float32Array(len), lp = new LP(); let p = 0; for (let i = 0; i < N; i++) { const y = buf[p]; out[i] += y; buf[p] = inp[i] + lp.p(y, .5) * fbk; p = (p + 1) % len; } }
  for (const len of aps) { const buf = new Float32Array(len); let p = 0; for (let i = 0; i < N; i++) { const b = buf[p], x = out[i] + b * -.5; buf[p] = x; out[i] = b + x * .5; p = (p + 1) % len; } }
  return out;
}
const wetL = reverb(SL, [[1557, .8], [1617, .81], [1491, .79], [1422, .8]], [225, 556]);
const wetR = reverb(SRr, [[1580, .8], [1640, .81], [1514, .79], [1445, .8]], [248, 579]);
let peak = 0; const end = ix(TOTAL), fo = ix(1.6);
for (let i = 0; i < N; i++) {
  const g = .35 + .65 * DUCK[i];
  const f = i > end - fo ? Math.max(0, (end - i) / fo) : 1;
  L[i] = Math.tanh((L[i] * g + K[i] + wetL[i] * .05) * 1.5) * f; R[i] = Math.tanh((R[i] * g + K[i] + wetR[i] * .05) * 1.5) * f;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const gain = .92 / (peak || 1), frames = ix(TOTAL), buf = Buffer.alloc(44 + frames * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + frames * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(frames * 4, 40);
for (let i = 0; i < frames; i++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4); }
fs.mkdirSync(require('path').dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, buf);
console.log(`futa score -> ${outFile}  ${TOTAL.toFixed(3)}s, drop at ${bt(DROP).toFixed(3)}s`);
