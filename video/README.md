# Futacoin promo video

A 30 s, 1920×1080, 30 fps motion piece with an original synthesized score. No narration, no X link.

| Step | Command | Output |
| --- | --- | --- |
| Score | `node score.js audio/score.wav` | 110 BPM, 55 beats; koto-style hirajoshi intro, drop on beat 16 (Guinness reveal), hit on beat 46 (end card) |
| Composition | `promo.html` | GSAP timeline, seekable with `window.__seek(t)` |
| Render | `node render.js video futacoin-promo.mp4` | MP4 (H.264 + AAC) |

The site's dev server must be running (`npm run dev` in the repo root, port 5174), and Chrome must be installed.

- `node render.js stills stills 3.6,9.6,28.5` renders key frames.
- `http://localhost:5174/video/promo.html?play` plays it in a browser; `?t=12` seeks.
- Scene beats in `promo.html` and the markers in `score.js` must match (beat = 60/110 s).

Photos: Wikimedia Commons (Misei sen, CC BY 4.0; KQuhen, CC BY-SA 4.0; "Red panda fuuta", CC BY-SA 3.0);
Guinness certificate photo: Chiba Zoological Park (@ChibaZoo).
