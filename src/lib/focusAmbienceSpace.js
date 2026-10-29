/**
 * focusAmbienceSpace.js — three deep-space scenes for Focus Mode.
 *
 *   Solar System .. a tilted, live orbital model: a churning Sun with corona
 *                   rays and prominences, eight planets lit *from the Sun*
 *                   (terminators, banded Jupiter with its Red Spot and moons,
 *                   Saturn's split rings passing in front of / behind the
 *                   planet, Earth + Moon), a drifting asteroid belt, and a
 *                   comet that is bent by the Sun's gravity and always
 *                   trails its ion + dust tails away from it.
 *   Milky Way ..... a barred spiral galaxy seen at an angle: ~25k stars laid
 *                   along four logarithmic arms, dust lanes, pink HII
 *                   regions, a glowing bar + bulge, both Magellanic Clouds,
 *                   a twinkling star layer, the occasional supernova, and a
 *                   small "you are here" marker on the Orion Spur. The disc
 *                   is baked once into a sprite and rotated (a density-wave
 *                   pattern turns rigidly, so this is physically honest and
 *                   costs one drawImage per frame).
 *   Black Hole .... Gargantua-style: a pitch-black shadow ringed by a photon
 *                   ring, a thin accretion disc whose far side is lensed
 *                   over the top and under the bottom, Doppler beaming (the
 *                   approaching side is brighter and bluer), gas spiralling
 *                   inward, and a star field that is genuinely lensed —
 *                   stars drift past, smear into arcs and slide around the
 *                   Einstein ring.
 *
 * Same contract as focusAmbience.js: each create*Renderer() returns a
 * (ctx, canvas, time) => void function driven by FocusModeAmbient's rAF
 * loop, owns all of its own state, and re-initialises when the canvas is
 * resized. Motion is scaled by real frame time, so 120Hz screens don't run
 * fast. This file is deliberately self-contained (no import from
 * focusAmbience.js) so the registry there can import it without a cycle.
 */

const TAU = Math.PI * 2;
const rand = (a, b) => Math.random() * (b - a) + a;
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// ~N(0,1) from four uniforms — plenty for scattering stars around an arm.
const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += Math.random(); return (u - 2) / 0.577; };

// Frame-time scaler: 1.0 at 60fps, clamped so a background-tab hiccup can't teleport things.
function makeStepper() {
  let last = 0;
  return (time) => {
    const d = last ? Math.min(3, Math.max(0.2, (time - last) / 16.667)) : 1;
    last = time;
    return d;
  };
}

function makeLayer(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

const STAR_TINTS = ['255,255,255', '214,228,255', '255,238,216', '190,210,255', '255,214,190'];

// Static star sprinkle painted once into a layer. A few of the brighter ones
// get a soft halo so the field has depth instead of being uniform dots.
function scatterStars(c, w, h, count) {
  for (let i = 0; i < count; i++) {
    const m = Math.random();
    const r = m < .86 ? rand(.25, .8) : m < .97 ? rand(.8, 1.3) : rand(1.3, 2.1);
    const a = rand(.25, .95) * (r < .8 ? .75 : 1);
    const x = rand(0, w), y = rand(0, h), tint = pick(STAR_TINTS);
    if (r > 1.35) {
      const g = c.createRadialGradient(x, y, 0, x, y, r * 6);
      g.addColorStop(0, `rgba(${tint},${(a * .35).toFixed(2)})`); g.addColorStop(1, `rgba(${tint},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 6, 0, TAU); c.fill();
    }
    c.fillStyle = `rgba(${tint},${a.toFixed(2)})`;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
}

// A handful of live-twinkling stars drawn every frame on top of a static layer.
// Sorted by tint so the draw loop below can hold one fillStyle across a run of
// stars instead of building a fresh "rgba(...)" string (a heap allocation) for
// every star on every frame — that per-star string churn was the single
// biggest GC/CPU cost of this effect at 60fps.
function makeTwinklers(w, h, n) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push({ x: rand(0, w), y: rand(0, h), r: rand(.6, 1.6), ph: rand(0, TAU), sp: rand(.6, 2.4), tint: pick(STAR_TINTS) });
  arr.sort((a, b) => a.tint < b.tint ? -1 : a.tint > b.tint ? 1 : 0);
  return arr;
}
function drawTwinklers(ctx, arr, t) {
  let lastTint = null;
  ctx.globalAlpha = 1;
  arr.forEach((s) => {
    if (s.tint !== lastTint) { ctx.fillStyle = `rgb(${s.tint})`; lastTint = s.tint; }
    const f = .25 + .75 * (.5 + .5 * Math.sin(t * s.sp + s.ph));
    ctx.globalAlpha = f * .9 * (s.k === undefined ? 1 : s.k);
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (.8 + .3 * f), 0, TAU); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SOLAR SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */
const K_ORBIT = .0181; // omega = K / a^1.5 (Kepler's third law); Earth laps in ~60s
const PLANET_DEFS = [
  { name: 'Mercury', a: .14, e: .12, size: 2.7, c: ['#e6dfd3', '#9b9388', '#2f2b28'] },
  { name: 'Venus', a: .21, e: .02, size: 5.2, c: ['#fff3cf', '#e6bf72', '#6d4d22'], glow: '255,214,140' },
  { name: 'Earth', a: .29, e: .025, size: 5.6, c: ['#bfe3ff', '#2f80da', '#08224d'], glow: '110,180,255', kind: 'earth' },
  { name: 'Mars', a: .37, e: .09, size: 3.9, c: ['#ffb997', '#cb5630', '#3d130a'], kind: 'mars' },
  { name: 'Jupiter', a: .63, e: .05, size: 12.5, c: ['#f3dfc0', '#c9a06d', '#4a3221'], kind: 'jupiter' },
  { name: 'Saturn', a: .76, e: .06, size: 10.5, c: ['#fbebc4', '#d9bb7c', '#4d3d20'], kind: 'saturn' },
  { name: 'Uranus', a: .88, e: .045, size: 6.6, c: ['#dcfbff', '#8fd8e2', '#1e5560'], glow: '150,235,245' },
  { name: 'Neptune', a: .98, e: .012, size: 6.4, c: ['#a9c4ff', '#3d61e0', '#0d1a5c'], glow: '90,130,255' },
];
const JUPITER_BANDS = [
  [-.86, .16, 'rgba(120,84,56,.35)'], [-.62, .14, 'rgba(238,220,188,.35)'], [-.42, .16, 'rgba(150,100,66,.55)'],
  [-.2, .12, 'rgba(244,228,196,.4)'], [.02, .2, 'rgba(160,104,68,.5)'], [.28, .12, 'rgba(240,222,190,.4)'],
  [.48, .16, 'rgba(146,98,64,.5)'], [.72, .16, 'rgba(236,216,184,.32)'], [.9, .12, 'rgba(110,80,58,.4)'],
];
const SATURN_RINGS = [
  [1.24, 1.52, 'rgba(190,170,130,.30)'],
  [1.55, 1.98, 'rgba(238,218,170,.80)'],
  [2.05, 2.36, 'rgba(208,188,144,.62)'],
  [2.44, 2.49, 'rgba(224,208,172,.34)'],
];

export function createSolarSystemRenderer() {
  const step = makeStepper();
  let lw = 0, lh = 0, bg = null, G = null, rayGrad = null;
  let planets = [], twinkle = [];
  const belt = [[], [], []]; // three brightness tiers, each drawn with a single fillStyle
  let comet = null, nextComet = 0;

  // plane (px,py) in "orbit-plane pixels" -> screen. py is also the depth axis (+ = towards viewer).
  const proj = (px, py) => { const yy = py * G.tilt; return [G.cx + px * G.cR - yy * G.sR, G.cy + px * G.sR + yy * G.cR]; };
  const orbitPos = (p, nu) => {
    const r = p.a * G.rMax * (1 - p.e * p.e) / (1 + p.e * Math.cos(nu));
    return [r * Math.cos(nu), r * Math.sin(nu)];
  };

  const init = (w, h) => {
    const landscape = w >= h;
    // Landscape: ecliptic runs left-right, tilted. Portrait: it runs top-bottom so the system fills a phone.
    const tilt = landscape ? clamp(h * .4 / (w * .46), .3, .6) : .62;
    const roll = landscape ? -.17 : -Math.PI / 2 + .32;
    const rMax = landscape ? Math.min(w * .455, h * .43 / tilt) : Math.min(h * .46, w * .47 / tilt);
    G = { w, h, cx: w / 2, cy: h / 2, tilt, roll, cR: Math.cos(roll), sR: Math.sin(roll), rMax, s: clamp(rMax / 800, .62, 1.5), sunR: rMax * .046, landscape };

    planets = PLANET_DEFS.map((d) => ({ ...d, ph: rand(0, TAU), om: K_ORBIT / Math.pow(d.a, 1.5), rr: d.size * G.s, moonPh: rand(0, TAU) }));
    twinkle = makeTwinklers(w, h, 70);

    belt[0].length = belt[1].length = belt[2].length = 0;
    const nBelt = clamp(Math.round(w * h / 3800), 260, 640);
    for (let i = 0; i < nBelt; i++) {
      const a = clamp(.495 + gauss() * .028, .43, .56);
      belt[i % 3].push({ a, ph: rand(0, TAU), om: K_ORBIT / Math.pow(a, 1.5) * rand(.94, 1.06), z: gauss() * .006, s: rand(.9, 1.9) * G.s });
    }

    // ── static backdrop: space, haze, stars, and the faint orbit lines ──
    bg = makeLayer(w, h); const c = bg.getContext('2d');
    const sg = c.createRadialGradient(G.cx, G.cy, 0, G.cx, G.cy, Math.max(w, h) * .75);
    sg.addColorStop(0, 'rgb(12,14,30)'); sg.addColorStop(.5, 'rgb(6,8,20)'); sg.addColorStop(1, 'rgb(2,3,9)');
    c.fillStyle = sg; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = rand(0, w), y = rand(0, h), r = rand(.25, .5) * Math.max(w, h), hue = rand(215, 285);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `hsla(${hue},70%,45%,.07)`); g.addColorStop(1, `hsla(${hue},70%,45%,0)`);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
    const band = c.createLinearGradient(0, h * .1, w, h * .9);
    band.addColorStop(0, 'rgba(170,150,255,0)'); band.addColorStop(.5, 'rgba(170,150,255,.05)'); band.addColorStop(1, 'rgba(170,150,255,0)');
    c.fillStyle = band; c.fillRect(0, 0, w, h);
    const warm = c.createRadialGradient(G.cx, G.cy, 0, G.cx, G.cy, rMax * .95);
    warm.addColorStop(0, 'rgba(255,160,60,.12)'); warm.addColorStop(1, 'rgba(255,160,60,0)');
    c.fillStyle = warm; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
    scatterStars(c, w, h, clamp(Math.round(w * h / 2200), 250, 1100));
    // orbit rings
    c.lineWidth = 1;
    planets.forEach((p) => {
      c.beginPath();
      for (let i = 0; i <= 160; i++) { const [px, py] = orbitPos(p, i / 160 * TAU); const [x, y] = proj(px, py); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.strokeStyle = 'rgba(150,178,236,.13)'; c.stroke();
    });
    comet = null; nextComet = 0;
  };

  /* ── the Sun ── */
  const drawSun = (ctx, x, y, R, t) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    let g = ctx.createRadialGradient(x, y, R * .7, x, y, R * 8);
    g.addColorStop(0, 'rgba(255,196,96,.62)'); g.addColorStop(.1, 'rgba(255,150,50,.30)'); g.addColorStop(.35, 'rgba(255,100,28,.09)'); g.addColorStop(1, 'rgba(255,70,10,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 8, 0, TAU); ctx.fill();
    if (!rayGrad) { rayGrad = ctx.createLinearGradient(0, 0, 1, 0); rayGrad.addColorStop(0, 'rgba(255,205,120,.55)'); rayGrad.addColorStop(1, 'rgba(255,140,40,0)'); }
    for (let k = 0; k < 16; k++) {
      const ang = k / 16 * TAU + t * .04 + Math.sin(k * 2.7) * .18;
      const len = R * (2.3 + 1.9 * (.5 + .5 * Math.sin(t * .8 + k * 1.9)) * (k % 3 === 0 ? 1.4 : 1));
      const wd = R * (.16 + .09 * Math.sin(k * 1.3));
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(len, wd);
      ctx.fillStyle = rayGrad; ctx.beginPath(); ctx.moveTo(R / len * .85, -1); ctx.lineTo(1, 0); ctx.lineTo(R / len * .85, 1); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    g = ctx.createRadialGradient(x - R * .18, y - R * .18, 0, x, y, R);
    g.addColorStop(0, '#fffef2'); g.addColorStop(.35, '#ffe9a0'); g.addColorStop(.75, '#ffb63a'); g.addColorStop(1, '#ff8418');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    // churning surface, clipped to the disc
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
    for (let i = 0; i < 10; i++) {
      const a = i * 2.4 + t * (.05 + i * .008), rr = R * (.15 + .62 * ((i * .37) % 1));
      const bx = x + Math.cos(a) * rr, by = y + Math.sin(a * 1.3) * rr * .9, br = R * (.3 + .12 * Math.sin(t * .7 + i));
      const gg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      gg.addColorStop(0, i % 2 ? 'rgba(255,250,210,.36)' : 'rgba(255,110,20,.30)'); gg.addColorStop(1, 'rgba(255,150,30,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < 2; i++) { // sunspots rotating across the face
      const lon = t * .07 + i * 2.6, cl = Math.cos(lon);
      if (cl > .15) { ctx.fillStyle = 'rgba(96,32,0,.55)'; ctx.beginPath(); ctx.ellipse(x + Math.sin(lon) * R * .7, y + (i ? .25 : -.3) * R, R * .07 * cl, R * .07, 0, 0, TAU); ctx.fill(); }
    }
    const ld = ctx.createRadialGradient(x, y, R * .55, x, y, R);
    ld.addColorStop(0, 'rgba(120,30,0,0)'); ld.addColorStop(1, 'rgba(120,30,0,.55)');
    ctx.fillStyle = ld; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    ctx.restore();
    // prominences looping off the limb
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = t * .03 + i * 1.6 + Math.sin(t * .2 + i) * .3, lift = R * (.14 + .08 * Math.sin(t * .6 + i * 2));
      ctx.strokeStyle = `rgba(255,130,40,${(.35 + .2 * Math.sin(t * .9 + i)).toFixed(2)})`; ctx.lineWidth = Math.max(1.5, R * .05);
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * R, y + Math.sin(a) * R, lift, a + Math.PI * .5 - 1.1, a + Math.PI * .5 + 1.1); ctx.stroke();
    }
    ctx.restore();
  };

  /* ── planets ── */
  const ringHalf = (ctx, x, y, ri, ro, ratio, rot, front, fill) => {
    const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU;
    ctx.beginPath();
    ctx.ellipse(x, y, ro, ro * ratio, rot, a0, a1, false);
    ctx.ellipse(x, y, ri, ri * ratio, rot, a1, a0, true);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  };

  const drawPlanet = (ctx, p, x, y, t) => {
    const r = p.rr, lx = G.cx - x, ly = G.cy - y, L = Math.hypot(lx, ly) || 1, ux = lx / L, uy = ly / L;
    const ratio = clamp(G.tilt * .72 + .06, .2, .5);
    if (p.kind === 'saturn') for (const [a, b, col] of SATURN_RINGS) ringHalf(ctx, x, y, a * r, b * r, ratio, G.roll, false, col);
    if (p.glow) {
      ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(x, y, r * .9, x, y, r * 2.4);
      gl.addColorStop(0, `rgba(${p.glow},.30)`); gl.addColorStop(1, `rgba(${p.glow},0)`);
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    const g = ctx.createRadialGradient(x + ux * r * .45, y + uy * r * .45, r * .05, x, y, r * 1.05);
    g.addColorStop(0, p.c[0]); g.addColorStop(.55, p.c[1]); g.addColorStop(1, p.c[2]);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    if (p.kind === 'jupiter' || p.kind === 'saturn') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(G.roll);
      const bands = p.kind === 'jupiter' ? JUPITER_BANDS : JUPITER_BANDS.map(([a, b, c]) => [a, b * .8, c.replace(/[\d.]+\)$/, '.22)')]);
      bands.forEach(([yf, th, col]) => { ctx.fillStyle = col; ctx.fillRect(-r, (yf - th / 2) * r, r * 2, th * r); });
      if (p.kind === 'jupiter') { // Great Red Spot rides round with the rotation
        const lon = t * .32, cl = Math.cos(lon);
        if (cl > 0) { ctx.fillStyle = 'rgba(190,74,48,.8)'; ctx.beginPath(); ctx.ellipse(Math.sin(lon) * r * .82, r * .3, r * .2 * cl, r * .11, 0, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
    } else if (p.kind === 'earth') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(G.roll);
      for (let k = 0; k < 5; k++) { // continents
        const lon = t * .8 + k * 1.3, cl = Math.cos(lon);
        if (cl > 0) { ctx.fillStyle = 'rgba(80,168,96,.88)'; ctx.beginPath(); ctx.ellipse(Math.sin(lon) * r * .78, (k % 2 ? .28 : -.3) * r, r * (.28 + .06 * (k % 3)) * cl, r * .26, 0, 0, TAU); ctx.fill(); }
      }
      for (let k = 0; k < 4; k++) { // clouds
        const lon = t * 1.1 + k * 1.7, cl = Math.cos(lon);
        if (cl > 0) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(Math.sin(lon) * r * .8, (k % 2 ? -.5 : .45) * r, r * .34 * cl, r * .09, 0, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
    } else if (p.kind === 'mars') {
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x, y - r * .86, r * .34, r * .13, G.roll, 0, TAU); ctx.fill();
      const lon = t * .7, cl = Math.cos(lon);
      if (cl > 0) { ctx.fillStyle = 'rgba(70,24,12,.45)'; ctx.beginPath(); ctx.ellipse(x + Math.sin(lon) * r * .6, y + r * .15, r * .32 * cl, r * .2, 0, 0, TAU); ctx.fill(); }
    }
    // day/night terminator
    const tg = ctx.createLinearGradient(x + ux * r, y + uy * r, x - ux * r, y - uy * r);
    tg.addColorStop(0, 'rgba(0,0,0,0)'); tg.addColorStop(.5, 'rgba(0,0,6,.06)'); tg.addColorStop(1, 'rgba(0,0,10,.74)');
    ctx.fillStyle = tg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
    if (p.kind === 'saturn') for (const [a, b, col] of SATURN_RINGS) ringHalf(ctx, x, y, a * r, b * r, ratio, G.roll, true, col);
  };

  const drawMoons = (ctx, p, x, y, t) => {
    if (p.kind === 'earth') {
      const a = p.moonPh + t * .9, R = p.rr * 3.1, mx = x + Math.cos(a) * R, my = y + Math.sin(a) * R * G.tilt;
      if (!(Math.sin(a) < 0 && Math.abs(Math.cos(a)) < .3)) { ctx.fillStyle = 'rgba(214,214,220,.95)'; ctx.beginPath(); ctx.arc(mx, my, Math.max(1.2, p.rr * .27), 0, TAU); ctx.fill(); }
    } else if (p.kind === 'jupiter') {
      const cols = ['#f3d9a0', '#e8e2d4', '#c9c4b8', '#b59a78'];
      for (let i = 0; i < 4; i++) {
        const a = p.moonPh + t * (1.3 - i * .28) + i * 1.9, R = p.rr * (1.9 + i * .55), mx = x + Math.cos(a) * R, my = y + Math.sin(a) * R * G.tilt * .9;
        if (Math.sin(a) < 0 && Math.abs(mx - x) < p.rr) continue;
        ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.arc(mx, my, Math.max(1, p.rr * .085), 0, TAU); ctx.fill();
      }
    }
  };

  /* ── comet: gravity-bent path, tails always point away from the Sun ── */
  const spawnComet = (w, h, time) => {
    const side = randInt(0, 3), m = 60;
    const sx = side === 0 ? -m : side === 1 ? w + m : rand(0, w), sy = side === 2 ? -m : side === 3 ? h + m : rand(0, h);
    const tx = G.cx + rand(-.22, .22) * w, ty = G.cy + rand(-.22, .22) * h, d = Math.hypot(tx - sx, ty - sy) || 1;
    const speed = clamp(w * .0016, 1.2, 3.2);
    comet = { x: sx, y: sy, vx: (tx - sx) / d * speed, vy: (ty - sy) / d * speed, speed, born: time, age: 0 };
  };
  const drawComet = (ctx, dt, w, h, time) => {
    if (!comet) { if (!nextComet) nextComet = time + 5000; if (time > nextComet) spawnComet(w, h, time); else return; }
    const c = comet, dx = G.cx - c.x, dy = G.cy - c.y, d = Math.max(30, Math.hypot(dx, dy)), gm = c.speed * c.speed * G.rMax * .11;
    c.vx += gm * dx / (d * d * d) * dt; c.vy += gm * dy / (d * d * d) * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.age += dt;
    const out = 220;
    if (c.age > 90 && (c.x < -out || c.x > w + out || c.y < -out || c.y > h + out)) { comet = null; nextComet = time + rand(22000, 44000); return; }
    const ax = -dx / d, ay = -dy / d, prox = clamp(1 - d / (G.rMax * 1.15), .04, 1), len = 46 * G.s + prox * G.rMax * .5;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(c.x, c.y);
    const tail = (ang, L, wd, c0, c1) => {
      ctx.save(); ctx.rotate(ang); const g = ctx.createLinearGradient(0, 0, L, 0);
      g.addColorStop(0, c0); g.addColorStop(1, c1);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -wd * .5); ctx.lineTo(L, 0); ctx.lineTo(0, wd * .5); ctx.closePath(); ctx.fill(); ctx.restore();
    };
    const base = Math.atan2(ay, ax);
    tail(base, len, 4.2 * G.s, 'rgba(150,205,255,.62)', 'rgba(120,180,255,0)');
    tail(base + .2, len * .72, 8 * G.s, 'rgba(255,232,190,.42)', 'rgba(255,200,140,0)');
    const cr = 11 * G.s, gl = ctx.createRadialGradient(0, 0, 0, 0, 0, cr);
    gl.addColorStop(0, 'rgba(255,255,255,.95)'); gl.addColorStop(.3, 'rgba(190,225,255,.5)'); gl.addColorStop(1, 'rgba(150,200,255,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, cr, 0, TAU); ctx.fill();
    ctx.restore();
  };

  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; }
    const dt = step(time), t = time * .001;
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bg, 0, 0);
    drawTwinklers(ctx, twinkle, t);

    // where is everything right now
    const state = planets.map((p) => {
      const [px, py] = orbitPos(p, p.ph + p.om * t); const [x, y] = proj(px, py);
      return { p, x, y, depth: py };
    });
    const beltPass = (front) => {
      const cols = ['rgba(170,160,150,.55)', 'rgba(200,190,175,.7)', 'rgba(225,214,196,.85)'];
      for (let g = 0; g < 3; g++) {
        ctx.fillStyle = cols[g];
        for (const b of belt[g]) {
          const ang = b.ph + b.om * t, r = b.a * G.rMax, py = Math.sin(ang) * r;
          if ((py > 0) !== front) continue;
          const [x, y] = proj(Math.cos(ang) * r, py + b.z * G.rMax * 4);
          ctx.fillRect(x, y, b.s, b.s);
        }
      }
    };

    beltPass(false);
    state.filter((s) => s.depth < 0).sort((a, b) => a.depth - b.depth).forEach((s) => { drawPlanet(ctx, s.p, s.x, s.y, t); drawMoons(ctx, s.p, s.x, s.y, t); });
    drawSun(ctx, G.cx, G.cy, G.sunR, t);
    state.filter((s) => s.depth >= 0).sort((a, b) => a.depth - b.depth).forEach((s) => { drawPlanet(ctx, s.p, s.x, s.y, t); drawMoons(ctx, s.p, s.x, s.y, t); });
    beltPass(true);
    drawComet(ctx, dt, w, h, time);

    if (w >= 560) { // small, quiet labels — this is a study app, after all
      ctx.font = `600 ${Math.round(10.5 * clamp(G.s, .85, 1.25))}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(200,216,255,.5)';
      state.forEach(({ p, x, y }) => ctx.fillText(p.name, x, y + p.rr * (p.kind === 'saturn' ? 2.6 : 1.5) + 12));
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MILKY WAY
   ═══════════════════════════════════════════════════════════════════════════ */
const ARMS = 4, PITCH_K = 4.1, ARM_W = [1, .62, 1, .62];
const BAR_ANGLE = .52;

// Angle of arm k at radius r (units of the galaxy radius; arms begin at the bar's end).
const armAngle = (k, r) => BAR_ANGLE + k * (TAU / ARMS) + Math.log(Math.max(r, .2) / .2) * PITCH_K + .1 * Math.sin(r * 11 + k * 2);

export function createMilkyWayRenderer() {
  const step = makeStepper();
  let lw = 0, lh = 0, bg = null, gal = null, bloom = null, G = null;
  let bgTwinkle = [], live = [], nova = null, nextNova = 0, you = null;

  const buildGalaxy = (S) => {
    const R = S / 2, Rg = R * .97;
    const c = makeLayer(S, S).getContext('2d');
    c.translate(R, R);
    const blob = (x, y, r, col) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col); g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    };
    // a point on arm k: u in 0..1 is how far out; spread is the arm's half-width in galaxy radii
    const onArm = (k, u, spread) => {
      const rr = .2 + .8 * Math.pow(u, 1.18);
      const th = armAngle(k, rr) + gauss() * spread / rr;
      return [Math.cos(th) * rr * Rg, Math.sin(th) * rr * Rg, rr];
    };
    const armK = () => { let m = Math.random() * ARM_W.reduce((a, b) => a + b, 0); for (let k = 0; k < ARMS; k++) { m -= ARM_W[k]; if (m <= 0) return k; } return 0; };

    c.globalCompositeOperation = 'lighter';
    // 1. faint whole-disc glow
    const dg = c.createRadialGradient(0, 0, 0, 0, 0, R);
    dg.addColorStop(0, 'rgba(255,214,160,.42)'); dg.addColorStop(.12, 'rgba(255,200,150,.26)'); dg.addColorStop(.35, 'rgba(210,180,190,.10)'); dg.addColorStop(.7, 'rgba(120,140,210,.05)'); dg.addColorStop(1, 'rgba(80,100,180,0)');
    c.fillStyle = dg; c.fillRect(-R, -R, S, S);
    // 2. gas glowing along the arms (blue-white outside, warmer in, patches of pink)
    const nGas = Math.round(S * .5);
    for (let i = 0; i < nGas; i++) {
      const k = armK(), [x, y, rr] = onArm(k, Math.random(), .05);
      const pink = Math.random() < .16 && rr > .35;
      blob(x, y, Rg * rand(.03, .085) * (.6 + rr), pink ? 'rgba(255,110,170,.05)' : rr < .4 ? 'rgba(255,196,140,.05)' : 'rgba(150,176,255,.042)');
    }
    // 3. stars — a smooth disc population, then the arm populations on top
    const tints = ['255,244,226', '255,236,208', '232,238,255', '208,224,255', '255,222,178'];
    const nDisk = Math.round(S * S / 100), nArm = Math.round(S * S / 62);
    for (let i = 0; i < nDisk; i++) {
      const rr = Math.pow(Math.random(), 1.7) * .97, a = Math.random() * TAU;
      c.fillStyle = `rgba(${pick(tints)},${(rand(.12, .5) * (1 - rr * .6)).toFixed(2)})`;
      c.fillRect(Math.cos(a) * rr * Rg, Math.sin(a) * rr * Rg, 1, 1);
    }
    for (let i = 0; i < nArm; i++) {
      const k = armK(), u = Math.random(), [x, y, rr] = onArm(k, u, .022 + .03 * u);
      const blue = Math.random() < .35 + rr * .4, big = Math.random() < .045;
      c.fillStyle = `rgba(${blue ? pick(tints.slice(2, 4)) : pick(tints)},${(rand(.3, .95) * (1 - rr * .35)).toFixed(2)})`;
      const s = big ? 2 : 1; c.fillRect(x, y, s, s);
    }
    // 4. dust lanes hugging the inner edge of each arm (needs source-over to actually darken)
    c.globalCompositeOperation = 'source-over';
    const nDust = Math.round(S * .9);
    for (let i = 0; i < nDust; i++) {
      const k = armK(), u = Math.pow(Math.random(), .8), rr = .24 + .74 * u, th = armAngle(k, rr) - .085 / rr + gauss() * .014 / rr;
      const x = Math.cos(th) * rr * Rg, y = Math.sin(th) * rr * Rg, r = Rg * rand(.014, .04);
      blob(x, y, r, `rgba(6,4,12,${(rand(.10, .2) * (ARM_W[k] * .7 + .3)).toFixed(2)})`);
    }
    c.globalCompositeOperation = 'lighter';
    // 5. bar + bulge (drawn over the dust: the bulge is 3-D, the lanes stop at its edge)
    c.save(); c.rotate(BAR_ANGLE); c.scale(1, .34); blob(0, 0, Rg * .3, 'rgba(255,205,140,.34)'); c.restore();
    for (let i = 0; i < 2600; i++) {
      c.save(); c.rotate(BAR_ANGLE);
      c.fillStyle = `rgba(255,${randInt(205, 236)},${randInt(150, 190)},${rand(.25, .75).toFixed(2)})`;
      c.fillRect(gauss() * Rg * .11, gauss() * Rg * .028, 1, 1); c.restore();
    }
    const bulge = c.createRadialGradient(0, 0, 0, 0, 0, Rg * .16);
    bulge.addColorStop(0, 'rgba(255,250,228,1)'); bulge.addColorStop(.16, 'rgba(255,234,186,.85)'); bulge.addColorStop(.45, 'rgba(255,202,132,.4)'); bulge.addColorStop(1, 'rgba(255,170,90,0)');
    c.fillStyle = bulge; c.beginPath(); c.arc(0, 0, Rg * .16, 0, TAU); c.fill();
    for (let i = 0; i < 2400; i++) { c.fillStyle = `rgba(255,${randInt(222, 246)},${randInt(176, 214)},${rand(.3, .85).toFixed(2)})`; c.fillRect(gauss() * Rg * .05, gauss() * Rg * .05, 1, 1); }
    // 6. HII regions and young blue clusters strung along the arms
    for (let i = 0; i < 70; i++) {
      const [x, y, rr] = onArm(armK(), rand(.25, 1), .022);
      const pink = Math.random() < .7, r = Rg * rand(.006, .017);
      blob(x, y, r * 3.2, pink ? 'rgba(255,100,170,.26)' : 'rgba(140,190,255,.26)');
      blob(x, y, r, pink ? 'rgba(255,190,225,.85)' : 'rgba(215,236,255,.9)');
    }
    // 7. feather the rim so the disc melts into space instead of ending
    c.globalCompositeOperation = 'destination-in';
    const fade = c.createRadialGradient(0, 0, 0, 0, 0, R);
    fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(.8, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = fade; c.fillRect(-R, -R, S, S);
    return c.canvas;
  };

  const init = (w, h) => {
    const landscape = w >= h, sc = clamp(Math.min(w, h) / 800, .6, 1.6);
    const D = landscape ? w * 1.06 : h * .98, S = Math.round(clamp(D, 560, 1500));
    G = { w, h, cx: w / 2, cy: h / 2, tilt: landscape ? .46 : .5, roll: landscape ? -.34 : -Math.PI / 2 + .34, k: D / S, S, Rg: S * .97 / 2, sc };
    G.cR = Math.cos(G.roll); G.sR = Math.sin(G.roll);

    gal = buildGalaxy(S);
    // Cheap bloom: shrink the disc by halves (proper averaging) and let bilinear upscaling blur it back.
    let cur = gal;
    while (cur.width > 72) {
      const n = makeLayer(cur.width / 2, cur.height / 2), x = n.getContext('2d');
      x.imageSmoothingEnabled = true; x.drawImage(cur, 0, 0, n.width, n.height); cur = n;
    }
    bloom = cur;

    // ── backdrop: space, distant galaxies, the Magellanic Clouds, stars ──
    bg = makeLayer(w, h); const c = bg.getContext('2d');
    const sg = c.createRadialGradient(G.cx, G.cy, 0, G.cx, G.cy, Math.max(w, h) * .8);
    sg.addColorStop(0, 'rgb(7,6,16)'); sg.addColorStop(.6, 'rgb(3,3,10)'); sg.addColorStop(1, 'rgb(1,1,5)');
    c.fillStyle = sg; c.fillRect(0, 0, w, h);
    scatterStars(c, w, h, clamp(Math.round(w * h / 1700), 300, 1300));
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) { // distant galaxies: faint tilted smudges with a bright nucleus
      const x = rand(0, w), y = rand(0, h), r = rand(7, 20) * sc, ang = rand(0, Math.PI), hue = pick([40, 210, 30, 260]);
      c.save(); c.translate(x, y); c.rotate(ang); c.scale(1, rand(.22, .5));
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `hsla(${hue},70%,86%,.55)`); g.addColorStop(.25, `hsla(${hue},60%,70%,.22)`); g.addColorStop(1, `hsla(${hue},60%,60%,0)`);
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.restore();
    }
    const cloud = (x, y, r, n) => { // Magellanic-cloud style irregular glow
      for (let i = 0; i < n; i++) {
        const bx = x + gauss() * r * .45, by = y + gauss() * r * .3, br = r * rand(.25, .6);
        const g = c.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, 'rgba(196,214,255,.11)'); g.addColorStop(1, 'rgba(196,214,255,0)');
        c.fillStyle = g; c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill();
      }
      for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(230,238,255,${rand(.2, .7).toFixed(2)})`; c.fillRect(x + gauss() * r * .5, y + gauss() * r * .32, 1, 1); }
    };
    cloud(w * (landscape ? .87 : .8), h * (landscape ? .84 : .9), 46 * sc, 16);
    cloud(w * (landscape ? .78 : .62), h * (landscape ? .92 : .95), 22 * sc, 9);
    // Both star counts below scale with actual screen area (like nDisk/nArm
    // above) instead of being flat constants — a phone canvas used to pay
    // for the same 110 + 380 live-drawn stars as a 1440p monitor despite
    // having a fraction of the pixels to show them on.
    bgTwinkle = makeTwinklers(w, h, clamp(Math.round(w * h / 9000), 60, 150));

    // Stars that shimmer inside the disc (fixed in the galaxy's frame so they
    // turn with it). Sorted by tint for the same reason as makeTwinklers.
    live = [];
    const nLive = clamp(Math.round(w * h / 5600), 160, 420);
    for (let i = 0; i < nLive; i++) {
      const k = Math.random() < .8 ? [0, 2][randInt(0, 1)] : [1, 3][randInt(0, 1)], rr = .2 + .8 * Math.pow(Math.random(), 1.1);
      const th = armAngle(k, rr) + gauss() * (.03 + .03 * rr) / rr;
      live.push({ r: rr, th, ph: rand(0, TAU), sp: rand(.7, 2.8), s: rand(.7, 1.9), tint: pick(['255,244,226', '215,228,255', '255,226,190']) });
    }
    live.sort((a, b) => a.tint < b.tint ? -1 : a.tint > b.tint ? 1 : 0);
    const yr = .58; you = { r: yr, th: armAngle(0, yr) - Math.PI / 4 };
    nova = null; nextNova = 0;
  };

  // galaxy-plane (radius in galaxy radii, angle) -> screen
  const toScreen = (r, th, spin, zoom, panX, panY) => {
    const a = th + spin, px = Math.cos(a) * r * G.Rg * G.k * zoom, py = Math.sin(a) * r * G.Rg * G.k * zoom * G.tilt;
    return [G.cx + panX + px * G.cR - py * G.sR, G.cy + panY + px * G.sR + py * G.cR];
  };

  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; }
    step(time);
    const t = time * .001, spin = t * .014, zoom = 1 + .012 * Math.sin(t * .03);
    const panX = Math.sin(t * .045) * w * .012, panY = Math.cos(t * .037) * h * .012;
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bg, 0, 0);
    drawTwinklers(ctx, bgTwinkle, t);

    // The disc: roll * squash * spin, then the same (pre-blurred) sprite again
    // as bloom. This is the heaviest part of the frame — a large image being
    // resampled every frame because it's continuously rotating — so:
    //  - imageSmoothingQuality stays at the browser default ('low') instead
    //    of forcing 'high'. 'high' does noticeably more filtering work per
    //    pixel on a rotated drawImage, and it bought us nothing here since
    //    the source art is already a soft, painterly star field with no fine
    //    detail for extra sampling to preserve.
    //  - one bloom pass instead of two. The original inner+outer pass had a
    //    lot of overlap; a single mid-sized pass reads almost identically
    //    but is one fewer full-canvas drawImage per frame.
    ctx.save();
    ctx.translate(G.cx + panX, G.cy + panY); ctx.rotate(G.roll); ctx.scale(G.k * zoom, G.k * zoom * G.tilt); ctx.rotate(spin);
    ctx.drawImage(gal, -G.S / 2, -G.S / 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .55; ctx.drawImage(bloom, -G.S * .53, -G.S * .53, G.S * 1.06, G.S * 1.06);
    ctx.restore();

    // `live` is pre-sorted by tint (see init), so fillStyle only needs to
    // change when the tint actually changes instead of every star, and we
    // use globalAlpha instead of baking each star's brightness into a fresh
    // "rgba(...)" string — that string was being allocated twice per star,
    // every frame, purely so its alpha channel could differ.
    ctx.globalCompositeOperation = 'lighter';
    let lastLiveTint = null;
    live.forEach((s) => {
      const f = .3 + .7 * (.5 + .5 * Math.sin(t * s.sp + s.ph)), [x, y] = toScreen(s.r, s.th, spin, zoom, panX, panY);
      if (s.tint !== lastLiveTint) { ctx.fillStyle = `rgb(${s.tint})`; lastLiveTint = s.tint; }
      // Skip the soft halo on a dim frame of the twinkle cycle — at f*.16
      // alpha it's already close to invisible, so this cuts a meaningful
      // share of draw calls with no visible loss.
      if (f > .5) { ctx.globalAlpha = f * .16; ctx.beginPath(); ctx.arc(x, y, s.s * 3.2 * G.sc, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = f * .95; ctx.beginPath(); ctx.arc(x, y, s.s * (.8 + .5 * f) * G.sc, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // a supernova every so often
    if (!nova) {
      if (!nextNova) nextNova = t + 4;
      if (t > nextNova) { const k = pick([0, 1, 2, 3]), rr = rand(.3, .9); nova = { r: rr, th: armAngle(k, rr) + gauss() * .02 / rr, t0: t, dur: 3.2 }; }
    } else {
      const age = (t - nova.t0) / nova.dur;
      if (age >= 1) { nova = null; nextNova = t + rand(9, 18); }
      else {
        const b = age < .12 ? age / .12 : Math.exp(-(age - .12) * 3.6), [x, y] = toScreen(nova.r, nova.th, spin, zoom, panX, panY);
        const rad = (10 + 46 * b) * G.sc, g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, `rgba(255,255,255,${(.95 * b).toFixed(2)})`); g.addColorStop(.25, `rgba(190,215,255,${(.5 * b).toFixed(2)})`); g.addColorStop(1, 'rgba(120,160,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(230,240,255,${(.7 * b).toFixed(2)})`; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
        const sp = rad * 1.5; ctx.beginPath(); ctx.moveTo(x - sp, y); ctx.lineTo(x + sp, y); ctx.moveTo(x, y - sp); ctx.lineTo(x, y + sp); ctx.stroke();
        ctx.strokeStyle = `rgba(170,200,255,${(.35 * (1 - age)).toFixed(2)})`; ctx.beginPath(); ctx.arc(x, y, rad * (.6 + age * 2.4), 0, TAU); ctx.stroke();
      }
    }

    // "you are here", out on the Orion Spur
    const [yx, yy] = toScreen(you.r, you.th, spin, zoom, panX, panY);
    if (yx > 40 && yx < w - 90 && yy > 30 && yy < h - 30) {
      const pulse = .5 + .5 * Math.sin(t * 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(255,255,255,${(.25 + .4 * pulse).toFixed(2)})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(yx, yy, 5 + pulse * 5, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(yx, yy, 2, 0, TAU); ctx.fill();
      ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(225,235,255,.62)';
      ctx.fillText('you are here', yx + 13, yy - 9);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   BLACK HOLE  (Gargantua / Interstellar look)
   ═══════════════════════════════════════════════════════════════════════════
   The disc is ~110-210 thin, concentric streaks. The far half of every ring is
   pushed through the point-mass lens equation (ρ' = (ρ + √(ρ²+4E²)) / 2) once
   at init, so it arches over the hole and melts back into the flat disc; the
   near half crosses in front of the shadow; a weaker mirrored copy sits under.

   HOW IT STAYS SMOOTH (the previous version re-stroked ~500 dashed paths every
   ~200 ms and could only afford ~4 ms of that per frame, so the disc updated
   about once a second and the long strokes stalled the other frames too):

     1. BAKE ONCE. Every ring is stroked SOLID, once, into two static layers
        (`below` = halo, far arch, mirrored copy, shadow; `above` = near half),
        with the vignette baked in. The bake is time-sliced (≤ ~9 ms/frame), so
        there is no hitch, and the disc fades in when it is ready.
     2. THE MOTION IS THE GAPS. What visibly moves in the streaks is the small
        breaks between their dashes, sliding along each ring at Kepler-like
        speeds (inner faster). Those are drawn live as tiny dark specks, each
        placed by arc-length along the very same polyline the ring was stroked
        with, at the very same speed and dash pattern as before. A speck's
        strength is worked out at init from how crowded the neighbourhood is
        (an isolated ring loses all its light in a gap; in the dense inner
        disc other rings fill the gap, so it vanishes into the glow).
     3. PER FRAME: bg + 2 bbox-limited layer blits + one stroke() per
        (width × strength) bucket of specks + the photon ring + planet. No
        gradient is rebuilt, no Path2D is created, nothing is allocated.
     4. A tiny governor watches real frame times: if the device can't hold
        ~40 fps it drops speck density in steps (and restores it when it can).
   Everything is resize-safe and rebuilt from scratch when the canvas resizes. */
const BH_COLORS = ['255,251,238', '255,238,196', '255,218,150', '255,190,108', '246,156,76', '216,118,56', '172,86,42'];
const BH_STAR_TINTS = ['255,244,224', '255,228,196', '236,238,255'];
const BH_SP_ALPHA = [0, .24, .47, .71, .92];   // speck opacity per strength level (0 = not drawn)
const BH_SP_LW = [1, 1.7, 2.6];                // speck stroke width per ring-width bin (× scale)
const BH_SP_STYLE = BH_SP_ALPHA.map((a) => `rgba(10,7,5,${a})`);
const BH_NF = 130, BH_NN = 64;                  // polyline resolution: far half / near half

export function createBlackHoleRenderer() {
  let lw = 0, lh = 0, G = null, bg = null, below = null, above = null, bBox = null, aBox = null;
  let rings = [], twinkle = [], job = null, readyAt = -1;
  let spBuf = null, spN = null;
  let lastTime = 0, ema = 16.7, slowRun = 0, fastRun = 0, keep = 4;

  const newBox = () => ({ x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });
  const grow = (b, x, y) => { if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; };
  const finishBox = (b, w, h, m) => {
    const x0 = clamp(Math.floor(b.x0 - m), 0, w), y0 = clamp(Math.floor(b.y0 - m), 0, h);
    const x1 = clamp(Math.ceil(b.x1 + m), 0, w), y1 = clamp(Math.ceil(b.y1 + m), 0, h);
    return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  };

  const init = (w, h) => {
    const land = w >= h;
    const R = land ? Math.min(h * .165, w * .1) : Math.min(w * .21, h * .105);
    const cx = land ? w * .66 : w * .5, cy = land ? h * .42 : h * .4;
    const roll = land ? -.17 : -.3;
    const aMin = R * .5, aMax = land ? cx * 1.06 : w * .78;
    const cr = Math.cos(roll), sr = Math.sin(roll);
    G = { w, h, R, cx, cy, roll, aMin, aMax, cr, sr, sc: clamp(R / 180, .5, 1.5) };
    const scrX = (x, y) => cx + x * cr - y * sr, scrY = (x, y) => cy + x * sr + y * cr;

    for (const old of [bg, below, above]) if (old) old.width = old.height = 0; // let go of the previous size's pixels now
    bg = makeLayer(w, h); below = makeLayer(w, h); above = makeLayer(w, h);
    const b = bg.getContext('2d'), c = below.getContext('2d'); // gradients are context-independent
    job = null; readyAt = -1; lastTime = 0; ema = 16.7; slowRun = fastRun = 0; keep = 4;

    // ── streak rings. Near half: b = a*(tilt + extra opening close to the hole).
    // Far half: same idea with a fatter opening, then lensed (see header).
    const E = R * 1.0;
    const lens = (x, y) => { const rho = Math.hypot(x, y) || 1e-6, k = (rho + Math.sqrt(rho * rho + 4 * E * E)) / (2 * rho); return [x * k, y * k]; };
    const nRing = clamp(Math.round(w * h / 6000), 110, 210);
    rings = [];
    const bb = newBox(), ab = newBox();
    let maxInst = 0;
    for (let i = 0; i < nRing; i++) {
      const u = Math.pow((i + Math.random()) / nRing, 1.6), a = aMin + (aMax - aMin) * u;
      const open = Math.exp(-(a - aMin) / (R * 1.2));
      // The lensed far half starts at x = ±a·k, so the near half is drawn on the same
      // (uniformly scaled) ellipse — the two halves then meet with no notch.
      const kk = (a + Math.sqrt(a * a + 4 * E * E)) / (2 * a), an = a * kk, bN = an * (.17 + .24 * open);
      // far-half opening: fat only for the inner rings (that is what builds the thick
      // dome over the hole); outer rings stay thin so they just melt into the flat disc
      const bl = a * (.17 + .42 * Math.exp(-Math.pow((a - 2.6 * R) / R, 2) / 1.1));
      const far = new Path2D(), fp = new Float32Array((BH_NF + 1) * 2);
      for (let j = 0; j <= BH_NF; j++) {
        const th = Math.PI + j / BH_NF * Math.PI, [x, y] = lens(a * Math.cos(th), bl * Math.sin(th));
        if (j) far.lineTo(x, y); else far.moveTo(x, y);
        fp[2 * j] = x; fp[2 * j + 1] = y;
        grow(bb, scrX(x, y), scrY(x, y)); grow(bb, scrX(x, -y), scrY(x, -y)); // + mirrored copy
      }
      const dl = () => rand(30, 260) * (.6 + u * 1.2) * G.sc, gp = () => rand(1, 7) * G.sc;
      const ringW = (rand(.6, 1.5) + u * 1.5) * G.sc, ringAl = rand(.35, 1) * (.8 + .5 * (1 - u));
      const dash = [dl(), gp(), dl(), gp(), dl(), gp()];
      const ring = {
        a0: a, a: an, b: bN, far, fp, near: a >= R, bi: Math.min(6, Math.floor(Math.pow(u, .5) * 7)),
        lw: ringW, al: ringAl, v: R * .34 / Math.pow(a / R, 1.5),
        // gap pattern (same numbers the old dash array used): gap k starts at gq[k] into a period of P
        P: dash[0] + dash[1] + dash[2] + dash[3] + dash[4] + dash[5], gg: [dash[1], dash[3], dash[5]],
        gq: [dash[0], dash[0] + dash[1] + dash[2], dash[0] + dash[1] + dash[2] + dash[3] + dash[4]],
        lwb: ringW < 1.2 * G.sc ? 0 : ringW < 2 * G.sc ? 1 : 2, np: null, nlev: null, flev: null,
      };
      if (ring.near) {
        ring.np = new Float32Array((BH_NN + 1) * 2);
        for (let j = 0; j <= BH_NN; j++) {
          const th = j / BH_NN * Math.PI, x = an * Math.cos(th), y = bN * Math.sin(th);
          ring.np[2 * j] = x; ring.np[2 * j + 1] = y; grow(ab, scrX(x, y), scrY(x, y));
        }
      }
      rings.push(ring);
    }

    // cumulative arc length of each polyline (specks are placed by arc length)
    const arcLen = (pts) => { const n = pts.length / 2, cum = new Float32Array(n); for (let j = 1; j < n; j++) cum[j] = cum[j - 1] + Math.hypot(pts[2 * j] - pts[2 * j - 2], pts[2 * j + 1] - pts[2 * j - 1]); return cum; };
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      r.fcum = arcLen(r.fp); r.flev = new Uint8Array(BH_NF + 1);
      maxInst += (Math.ceil(r.fcum[BH_NF] / r.P) + 3) * 3;
      if (r.near) { r.ncum = arcLen(r.np); r.nlev = new Uint8Array(BH_NN + 1); maxInst += (Math.ceil(r.ncum[BH_NN] / r.P) + 3) * 3; }
    }
    spBuf = []; spN = new Int32Array(12);
    for (let k = 0; k < 12; k++) spBuf.push(new Float32Array(maxInst * 4));

    // the halo and the haze band are on the `below` layer too
    grow(bb, cx - R * 4.2, cy - R * 4.2); grow(bb, cx + R * 4.2, cy + R * 4.2);
    const bandX = Math.hypot(aMax * cr, aMax * .2 * sr), bandY = Math.hypot(aMax * sr, aMax * .2 * cr);
    grow(bb, cx - bandX, cy - bandY); grow(bb, cx + bandX, cy + bandY);
    bBox = finishBox(bb, w, h, 4 * G.sc + 3);
    aBox = finishBox(ab, w, h, 4 * G.sc + 3);

    // ── cached gradients (local frame = translate(cx,cy) * rotate(roll)).
    const mk = (rgb, stops, x0, y0, x1, y1) => {
      const g = c.createLinearGradient(x0, y0, x1, y1);
      stops.forEach(([p, m]) => g.addColorStop(p, `rgba(${rgb},${m})`));
      return g;
    };
    // dimmer on the receding far-left, blazing near the hole and to its right
    const dStops = [[0, .55], [.36, .7], [.5, .95], [.68, 1], [1, .85]];
    G.discGrad = BH_COLORS.map((rgb) => mk(rgb, dStops, -aMax, 0, aMax, 0));
    G.photonGrad = mk('255,242,218', [[0, .4], [.5, .85], [1, 1]], -R, R, R, -R);
    G.haloGrad = c.createRadialGradient(0, 0, R * .9, 0, 0, R * 4.2);
    G.haloGrad.addColorStop(0, 'rgba(255,190,110,.07)'); G.haloGrad.addColorStop(.3, 'rgba(255,150,70,.035)'); G.haloGrad.addColorStop(1, 'rgba(255,110,40,0)');
    G.bandGrad = c.createRadialGradient(0, 0, 0, 0, 0, aMax);
    const t0 = aMin / aMax;
    G.bandGrad.addColorStop(0, 'rgba(255,170,90,0)'); G.bandGrad.addColorStop(t0 * .8, 'rgba(255,170,90,0)'); G.bandGrad.addColorStop(t0 + .02, 'rgba(255,190,110,.12)');
    G.bandGrad.addColorStop(.3, 'rgba(240,140,64,.06)'); G.bandGrad.addColorStop(1, 'rgba(200,100,40,0)');

    // vignette: baked into every static layer (source-atop for the transparent ones)
    G.vig = b.createRadialGradient(cx, cy, Math.min(w, h) * .35, cx, cy, Math.max(w, h) * .85);
    G.vig.addColorStop(0, 'rgba(0,0,0,0)'); G.vig.addColorStop(1, 'rgba(0,0,0,.5)');
    const vigAt = (x, y) => .5 * smooth(Math.min(w, h) * .35, Math.max(w, h) * .85, Math.hypot(x - cx, y - cy));

    // ── background: warm dark space, haze around the hole, lots of tiny stars
    b.fillStyle = 'rgb(8,6,5)'; b.fillRect(0, 0, w, h);
    const hz = b.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * .8);
    hz.addColorStop(0, 'rgba(96,60,26,.30)'); hz.addColorStop(.45, 'rgba(50,32,16,.16)'); hz.addColorStop(1, 'rgba(10,8,5,0)');
    b.fillStyle = hz; b.fillRect(0, 0, w, h);
    const nS = clamp(Math.round(w * h / 1000), 700, 2600);
    for (let i = 0; i < nS; i++) {
      const m = Math.random(), s = m < .9 ? rand(.4, .9) : rand(.9, 1.5);
      b.fillStyle = `rgba(${pick(BH_STAR_TINTS)},${rand(.18, .8).toFixed(2)})`;
      b.fillRect(rand(0, w), rand(0, h), s, s);
    }
    b.fillStyle = G.vig; b.fillRect(0, 0, w, h);
    twinkle = makeTwinklers(w, h, clamp(Math.round(w * h / 22000), 24, 70));
    twinkle.forEach((s) => { s.k = 1 - vigAt(s.x, s.y); });
    G.vigAt = vigAt;

    // small dark planet, up and to the left of the hole, lit on the side facing it
    const lx = -R * (land ? 3.5 : 2.7), ly = -R * 1.35;
    G.px = clamp(cx + lx * cr - ly * sr, 24, w - 24);
    G.py = clamp(cy + lx * sr + ly * cr, 24, h - 24);
    G.pr = R * .13; G.pAng = Math.atan2(cy - G.py, cx - G.px); G.pk = 1 - vigAt(G.px, G.py);
  };

  // Bakes both static disc layers, yielding every few strokes so the frame loop can
  // hand it a few ms at a time. Runs once per (re)size — never during animation.
  function* bake() {
    const { R, cx, cy, roll, w, h } = G, CH = 4;
    const c = below.getContext('2d');
    c.translate(cx, cy); c.rotate(roll);
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'butt'; c.lineJoin = 'round';
    c.globalAlpha = 1; c.fillStyle = G.haloGrad; c.beginPath(); c.arc(0, 0, R * 4.2, 0, TAU); c.fill();
    c.save(); c.scale(1, .2); c.fillStyle = G.bandGrad; c.beginPath(); c.arc(0, 0, G.aMax, 0, TAU); c.fill(); c.restore();
    yield;

    // far half of the disc, lensed up over the hole (the arch) …
    let last = -1, n = 0;
    for (const r of rings) {
      if (r.bi !== last) { c.strokeStyle = G.discGrad[r.bi]; last = r.bi; }
      c.lineWidth = r.lw; c.globalAlpha = r.al * .55; c.stroke(r.far);
      if (++n % CH === 0) yield;
    }
    // … and a mirrored copy underneath it. The tiny inner rings are mirrored at
    // near-full strength so they close into a halo around the shadow
    // (Einstein-ring style); the outer ones only get a faint echo.
    c.save(); c.scale(1, -1); last = -1;
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i], al = !r.near ? .38 : (i % 4 === 0 ? .16 : 0);
      if (!al) continue;
      if (r.bi !== last) { c.strokeStyle = G.discGrad[r.bi]; last = r.bi; }
      c.lineWidth = r.lw; c.globalAlpha = r.al * al; c.stroke(r.far);
      if (++n % CH === 0) yield;
    }
    c.restore();

    // the shadow: nothing escapes
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.fillStyle = 'rgb(0,0,0)'; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = G.vig; c.fillRect(0, 0, w, h);
    yield;

    // near half of the disc, crossing in front of the shadow
    const d = above.getContext('2d');
    d.translate(cx, cy); d.rotate(roll);
    d.globalCompositeOperation = 'lighter'; d.lineCap = 'butt'; d.lineJoin = 'round';
    last = -1;
    for (const r of rings) {
      if (!r.near) continue;
      if (r.bi !== last) { d.strokeStyle = G.discGrad[r.bi]; last = r.bi; }
      d.lineWidth = r.lw; d.globalAlpha = r.al * .62;
      d.beginPath(); d.ellipse(0, 0, r.a, r.b, 0, 0, Math.PI); d.stroke();
      if (++n % CH === 0) yield;
    }
    d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = 'source-atop'; d.globalAlpha = 1; d.fillStyle = G.vig; d.fillRect(0, 0, w, h);
    yield;
    measureSpecks();
  }

  // Speck strength per polyline vertex = what share of the light at that spot belongs to THIS
  // ring. A gap in an isolated ring removes all of it (full-strength speck); in the dense,
  // blown-out inner disc the neighbours fill the gap and it vanishes (no speck). Measured once,
  // from the baked layers, with a single readback.
  const measureSpecks = () => {
    const { w, h, R, cx, cy, aMax, cr, sr } = G;
    let px = null;
    try {
      const m = makeLayer(w, h), mc = m.getContext('2d');
      mc.fillStyle = '#000'; mc.fillRect(0, 0, w, h);
      if (bBox) mc.drawImage(below, bBox.x, bBox.y, bBox.w, bBox.h, bBox.x, bBox.y, bBox.w, bBox.h);
      mc.globalCompositeOperation = 'lighter';
      if (aBox) mc.drawImage(above, aBox.x, aBox.y, aBox.w, aBox.h, aBox.x, aBox.y, aBox.w, aBox.h);
      px = mc.getImageData(0, 0, w, h).data;
      m.width = m.height = 0;
    } catch (e) { px = null; }
    const lumAt = (x, y) => { // brightest of the 2x2 pixels around the point (a thin line straddles pixels)
      const ix = Math.floor(x - .5), iy = Math.floor(y - .5); let best = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const xx = clamp(ix + dx, 0, w - 1), yy = clamp(iy + dy, 0, h - 1), i = (yy * w + xx) * 4;
        const l = .3 * px[i] + .59 * px[i + 1] + .11 * px[i + 2]; if (l > best) best = l;
      }
      return best;
    };
    const gradA = (x) => { const t = clamp((x + aMax) / (2 * aMax), 0, 1); return t < .36 ? .55 + (t / .36) * .15 : t < .5 ? .7 + ((t - .36) / .14) * .25 : t < .68 ? .95 + ((t - .5) / .18) * .05 : 1 - ((t - .68) / .32) * .15; };
    const colLum = BH_COLORS.map((c) => { const [r, g, b] = c.split(',').map(Number); return .3 * r + .59 * g + .11 * b; });
    for (const r of rings) {
      for (let kind = 0; kind < 2; kind++) {
        const pts = kind ? r.np : r.fp, lev = kind ? r.nlev : r.flev;
        if (!pts) continue;
        const n = pts.length / 2;
        for (let j = 0; j < n; j++) {
          const x = pts[2 * j], y = pts[2 * j + 1], sx = cx + x * cr - y * sr, sy = cy + x * sr + y * cr;
          let al = 0;
          if (sx > -24 && sx < w + 24 && sy > -24 && sy < h + 24 && (kind || x * x + y * y > R * R * 1.02)) {
            if (px) {
              // this ring's own light at its centre line vs everything that landed on that spot
              const c = colLum[r.bi] * (kind ? .62 : .55) * r.al * gradA(x) * Math.min(1, r.lw) * (1 - G.vigAt(sx, sy));
              const S = lumAt(sx, sy); // a clamped-to-white spot hides gaps whatever their share was
              al = clamp(c / Math.max(S, 1), 0, 1) * .95 * (1 - smooth(180, 245, S));
            } else al = smooth(1.8, 4.5, r.a0 / R) * .6; // no readback available: radial rule of thumb
          }
          lev[j] = al < .14 ? 0 : al < .35 ? 1 : al < .6 ? 2 : al < .82 ? 3 : 4;
        }
      }
    }
  };

  // Once the disc exists, move the twinkling stars out from behind it (they used to sit
  // under a full-screen disc layer; now they are drawn over one flat background instead).
  const clearStarsFromDisc = () => {
    try {
      const { w, h } = G, mw = 160, mh = Math.max(24, Math.round(160 * h / w));
      const m = makeLayer(mw, mh), mc = m.getContext('2d');
      mc.drawImage(below, 0, 0, mw, mh); mc.drawImage(above, 0, 0, mw, mh);
      const px = mc.getImageData(0, 0, mw, mh).data;
      m.width = m.height = 0;
      const covered = (x, y) => px[((Math.min(mh - 1, y * mh / h | 0)) * mw + Math.min(mw - 1, x * mw / w | 0)) * 4 + 3] > 2;
      for (const s of twinkle) {
        for (let tries = 0; tries < 14 && covered(s.x, s.y); tries++) { s.x = rand(0, w); s.y = rand(0, h); }
        s.k = 1 - G.vigAt(s.x, s.y);
      }
    } catch (e) { /* mask is a nicety; keep the stars where they are */ }
  };

  // Collects this frame's gap specks for one half (0 = far, 1 = near) into the bucket buffers.
  // A speck for gap k of a ring at time t sits at arc-length  q_k + (t·v mod P) + m·P  — the exact
  // spot the old lineDashOffset = -t·v put it.
  const collect = (t, kind) => {
    for (let ri = 0; ri < rings.length; ri++) {
      if ((ri & 3) >= keep) continue;
      const r = rings[ri], pts = kind ? r.np : r.fp;
      if (!pts) continue;
      const cum = kind ? r.ncum : r.fcum, lev = kind ? r.nlev : r.flev, last = cum.length - 1, L = cum[last];
      if (L < 1) continue;
      const P = r.P, phi = (t * r.v) % P, wb = r.lwb * 4;
      for (let m = -1; ; m++) {
        const base = phi + m * P;
        if (base > L) break;
        for (let k = 0; k < 3; k++) {
          const s0 = base + r.gq[k], s1 = s0 + Math.max(r.gg[k], 1.4);
          if (s1 <= 0 || s0 >= L) continue;
          // segment lookup by arc length (binary search), then linear interpolation
          const a = s0 < 0 ? 0 : s0, bb = s1 > L ? L : s1;
          let lo = 0, hi = last;
          while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= a) lo = mid; else hi = mid; }
          const lv = lev[lo];
          if (!lv) continue;
          const f0 = (a - cum[lo]) / ((cum[lo + 1] - cum[lo]) || 1);
          let lo2 = lo, hi2 = last;
          while (hi2 - lo2 > 1) { const mid = (lo2 + hi2) >> 1; if (cum[mid] <= bb) lo2 = mid; else hi2 = mid; }
          const f1 = (bb - cum[lo2]) / ((cum[lo2 + 1] - cum[lo2]) || 1);
          const bk = r.lwb * 4 + lv - 1, arr = spBuf[bk], o = spN[bk];
          arr[o] = pts[2 * lo] + (pts[2 * lo + 2] - pts[2 * lo]) * f0;
          arr[o + 1] = pts[2 * lo + 1] + (pts[2 * lo + 3] - pts[2 * lo + 1]) * f0;
          arr[o + 2] = pts[2 * lo2] + (pts[2 * lo2 + 2] - pts[2 * lo2]) * f1;
          arr[o + 3] = pts[2 * lo2 + 1] + (pts[2 * lo2 + 3] - pts[2 * lo2 + 1]) * f1;
          spN[bk] = o + 4;
        }
      }
    }
  };
  const flushSpecks = (ctx, alpha) => {
    ctx.save(); ctx.translate(G.cx, G.cy); ctx.rotate(G.roll);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha; ctx.lineCap = 'butt';
    for (let bk = 0; bk < 12; bk++) {
      const n = spN[bk];
      if (!n) continue;
      ctx.strokeStyle = BH_SP_STYLE[(bk & 3) + 1]; ctx.lineWidth = BH_SP_LW[bk >> 2] * G.sc + .3;
      const arr = spBuf[bk];
      ctx.beginPath();
      for (let i = 0; i < n; i += 4) { ctx.moveTo(arr[i], arr[i + 1]); ctx.lineTo(arr[i + 2], arr[i + 3]); }
      ctx.stroke(); spN[bk] = 0;
    }
    ctx.restore();
  };

  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; job = bake(); }
    const t = time * .001;

    // advance the one-off bake, a few ms per frame
    if (job) {
      const t0 = performance.now();
      do {
        if (job.next().done) { job = null; clearStarsFromDisc(); readyAt = time; break; }
      } while (performance.now() - t0 < 9);
    }
    const f = readyAt < 0 ? 0 : smooth(0, 900, time - readyAt); // disc fades in once baked

    // frame-time governor: only ever thins out the specks, never the picture itself
    if (lastTime && f >= 1) {
      const dt = time - lastTime;
      if (dt > 0 && dt < 100) {
        ema += (dt - ema) * .06;
        if (ema > 26) { slowRun++; fastRun = 0; } else if (ema < 19) { fastRun++; slowRun = 0; } else { slowRun = fastRun = 0; }
        if (slowRun > 40 && keep > 1) { keep--; slowRun = 0; }
        if (fastRun > 300 && keep < 4) { keep++; fastRun = 0; }
      }
    }
    lastTime = time;

    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bg, 0, 0);
    drawTwinklers(ctx, twinkle, t);

    if (f > 0) {
      if (bBox) { ctx.globalAlpha = f; ctx.drawImage(below, bBox.x, bBox.y, bBox.w, bBox.h, bBox.x, bBox.y, bBox.w, bBox.h); }
      collect(t, 0); flushSpecks(ctx, f);

      if (aBox) { ctx.globalAlpha = f; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(above, aBox.x, aBox.y, aBox.w, aBox.h, aBox.x, aBox.y, aBox.w, aBox.h); ctx.globalCompositeOperation = 'source-over'; }
      collect(t, 1); flushSpecks(ctx, f);

      // photon ring (+ a faint echo outside it) — live, so it can breathe. Additive, so it goes last
      const { R, cx, cy, roll } = G;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(roll);
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = G.photonGrad;
      const fl = (.94 + .06 * Math.sin(t * 2.3)) * f;
      [[R * .1, .10], [R * .04, .24], [1.3 * G.sc, .95]].forEach(([wd, al]) => { ctx.globalAlpha = al * fl; ctx.lineWidth = wd; ctx.beginPath(); ctx.arc(0, 0, R * 1.03, 0, TAU); ctx.stroke(); });
      ctx.globalAlpha = .22 * f; ctx.lineWidth = 1 * G.sc; ctx.beginPath(); ctx.arc(0, 0, R * 1.16, 0, TAU); ctx.stroke();
      ctx.restore();

    }

    // the little planet (slow drift), rim-lit toward the hole
    ctx.globalAlpha = G.pk; ctx.globalCompositeOperation = 'source-over';
    const px = G.px + Math.sin(t * .05) * G.R * .04, py = G.py + Math.cos(t * .04) * G.R * .03;
    ctx.fillStyle = 'rgb(5,4,3)'; ctx.beginPath(); ctx.arc(px, py, G.pr, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,196,120,.55)'; ctx.lineWidth = Math.max(1, G.pr * .14); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(px, py, G.pr, G.pAng - .95, G.pAng + .95); ctx.stroke();
    ctx.globalAlpha = 1;
  };
}
