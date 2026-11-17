// Renders video/promo.html frame by frame into an MP4 with the score (no narration).
// Needs the repo served at BASE (npm run dev in the repo root), Chrome, and the outputs of
// narrate.mjs (audio/vo), score.js (audio/score.wav) and capture.js (cap/).
// Usage:
//   node render.js stills <outDir> [t1,t2,...]   -> PNG key frames for review
//   node render.js mix                           -> audio/mix.wav (voice placed on the timeline, score ducked under it)
//   node render.js video <out.mp4>               -> full render (runs the mix first)
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const ffmpeg = require('ffmpeg-static');

const BASE = process.env.BASE || 'http://localhost:5174';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FPS = +(process.env.FPS || 30);
const COMP = process.env.COMP || 'promo.html';          // COMP=hype.html SCORE=score-hype.wav for the short cut
const SCORE = process.env.SCORE || 'score.wav';
const here = __dirname;
const [mode, outArg, timesArg] = process.argv.slice(2);

async function openComp() {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--font-render-hinting=none']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await page.goto(`${BASE}/video/${COMP}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  return { browser, page };
}

// Voice lines at their timeline offsets; the score ducks under the voice (sidechain) and everything is limited.
function mix(vo, duration) {
  const out = path.join(here, 'audio', 'mix.wav');
  const ids = Object.keys(vo);
  const args = ['-y', '-i', path.join(here, 'audio', SCORE)];
  if (!ids.length) {   // music only
    const r0 = spawnSync(ffmpeg, [...args, '-af', `loudnorm=I=-13:TP=-1.2:LRA=9,alimiter=limit=0.95:level=disabled,atrim=0:${duration}`, '-ar', '48000', '-ac', '2', out], { stdio: ['ignore', 'ignore', 'pipe'] });
    if (r0.status !== 0) { console.error(r0.stderr.toString().slice(-900)); throw new Error('audio mix failed'); }
    console.log('mix ->', out);
    return out;
  }
  for (const id of ids) args.push('-i', path.join(here, 'audio', 'vo', id + '.wav'));
  const parts = ids.map((id, i) => `[${i + 1}:a]aresample=44100,highpass=f=70,adelay=${Math.round(vo[id] * 1000)}:all=1[v${i}]`);
  const graph = [
    ...parts,
    `${ids.map((_, i) => `[v${i}]`).join('')}amix=inputs=${ids.length}:normalize=0:dropout_transition=0,` +
      `acompressor=threshold=-20dB:ratio=3:attack=6:release=160:makeup=1.7,` +
      `equalizer=f=180:t=q:w=1:g=-1.5,equalizer=f=3400:t=q:w=1.2:g=2,volume=1.25,apad=whole_dur=${duration},asplit=2[vox][key]`,
    `[0:a]volume=0.62[mus]`,
    `[mus][key]sidechaincompress=threshold=0.035:ratio=5:attack=25:release=420[duck]`,
    `[duck][vox]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11,alimiter=limit=0.94:level=disabled,atrim=0:${duration},afade=t=out:st=${(duration - 0.6).toFixed(2)}:d=0.6[out]`
  ].join(';');
  args.push('-filter_complex', graph, '-map', '[out]', '-ar', '48000', '-ac', '2', out);
  const r = spawnSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  if (r.status !== 0) { console.error(r.stderr.toString().split('\n').slice(-12).join('\n')); throw new Error('audio mix failed'); }
  console.log('mix ->', out);
  return out;
}

(async () => {
  const { browser, page } = await openComp();
  const duration = await page.evaluate('window.__duration');
  const vo = await page.evaluate('window.__vo');

  if (mode === 'stills') {
    fs.mkdirSync(outArg, { recursive: true });
    const times = timesArg ? timesArg.split(',').map(Number) : COMP !== 'promo.html' ? Array.from({ length: 22 }, (_, i) => +(i * duration / 22 + .22).toFixed(2)) : [2.4, 5.2, 8.6, 10.8, 13.5, 16.4, 20.6, 23.9, 25.5, 26.6, 29.4, 32.6, 34.9, 37.4, 40.4, 44.0, 46.6, 49.5, 52.2, 55.5];
    for (const t of times) {
      await page.evaluate(t => window.__seek(t), t);
      await page.screenshot({ path: path.join(outArg, `t${t.toFixed(1).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88 });
    }
    console.log('stills ->', outArg);
  } else if (mode === 'mix') {
    mix(vo, duration);
  } else {
    const audio = mix(vo, duration);
    // subtitles ship as a sidecar file instead of being burned into the picture
    const caps = await page.evaluate('window.__caps');
    const ts = t => { const ms = Math.round(t * 1000); const p = (n, l = 2) => String(n).padStart(l, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
    const NL = String.fromCharCode(10);
    if (caps.length) fs.writeFileSync(outArg.replace(/\.mp4$/i, '') + '.srt',
      caps.map((c, i) => [i + 1, ts(c[0]) + ' --> ' + ts(c[1]), c[2], ''].join(NL)).join(NL));
    const ff = spawn(ffmpeg, [
      '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-i', audio,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', outArg
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = ''; ff.stderr.on('data', d => { err = (err + d).slice(-2000); });
    const frames = Math.round(duration * FPS), t0 = Date.now();
    for (let f = 0; f < frames; f++) {
      await page.evaluate(t => window.__seek(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 96, optimizeForSpeed: true });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 90 === 0) console.log(`frame ${f}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end();
    const code = await new Promise(r => ff.on('close', r));
    if (code !== 0) { console.error(err); throw new Error('ffmpeg failed'); }
    console.log('video ->', outArg);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
