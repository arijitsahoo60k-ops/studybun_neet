/**
 * focusAmbience.js — Ambient canvas backgrounds for StudyBun's fullscreen Focus Mode.
 *
 * Ported from the Zenith focus-timer project's animations.js. Zenith ships ~56
 * renderers, many of them near-duplicates (ten "Aura" palettes, three rain
 * variants, three starfields...). This file keeps 18 that look and feel
 * genuinely different from one another:
 *
 *   as-shipped from Zenith .... Rain, Forest, Night Sky, Cosmic, Candlelight, Lantern Night
 *   rebuilt for StudyBun ...... Deep Sea, Snowfall, Fireplace, Cherry Blossom,
 *                               Rainy Window, Midnight Library
 *   original for StudyBun ..... Fireflies, Meteor Shower, Wormhole,
 *                               Pastel Sky, Boba Café, Jelly Aquarium
 *
 * The rebuilt six replace Zenith originals that were nearly invisible at Focus
 * Mode's canvas opacity (and, for the library, drew its book spines at ~5%
 * alpha and re-randomised them every frame). Café / Lofi Rain / Petrichor /
 * Monsoon Window / Zen Garden were dropped as overlaps of Rain, Rainy Window
 * and Cherry Blossom. The six "original for StudyBun" scenes are new,
 * following the same static-layer-plus-animated-particles technique as the
 * rebuilt six. Pastel Sky / Boba Café / Jelly Aquarium are a kawaii-aesthetic
 * trio (pastel gradients, puffball clouds, a boba cup, drifting jellyfish)
 * that replaced an Atom scene, plus Neon City and Bioluminescent Shore which
 * didn't earn their slots.
 *
 * Each renderer is a self-contained factory: create*Renderer() returns a
 * (ctx, canvas, time) => void function that FocusModeAmbient.jsx drives on a
 * requestAnimationFrame loop. No shared state between renderers.
 */

import {
  createSolarSystemRenderer,
  createMilkyWayRenderer,
  createBlackHoleRenderer,
} from './focusAmbienceSpace.js';

export const rand      = (a,b) => Math.random()*(b-a)+a;
export const randInt   = (a,b) => Math.floor(rand(a,b+1));
export const randChoice= (arr) => arr[randInt(0,arr.length-1)];

/* ── Rain (from Zenith, unchanged) ──────────────────────────────────────────────── */
export function createRainRenderer() {
  const drops = []; let lw=0,lh=0;
  const init = (w,h) => { drops.length=0; for(let i=0;i<120;i++) drops.push({x:rand(0,w),y:rand(-h,h),len:rand(15,60),speed:rand(8,20),op:rand(.1,.45),wd:rand(.5,1.5)}); };
  return (ctx,canvas) => {
    const {width:w,height:h}=canvas;
    if(w!==lw||h!==lh){init(w,h);lw=w;lh=h;}
    ctx.clearRect(0,0,w,h);
    const g=ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,'rgba(8,8,20,0)'); g.addColorStop(1,'rgba(12,18,32,.35)');
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    drops.forEach(d=>{ ctx.beginPath(); ctx.moveTo(d.x,d.y); ctx.lineTo(d.x-d.len*.15,d.y+d.len); ctx.strokeStyle=`rgba(140,180,220,${d.op})`; ctx.lineWidth=d.wd; ctx.stroke(); d.y+=d.speed; if(d.y>h+60){d.y=rand(-100,-10);d.x=rand(0,w);} });
  };
}

/* ── Forest (from Zenith, unchanged) ────────────────────────────────────────────── */
export function createForestRenderer() {
  const leaves=[]; let lw=0,lh=0;
  const init=(w,h)=>{ leaves.length=0; for(let i=0;i<35;i++) leaves.push({x:rand(0,w),y:rand(-50,h),size:rand(4,12),vx:rand(-.5,.5),vy:rand(.3,1.2),rot:rand(0,Math.PI*2),rs:rand(-.02,.02),op:rand(.1,.35),hue:randInt(100,145)}); };
  return (ctx,canvas,time)=>{
    const{width:w,height:h}=canvas;
    if(w!==lw||h!==lh){init(w,h);lw=w;lh=h;}
    ctx.clearRect(0,0,w,h);
    const g=ctx.createRadialGradient(w*.5,0,0,w*.5,0,h*.9); g.addColorStop(0,'rgba(120,180,80,.08)'); g.addColorStop(1,'rgba(30,60,20,.25)'); ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    leaves.forEach(l=>{ l.x+=l.vx+Math.sin(time*.0008+l.y*.01)*.3; l.y+=l.vy; l.rot+=l.rs; ctx.save(); ctx.translate(l.x,l.y); ctx.rotate(l.rot); ctx.globalAlpha=l.op; ctx.fillStyle=`hsl(${l.hue},60%,38%)`; ctx.beginPath(); ctx.ellipse(0,0,l.size,l.size*.5,0,0,Math.PI*2); ctx.fill(); ctx.restore(); if(l.y>h+30){l.y=-30;l.x=rand(0,w);} });
  };
}

/* ── Night Sky (from Zenith, unchanged) ─────────────────────────────────────────── */
export function createNightRenderer() {
  const stars=[]; let lw=0,lh=0;
  const init=(w,h)=>{ stars.length=0; for(let i=0;i<180;i++) stars.push({x:rand(0,w),y:rand(0,h*.75),r:rand(.3,2.2),base:rand(.2,.9),ts:rand(.5,2.5),to:rand(0,Math.PI*2)}); };
  return (ctx,canvas,time)=>{
    const{width:w,height:h}=canvas;
    if(w!==lw||h!==lh){init(w,h);lw=w;lh=h;}
    ctx.clearRect(0,0,w,h);
    const sky=ctx.createLinearGradient(0,0,0,h); sky.addColorStop(0,'rgba(5,5,20,.6)'); sky.addColorStop(1,'rgba(8,12,40,.2)'); ctx.fillStyle=sky; ctx.fillRect(0,0,w,h);
    const mg=ctx.createRadialGradient(w*.78,h*.12,0,w*.78,h*.12,120); mg.addColorStop(0,'rgba(220,220,255,.12)'); mg.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=mg; ctx.fillRect(0,0,w,h);
    const t=time*.001;
    stars.forEach(s=>{ const f=s.base*(.6+.4*Math.sin(t*s.ts+s.to)); ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fillStyle=`rgba(240,240,255,${f})`; ctx.fill(); });
  };
}

/* ── Cosmic (from Zenith, unchanged) ────────────────────────────────────────────── */
export function createCosmicRenderer() {
  const stars=[]; const nebula=[]; let lw=0,lh=0;
  const init=(w,h)=>{
    stars.length=0; nebula.length=0;
    for(let i=0;i<300;i++) stars.push({x:rand(0,w),y:rand(0,h),r:rand(.15,2.5),base:rand(.2,1),ts:rand(.3,2.5),to:rand(0,Math.PI*2),hue:randInt(190,320),shooting:false,stx:0,sty:0,stLife:0});
    for(let i=0;i<8;i++) nebula.push({x:rand(.05,.95),y:rand(.05,.9),rx:rand(.12,.38),ry:rand(.06,.22),hue:randInt(220,340),alpha:rand(.04,.09),rot:rand(0,Math.PI),drift:rand(0,Math.PI*2)});
  };
  let shootingTimer=0;
  return (ctx,canvas,time)=>{
    const{width:w,height:h}=canvas;
    if(w!==lw||h!==lh){init(w,h);lw=w;lh=h;}
    ctx.clearRect(0,0,w,h);
    const t=time*.0004;
    // Deep space gradient
    const bg=ctx.createRadialGradient(w*.5,h*.4,0,w*.5,h*.4,Math.max(w,h)*.8);
    bg.addColorStop(0,'rgba(8,4,24,.8)'); bg.addColorStop(.5,'rgba(4,2,16,.6)'); bg.addColorStop(1,'rgba(0,0,8,.4)');
    ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
    // Nebula clouds
    nebula.forEach((n,i)=>{ n.drift+=.0003; const pulse=1+.04*Math.sin(t*.5+i); ctx.save(); ctx.translate(n.x*w,n.y*h); ctx.rotate(n.rot+n.drift); const g=ctx.createRadialGradient(0,0,0,0,0,n.rx*w*pulse); g.addColorStop(0,`hsla(${n.hue},80%,60%,${n.alpha})`); g.addColorStop(.4,`hsla(${n.hue+40},70%,50%,${n.alpha*.5})`); g.addColorStop(1,'rgba(0,0,0,0)'); ctx.scale(1,n.ry/n.rx); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,n.rx*w*pulse,0,Math.PI*2); ctx.fill(); ctx.restore(); });
    // Milky core band
    const band=ctx.createLinearGradient(0,h*.15,w*.8,h*.85);
    band.addColorStop(0,'rgba(180,140,255,0)'); band.addColorStop(.35,'rgba(160,120,255,.055)'); band.addColorStop(.5,'rgba(200,150,255,.07)'); band.addColorStop(.65,'rgba(160,120,255,.055)'); band.addColorStop(1,'rgba(180,140,255,0)');
    ctx.fillStyle=band; ctx.fillRect(0,0,w,h);
    // Stars + twinkling
    shootingTimer++;
    stars.forEach((s,i)=>{ const f=s.base*(.5+.5*Math.sin(t*s.ts+s.to)); ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fillStyle=`hsla(${s.hue},50%,96%,${f})`; ctx.fill();
      // Occasional star glow
      if(s.r>1.5&&f>.8){ ctx.beginPath(); ctx.arc(s.x,s.y,s.r*3,0,Math.PI*2); const sg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*3); sg.addColorStop(0,`hsla(${s.hue},60%,90%,.15)`); sg.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=sg; ctx.fill(); }
    });
    // Shooting star every ~4s
    if(shootingTimer>240&&Math.random()>.97){ const si=randInt(0,stars.length-1); if(!stars[si].shooting){ stars[si].shooting=true; stars[si].stx=stars[si].x; stars[si].sty=stars[si].y; stars[si].stLife=0; } shootingTimer=0; }
    stars.filter(s=>s.shooting).forEach(s=>{ s.stLife+=3; s.stx+=4; s.sty+=2; const trail=ctx.createLinearGradient(s.x,s.y,s.stx,s.sty); trail.addColorStop(0,'rgba(255,255,255,0)'); trail.addColorStop(1,`rgba(200,220,255,.8)`); ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.stx,s.sty); ctx.strokeStyle=trail; ctx.lineWidth=1.5; ctx.stroke(); if(s.stLife>60||s.stx>w||s.sty>h) s.shooting=false; });
  };
}

/* ── Candlelight (from Zenith, unchanged) ───────────────────────────────────────── */
export function createCandlelightRenderer() {
  const smoke = [];
  let lw=0,lh=0;
  const init=(w,h)=>{
    smoke.length=0;
    for(let i=0;i<20;i++) smoke.push({
      x:w*.5+rand(-8,8), y:0, r:rand(1,3),
      vx:rand(-.12,.12), vy:rand(-.6,-.25),
      op:rand(.04,.10), life:rand(0,1), ls:rand(.004,.009),
    });
  };
  let flicker=0,ft=0;
  return (ctx,canvas,time)=>{
    const{width:w,height:h}=canvas;
    if(w!==lw||h!==lh){init(w,h);lw=w;lh=h;}
    ctx.clearRect(0,0,w,h);
    const t=time*.001;
    // Flicker rate
    ft+=0.016; if(ft>.08){ft=0;flicker=rand(-.04,.04);}
    const fv=1+flicker+.03*Math.sin(t*7.3)+.02*Math.sin(t*13.1);
    const cx=w*.5, cy=h*.72;
    // Ambient room warmth
    const room=ctx.createRadialGradient(cx,cy,0,cx,cy,w*.75*fv);
    room.addColorStop(0,`rgba(255,160,40,${.18*fv})`);
    room.addColorStop(.3,`rgba(220,100,20,${.10*fv})`);
    room.addColorStop(.7,'rgba(180,60,5,.04)');
    room.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=room; ctx.fillRect(0,0,w,h);
    // Bright near-glow
    const near=ctx.createRadialGradient(cx,cy,0,cx,cy,w*.22*fv);
    near.addColorStop(0,`rgba(255,220,120,${.32*fv})`);
    near.addColorStop(.4,`rgba(255,140,30,${.16*fv})`);
    near.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=near; ctx.fillRect(0,0,w,h);
    // Table surface reflection pool
    const pool=ctx.createRadialGradient(cx,cy+h*.02,0,cx,cy,h*.08);
    pool.addColorStop(0,`rgba(255,180,60,${.18*fv})`);
    pool.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=pool; ctx.fillRect(0,0,w,h);
    // Candle wick flame
    const fw=7*fv, fh=22*fv;
    // Outer flame
    const fl=ctx.createRadialGradient(cx,cy-fh*.3,0,cx,cy+fh*.1,fh*1.2);
    fl.addColorStop(0,'rgba(255,245,180,.9)');
    fl.addColorStop(.25,'rgba(255,200,60,.75)');
    fl.addColorStop(.6,'rgba(255,120,10,.5)');
    fl.addColorStop(1,'rgba(255,60,0,0)');
    ctx.fillStyle=fl;
    ctx.beginPath();
    ctx.ellipse(cx,cy-fh*.35,fw*.75,fh*.85,Math.sin(t*4.1)*.08,0,Math.PI*2);
    ctx.fill();
    // Inner hot core
    const core=ctx.createRadialGradient(cx,cy-fh*.2,0,cx,cy-fh*.1,fh*.5);
    core.addColorStop(0,'rgba(255,255,240,.95)');
    core.addColorStop(.3,'rgba(255,240,140,.8)');
    core.addColorStop(1,'rgba(255,200,60,0)');
    ctx.fillStyle=core;
    ctx.beginPath(); ctx.ellipse(cx,cy-fh*.22,fw*.35,fh*.52,0,0,Math.PI*2);
    ctx.fill();
    // Smoke wisps
    smoke.forEach(s=>{
      s.life+=s.ls; s.x+=s.vx+Math.sin(t*2.1+s.life*8)*.15; s.y-=Math.abs(s.vy);
      const a=s.op*Math.sin(s.life*Math.PI);
      if(a>0){
        ctx.beginPath();ctx.arc(s.x+cx-w*.5,cy+s.y*h*.18,s.r*(1+s.life*2),0,Math.PI*2);
        ctx.fillStyle=`rgba(180,160,140,${a})`; ctx.fill();
      }
      if(s.life>=1){s.y=0;s.x=rand(-8,8);s.life=0;}
    });
  };
}

/* ── Lantern Night (from Zenith, unchanged) ─────────────────────────────────────── */
export function createLanternRenderer() {
  const lanterns=[]; const sparks=[]; let lw=0,lh=0;
  const r=()=>Math.random();
  const init=(w,h)=>{
    lanterns.length=0;
    for(let i=0;i<9;i++) lanterns.push({
      x:r()*w, y:h+r()*h*0.5,
      vy:-(0.25+r()*0.35), vx:(r()-.5)*0.15,
      size:18+r()*22,
      hue:20+r()*30, // warm amber to orange
      phase:r()*Math.PI*2, ps:0.008+r()*0.006,
      sway:r()*0.4,
      op:0.65+r()*0.3,
    });
  };
  return (ctx,canvas,time)=>{
    const{width:w,height:h}=canvas;
    if(w!==lw||h!==lh){init(w,h);lw=w;lh=h;}
    ctx.clearRect(0,0,w,h);
    const t=time*0.001;

    // Deep ink sky
    const sky=ctx.createLinearGradient(0,0,0,h);
    sky.addColorStop(0,'rgba(2,2,8,.97)');
    sky.addColorStop(.6,'rgba(6,4,14,.90)');
    sky.addColorStop(1,'rgba(12,6,4,.85)');
    ctx.fillStyle=sky; ctx.fillRect(0,0,w,h);

    // Stars — tiny, intentional
    ctx.save();
    for(let i=0;i<60;i++){
      const sx=((i*137.508+73)%1)*w, sy=((i*97.3+11)%0.6)*h;
      const blink=0.4+0.4*Math.sin(t*0.8+i*2.3);
      ctx.beginPath(); ctx.arc(sx,sy,0.6+0.4*blink,0,Math.PI*2);
      ctx.fillStyle=`rgba(255,240,210,${0.3*blink})`; ctx.fill();
    }
    ctx.restore();

    // Lanterns
    lanterns.forEach(l=>{
      l.phase+=l.ps;
      l.y+=l.vy; l.x+=l.vx+Math.sin(l.phase)*l.sway;
      if(l.y<-l.size*3){
        l.y=h+l.size; l.x=r()*w;
      }
      const pulse=1+0.06*Math.sin(l.phase*2);
      const sz=l.size*pulse;

      // Glow halo
      const glow=ctx.createRadialGradient(l.x,l.y,sz*.2,l.x,l.y,sz*2.2);
      glow.addColorStop(0,`hsla(${l.hue},85%,65%,${l.op*0.25})`);
      glow.addColorStop(.5,`hsla(${l.hue},70%,50%,${l.op*0.08})`);
      glow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(l.x,l.y,sz*2.2,0,Math.PI*2); ctx.fill();

      // Lantern body — oval
      ctx.save(); ctx.translate(l.x,l.y);
      const body=ctx.createRadialGradient(0,-sz*.1,sz*.05,0,0,sz*.9);
      body.addColorStop(0,`hsla(${l.hue+10},90%,88%,${l.op})`);
      body.addColorStop(.4,`hsla(${l.hue},85%,65%,${l.op*.9})`);
      body.addColorStop(.8,`hsla(${l.hue-10},75%,45%,${l.op*.7})`);
      body.addColorStop(1,`hsla(${l.hue-15},70%,30%,${l.op*.4})`);
      ctx.fillStyle=body;
      ctx.beginPath(); ctx.ellipse(0,0,sz*.52,sz*.72,0,0,Math.PI*2); ctx.fill();

      // Lantern ribs
      ctx.globalAlpha=0.12; ctx.strokeStyle=`hsla(${l.hue-20},60%,30%,1)`; ctx.lineWidth=0.8;
      for(let ri=1;ri<4;ri++){
        const ry=(ri/4-0.5)*sz*1.2;
        const rx=Math.sqrt(Math.max(0,1-Math.pow(ry/(sz*.72),2)))*sz*.52;
        ctx.beginPath(); ctx.ellipse(0,ry,rx,rx*0.18,0,0,Math.PI*2); ctx.stroke();
      }

      // Top/bottom caps
      ctx.globalAlpha=l.op*0.9;
      ctx.fillStyle=`hsla(${l.hue-5},70%,50%,1)`;
      ctx.beginPath(); ctx.ellipse(0,-sz*.72,sz*.25,sz*.1,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0,sz*.72,sz*.25,sz*.1,0,0,Math.PI*2); ctx.fill();

      // String
      ctx.globalAlpha=0.3; ctx.strokeStyle='rgba(200,160,80,.8)'; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.moveTo(0,sz*.82); ctx.lineTo(0,sz*1.4); ctx.stroke();

      ctx.restore();

      // Tiny ember sparks near flame
      if(Math.random()<0.04 && sparks.length<40) sparks.push({
        x:l.x+(r()-.5)*sz*.3, y:l.y-sz*.6,
        vx:(r()-.5)*0.6, vy:-(0.4+r()*0.6),
        op:0.8+r()*0.2, life:1,
        hue:l.hue,
      });
    });

    // Sparks
    for(let i=sparks.length-1;i>=0;i--){
      const s=sparks[i];
      s.x+=s.vx; s.y+=s.vy; s.vy+=0.02; s.life-=0.025;
      if(s.life<=0){sparks.splice(i,1);continue;}
      ctx.beginPath(); ctx.arc(s.x,s.y,1+s.life,0,Math.PI*2);
      ctx.fillStyle=`hsla(${s.hue},90%,75%,${s.life*s.op})`; ctx.fill();
    }

    // Ground glow — festival crowd warmth
    const grd=ctx.createLinearGradient(0,h*.7,0,h);
    grd.addColorStop(0,'rgba(0,0,0,0)');
    grd.addColorStop(1,`rgba(40,15,5,${0.25+0.06*Math.sin(t*.2)})`);
    ctx.fillStyle=grd; ctx.fillRect(0,0,w,h);

    const vig=ctx.createRadialGradient(w*.5,h*.5,Math.min(w,h)*.05,w*.5,h*.5,Math.max(w,h)*.75);
    vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,0,.5)');
    ctx.fillStyle=vig; ctx.fillRect(0,0,w,h);
  };
}


/* ═══════════════════════════════════════════════════════════════════════
   Rebuilt scenes. The originals of these were near-invisible at the canvas
   opacity Focus Mode uses (a handful of 3-5% alpha gradients), so each one
   here paints a real, opaque sky/water/room of its own and reads at a glance.
   All motion is scaled by real frame time (dt), so a 120Hz display doesn't
   run them twice as fast as a 60Hz one.
   ═══════════════════════════════════════════════════════════════════════ */

const TAU = Math.PI * 2;

// Frame-time scaler: 1.0 at 60fps, clamped so a background-tab hiccup doesn't
// teleport everything.
function makeStepper() {
  let last = 0;
  return (time) => {
    const d = last ? Math.min(3, Math.max(0.2, (time - last) / 16.667)) : 1;
    last = time;
    return d;
  };
}

// Static art (skies, hills, bookshelves) is drawn once into an offscreen
// canvas and blitted every frame instead of being re-stroked 60 times a second.
function makeLayer(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/* ── Deep Sea — light shafts, jellyfish, bubbles, drifting plankton ── */
export function createOceanRenderer() {
  const bubbles = [], motes = [], jellies = [], rays = [];
  const step = makeStepper();
  let lw = 0, lh = 0;
  const init = (w, h) => {
    bubbles.length = motes.length = jellies.length = rays.length = 0;
    for (let i = 0; i < 46; i++) bubbles.push({ x: rand(0, w), y: rand(0, h), r: rand(1.5, 6), vy: rand(.35, 1.1), ph: rand(0, TAU), sw: rand(.4, 1.2) });
    for (let i = 0; i < 90; i++) motes.push({ x: rand(0, w), y: rand(0, h), r: rand(.5, 1.6), vy: rand(.05, .25), vx: rand(-.1, .1), a: rand(.15, .5) });
    for (let i = 0; i < 6; i++) rays.push({ x: rand(-.1, 1.1) * w, wd: rand(.05, .13) * w, sk: rand(.12, .4), a: rand(.06, .12), ph: rand(0, TAU), sp: rand(.0002, .0006) });
    const hues = [188, 200, 285, 320];
    for (let i = 0; i < 4; i++) jellies.push({ x: rand(.1, .9) * w, y: rand(.25, 1.05) * h, s: rand(.55, 1.2), hue: hues[i], ph: rand(0, TAU), vx: rand(-.14, .14) });
  };
  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; }
    const dt = step(time);
    const t = time * .001;
    ctx.globalCompositeOperation = 'source-over';
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgb(12,98,138)'); bg.addColorStop(.45, 'rgb(5,52,88)'); bg.addColorStop(1, 'rgb(2,14,32)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    // Sun shafts from the surface
    ctx.globalCompositeOperation = 'lighter';
    rays.forEach(r => {
      const x = r.x + Math.sin(time * r.sp + r.ph) * w * .04;
      const bx = x + r.sk * h;
      const g = ctx.createLinearGradient(0, 0, 0, h * .95);
      g.addColorStop(0, `rgba(170,232,255,${r.a * (.8 + .2 * Math.sin(t * .8 + r.ph))})`); g.addColorStop(1, 'rgba(170,232,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - r.wd * .25, 0); ctx.lineTo(x + r.wd * .25, 0); ctx.lineTo(bx + r.wd, h); ctx.lineTo(bx - r.wd, h); ctx.closePath(); ctx.fill();
    });

    // Plankton / marine snow
    motes.forEach(m => {
      m.y += m.vy * dt; m.x += (m.vx + Math.sin(t + m.a * 9) * .04) * dt;
      if (m.y > h + 4) { m.y = -4; m.x = rand(0, w); }
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fillStyle = `rgba(190,235,255,${m.a * .7})`; ctx.fill();
    });

    // Jellyfish
    jellies.forEach(j => {
      j.ph += .022 * dt;
      const pulse = Math.sin(j.ph), thrust = Math.max(0, pulse);
      j.y -= (.1 + .38 * thrust) * j.s * dt; j.x += j.vx * dt + Math.sin(t * .4 + j.hue) * .12 * dt;
      const R = 34 * j.s;
      if (j.y < -R * 5) { j.y = h + R * 3; j.x = rand(.1, .9) * w; }
      if (j.x < -R * 3) j.x = w + R * 2; if (j.x > w + R * 3) j.x = -R * 2;
      ctx.save(); ctx.translate(j.x, j.y);
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 3.2);
      halo.addColorStop(0, `hsla(${j.hue},95%,65%,.22)`); halo.addColorStop(1, `hsla(${j.hue},95%,55%,0)`);
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, R * 3.2, 0, TAU); ctx.fill();
      // tentacles
      ctx.lineWidth = 1.3 * j.s; ctx.lineCap = 'round';
      for (let k = 0; k < 7; k++) {
        const ox = (k / 6 - .5) * R * 1.6;
        ctx.beginPath(); ctx.moveTo(ox, R * .1);
        for (let s = 1; s <= 12; s++) { const yy = R * .1 + s * R * .32; ctx.lineTo(ox + Math.sin(s * .7 + j.ph * 2 + k) * R * .16 * (s / 6), yy); }
        ctx.strokeStyle = `hsla(${j.hue},90%,78%,${.34 - k % 2 * .12})`; ctx.stroke();
      }
      // bell
      const sy = 1 + .1 * pulse, sx = 1 - .05 * pulse;
      ctx.scale(sx, sy);
      ctx.beginPath(); ctx.moveTo(-R, 0); ctx.bezierCurveTo(-R, -R * 1.45, R, -R * 1.45, R, 0); ctx.quadraticCurveTo(R * .5, R * .3, 0, R * .12); ctx.quadraticCurveTo(-R * .5, R * .3, -R, 0); ctx.closePath();
      const bell = ctx.createRadialGradient(0, -R * .5, 0, 0, -R * .3, R * 1.2);
      bell.addColorStop(0, `hsla(${j.hue},100%,88%,.85)`); bell.addColorStop(.6, `hsla(${j.hue},95%,65%,.5)`); bell.addColorStop(1, `hsla(${j.hue},90%,50%,.22)`);
      ctx.fillStyle = bell; ctx.fill();
      ctx.restore();
    });

    // Bubbles
    ctx.globalCompositeOperation = 'source-over';
    bubbles.forEach(b => {
      b.y -= b.vy * dt; b.ph += .03 * dt; const x = b.x + Math.sin(b.ph) * 6 * b.sw;
      if (b.y < -10) { b.y = h + 10; b.x = rand(0, w); }
      ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, TAU);
      ctx.fillStyle = 'rgba(190,235,255,.08)'; ctx.fill();
      ctx.strokeStyle = 'rgba(200,240,255,.55)'; ctx.lineWidth = .9; ctx.stroke();
      ctx.beginPath(); ctx.arc(x - b.r * .35, b.y - b.r * .35, Math.max(.6, b.r * .22), 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fill();
    });

    // Abyss darkening toward the floor
    const abyss = ctx.createLinearGradient(0, h * .55, 0, h);
    abyss.addColorStop(0, 'rgba(0,6,18,0)'); abyss.addColorStop(1, 'rgba(0,6,18,.55)');
    ctx.fillStyle = abyss; ctx.fillRect(0, h * .55, w, h * .45);
  };
}

/* ── Snowfall — moonlit pines with three depths of snow ──────────── */
export function createSnowRenderer() {
  const layers = [
    { n: 75, r: [.7, 1.5], vy: [.25, .5], a: [.35, .6], soft: false },
    { n: 50, r: [1.5, 2.7], vy: [.6, 1.0], a: [.5, .8], soft: false },
    { n: 20, r: [3.5, 6.5], vy: [1.3, 2.0], a: [.3, .55], soft: true },
  ];
  const flakes = [], stars = [];
  let bg = null;
  const step = makeStepper();
  let lw = 0, lh = 0;
  const init = (w, h) => {
    flakes.length = stars.length = 0;
    layers.forEach((L, li) => { for (let i = 0; i < L.n; i++) flakes.push({ li, x: rand(0, w), y: rand(0, h), r: rand(...L.r), vy: rand(...L.vy), a: rand(...L.a), dr: rand(0, TAU), ds: rand(.008, .02) }); });
    for (let i = 0; i < 45; i++) stars.push({ x: rand(0, w), y: rand(0, h * .5), r: rand(.4, 1.3), ph: rand(0, TAU), sp: rand(.5, 2) });

    // Static backdrop, painted once
    bg = makeLayer(w, h); const c = bg.getContext('2d');
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, 'rgb(10,20,44)'); sky.addColorStop(.55, 'rgb(28,48,84)'); sky.addColorStop(.85, 'rgb(74,100,140)'); sky.addColorStop(1, 'rgb(96,122,158)');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    const mx = w * .78, my = h * .2, mg = c.createRadialGradient(mx, my, 0, mx, my, h * .42);
    mg.addColorStop(0, 'rgba(235,242,255,.55)'); mg.addColorStop(.12, 'rgba(210,225,255,.25)'); mg.addColorStop(1, 'rgba(160,190,240,0)');
    c.fillStyle = mg; c.fillRect(0, 0, w, h);
    c.beginPath(); c.arc(mx, my, Math.max(14, h * .028), 0, TAU); c.fillStyle = 'rgb(240,246,255)'; c.fill();
    const ph1 = rand(0, 6), ph2 = rand(0, 6);
    const ridge = (x, base, amp, ph, f) => base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 1.7) * amp * .45;
    // far ridge
    c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) c.lineTo(x, ridge(x, h * .72, h * .035, ph1, .004));
    c.lineTo(w, h); c.closePath(); c.fillStyle = 'rgb(38,58,92)'; c.fill();
    // near ridge
    const nearY = (x) => ridge(x, h * .84, h * .025, ph2, .0055);
    c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) c.lineTo(x, nearY(x));
    c.lineTo(w, h); c.closePath(); c.fillStyle = 'rgb(14,24,42)'; c.fill();
    // pines on the near ridge
    const pine = (x, y, s, col) => {
      c.fillStyle = col;
      for (let k = 0; k < 4; k++) { const ty = y - k * s * .42, wd = s * (.62 - k * .11); c.beginPath(); c.moveTo(x - wd, ty); c.lineTo(x, ty - s * .62); c.lineTo(x + wd, ty); c.closePath(); c.fill(); }
      c.fillRect(x - s * .05, y, s * .1, s * .2);
    };
    const count = Math.floor(w / 46);
    for (let i = 0; i < count; i++) { const x = rand(0, w); pine(x, nearY(x) + 6, rand(h * .05, h * .11), 'rgb(9,16,30)'); }
    // snowy ground glow
    const gg = c.createLinearGradient(0, h * .86, 0, h); gg.addColorStop(0, 'rgba(190,210,240,0)'); gg.addColorStop(1, 'rgba(190,210,240,.28)');
    c.fillStyle = gg; c.fillRect(0, h * .86, w, h * .14);
  };
  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; }
    const dt = step(time), t = time * .001;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bg, 0, 0);
    stars.forEach(s => { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fillStyle = `rgba(235,242,255,${.25 + .5 * (.5 + .5 * Math.sin(t * s.sp + s.ph))})`; ctx.fill(); });
    const wind = .35 * Math.sin(t * .3) + .15;
    flakes.forEach(f => {
      const L = layers[f.li];
      f.dr += f.ds * dt; f.x += (wind * (.5 + f.li * .5) + Math.sin(f.dr) * .35) * dt; f.y += f.vy * dt;
      if (f.y > h + 12) { f.y = -12; f.x = rand(0, w); }
      if (f.x > w + 12) f.x = -12; if (f.x < -12) f.x = w + 12;
      if (L.soft) {
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 1.6);
        g.addColorStop(0, `rgba(245,250,255,${f.a})`); g.addColorStop(1, 'rgba(245,250,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.6, 0, TAU); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fillStyle = `rgba(245,250,255,${f.a})`; ctx.fill();
      }
    });
  };
}

/* ── Fireplace — real flame tongues, glowing logs, rising embers ─── */
export function createFireplaceRenderer() {
  const embers = [];
  const step = makeStepper();
  let lw = 0, lh = 0, walk = 0;
  const spawn = (cx, by, hw) => ({ x: cx + rand(-hw * .6, hw * .6), y: by - rand(0, 30), vx: rand(-.35, .35), vy: rand(.7, 2), r: rand(.8, 2.6), life: 0, max: rand(90, 220), ph: rand(0, TAU) });
  const init = (w, h) => { embers.length = 0; const hw = Math.min(w * .32, 300); for (let i = 0; i < 55; i++) { const e = spawn(w * .5, h * .9, hw); e.life = rand(0, e.max); e.y -= e.life * e.vy * .6; embers.push(e); } };
  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; }
    const dt = step(time), t = time * .001;
    walk += (Math.random() - .5) * .08 * dt; walk *= .96;
    const fv = .92 + .08 * Math.sin(t * 9) + .05 * Math.sin(t * 17 + 1) + walk;
    ctx.globalCompositeOperation = 'source-over';
    const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, 'rgb(16,9,7)'); bg.addColorStop(1, 'rgb(46,18,8)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    const cx = w * .5, by = h * .9, hw = Math.min(w * .32, 300);
    // Room light thrown up the walls
    ctx.globalCompositeOperation = 'lighter';
    let g = ctx.createRadialGradient(cx, by, 0, cx, by, Math.max(w, h) * .8);
    g.addColorStop(0, `rgba(255,110,25,${.42 * fv})`); g.addColorStop(.35, `rgba(200,70,15,${.2 * fv})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // Flames — additive so overlapping tongues bloom into a hot core
    ctx.globalCompositeOperation = 'lighter';
    const tongue = (bx, H, wd, sway, hot) => {
      const tipx = bx + sway;
      ctx.beginPath(); ctx.moveTo(bx - wd, by);
      ctx.bezierCurveTo(bx - wd * .95, by - H * .4, bx + sway * .35 - wd * .35, by - H * .72, tipx, by - H);
      ctx.bezierCurveTo(bx + sway * .35 + wd * .35, by - H * .72, bx + wd * .95, by - H * .4, bx + wd, by); ctx.closePath();
      const fg = ctx.createLinearGradient(0, by, 0, by - H);
      if (hot) { fg.addColorStop(0, 'rgba(255,246,190,.8)'); fg.addColorStop(.4, 'rgba(255,196,64,.55)'); fg.addColorStop(1, 'rgba(255,140,30,0)'); }
      else { fg.addColorStop(0, 'rgba(255,140,36,.5)'); fg.addColorStop(.5, 'rgba(225,72,12,.36)'); fg.addColorStop(1, 'rgba(140,26,0,0)'); }
      ctx.fillStyle = fg; ctx.fill();
    };
    const N = 7;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < N; i++) {
        const k = i - (N - 1) / 2, env = Math.pow(1 - Math.abs(k) / 4.2, 1.2);
        const n = .5 + .3 * Math.sin(t * (2.3 + i * .71) + i * 2.1) + .2 * Math.sin(t * (5.9 + i * 1.3) + i * .9);
        const H = hw * (.34 + .95 * env) * (.45 + .8 * n) * fv;
        const bx = cx + k * hw * .24, sway = Math.sin(t * (1.5 + i * .37) + i) * hw * .08 + k * hw * .025;
        if (pass === 0) tongue(bx, H * 1.18, hw * (.11 + .09 * env), sway, false); else tongue(bx, H * .74, hw * (.05 + .05 * env), sway * .6, true);
      }
    }

    // Logs sit on top of the flame bases so there's no hard cut-off line
    ctx.globalCompositeOperation = 'source-over';
    const log = (x, y, len, rot) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      const lg = ctx.createLinearGradient(0, -14, 0, 14); lg.addColorStop(0, 'rgb(96,50,24)'); lg.addColorStop(.5, 'rgb(44,22,11)'); lg.addColorStop(1, 'rgb(18,9,5)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-len / 2, -13, len, 26, 13) : ctx.rect(-len / 2, -13, len, 26); ctx.fill();
      ctx.restore();
    };
    log(cx - hw * .34, by + 4, hw * 1.2, .1); log(cx + hw * .34, by + 6, hw * 1.2, -.09); log(cx, by - 3, hw * 1.05, .02);
    ctx.globalCompositeOperation = 'lighter';
    // Glowing bed under the flames
    g = ctx.createRadialGradient(cx, by + 6, 0, cx, by + 6, hw * .9);
    g.addColorStop(0, `rgba(255,170,60,${.42 * fv})`); g.addColorStop(1, 'rgba(255,90,10,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // Embers
    embers.forEach((e, i) => {
      e.life += dt; e.ph += .05 * dt; e.x += (e.vx + Math.sin(e.ph) * .4) * dt; e.y -= e.vy * dt; e.vy *= Math.pow(.997, dt);
      const p = e.life / e.max;
      if (p >= 1) { embers[i] = spawn(cx, by, hw); return; }
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1 - p * .5), 0, TAU); ctx.fillStyle = `rgba(255,${170 - p * 80 | 0},60,${(1 - p) * .95})`; ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  };
}

/* ── Cherry Blossom — dusk sky, a blossoming branch, drifting petals ─ */
export function createCherryBlossomRenderer() {
  const petals = [];
  let bg = null;
  const step = makeStepper();
  let lw = 0, lh = 0;
  const newPetal = (w, h, scatter) => ({
    x: scatter ? rand(0, w) : w * rand(.55, 1.05), y: scatter ? rand(-h * .2, h) : rand(-20, h * .25),
    vx: rand(-.9, -.15), vy: rand(.4, 1.1), rot: rand(0, TAU), rs: rand(-.04, .04),
    s: rand(4, 10), op: rand(.5, .95), dr: rand(0, TAU), ds: rand(.01, .03), hue: rand(338, 356),
  });
  const init = (w, h) => {
    petals.length = 0; for (let i = 0; i < 70; i++) petals.push(newPetal(w, h, true));
    bg = makeLayer(w, h); const c = bg.getContext('2d');
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, 'rgb(38,24,58)'); sky.addColorStop(.55, 'rgb(96,52,86)'); sky.addColorStop(1, 'rgb(190,108,116)');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    const sg = c.createRadialGradient(w * .22, h * .82, 0, w * .22, h * .82, h * .8);
    sg.addColorStop(0, 'rgba(255,190,150,.45)'); sg.addColorStop(1, 'rgba(255,150,130,0)');
    c.fillStyle = sg; c.fillRect(0, 0, w, h);
    // branch: a tapered curve from the top-right corner
    const pts = []; const seg = 26;
    for (let i = 0; i <= seg; i++) { const u = i / seg; pts.push({ x: w * (1.03 - u * .5) + Math.sin(u * 5) * 16, y: h * (-.02 + u * .34) + Math.sin(u * 3.4) * 22 - u * u * 24 }); }
    c.lineCap = 'round'; c.strokeStyle = 'rgb(34,18,28)';
    for (let i = 0; i < pts.length - 1; i++) { c.lineWidth = Math.max(2, 20 * (1 - i / seg)); c.beginPath(); c.moveTo(pts[i].x, pts[i].y); c.lineTo(pts[i + 1].x, pts[i + 1].y); c.stroke(); }
    const twigs = [];
    for (let i = 3; i < pts.length - 1; i += 3) { const p = pts[i]; let x = p.x, y = p.y, a = rand(1.9, 2.9); c.lineWidth = 4; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { a += rand(-.35, .35); x += Math.cos(a) * rand(22, 44); y += Math.sin(a) * rand(14, 30); c.lineTo(x, y); twigs.push({ x, y }); } c.stroke(); }
    const bloom = (x, y, s) => {
      for (let k = 0; k < 5; k++) { c.save(); c.translate(x, y); c.rotate(k / 5 * TAU + x); c.beginPath(); c.ellipse(0, -s * .55, s * .42, s * .6, 0, 0, TAU); c.fillStyle = `hsla(${rand(340, 352)},75%,${rand(84, 93)}%,.95)`; c.fill(); c.restore(); }
      c.beginPath(); c.arc(x, y, s * .16, 0, TAU); c.fillStyle = 'rgb(240,196,120)'; c.fill();
    };
    twigs.forEach(p => { for (let i = 0; i < 3; i++) bloom(p.x + rand(-16, 16), p.y + rand(-14, 14), rand(8, 15)); });
    pts.forEach((p, i) => { if (i % 2) bloom(p.x + rand(-12, 12), p.y + rand(-12, 12), rand(9, 14)); });
  };
  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; }
    const dt = step(time);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bg, 0, 0);
    petals.forEach((p, i) => {
      p.dr += p.ds * dt; p.x += (p.vx + Math.sin(p.dr) * .7) * dt; p.y += p.vy * dt; p.rot += p.rs * dt;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, .55 + .45 * Math.abs(Math.sin(p.dr * .8))); ctx.globalAlpha = p.op;
      ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.bezierCurveTo(p.s * .9, -p.s * .5, p.s * .6, p.s * .7, 0, p.s * .55); ctx.bezierCurveTo(-p.s * .6, p.s * .7, -p.s * .9, -p.s * .5, 0, -p.s);
      ctx.fillStyle = `hsl(${p.hue},78%,88%)`; ctx.fill(); ctx.restore();
      if (p.y > h + 20 || p.x < -30) petals[i] = newPetal(w, h, false);
    });
  };
}

/* ── Rainy Window — city bokeh behind glass, drops sliding down ──── */
export function createRainyWindowRenderer() {
  const bokeh = [], still = [], runners = [];
  const step = makeStepper();
  let lw = 0, lh = 0;
  const newRunner = (w, h, scatter) => ({ x: rand(0, w), y: scatter ? rand(0, h) : rand(-60, -6), r: rand(2.6, 6), trail: scatter ? rand(0, 90) : 0, ph: rand(0, TAU), sp: rand(.5, 1.6) });
  const init = (w, h) => {
    bokeh.length = still.length = runners.length = 0;
    const hues = [36, 24, 46, 350, 30, 200, 322];
    for (let i = 0; i < 18; i++) bokeh.push({ x: rand(0, w), y: rand(h * .12, h * 1.02), r: rand(34, 96), hue: hues[randInt(0, hues.length - 1)], a: rand(.22, .42), ph: rand(0, TAU), sp: rand(.0003, .0009) });
    for (let i = 0; i < 90; i++) still.push({ x: rand(0, w), y: rand(0, h), r: rand(1.2, 4.2) });
    for (let i = 0; i < 9; i++) runners.push(newRunner(w, h, true));
  };
  const drop = (ctx, x, y, r) => {
    const g = ctx.createRadialGradient(x - r * .3, y - r * .35, r * .1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(.75, 'rgba(210,225,255,.07)'); g.addColorStop(1, 'rgba(230,240,255,.32)');
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(x - r * .35, y - r * .38, Math.max(.5, r * .24), 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
  };
  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; }
    const dt = step(time);
    ctx.globalCompositeOperation = 'source-over';
    const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, 'rgb(12,18,36)'); bg.addColorStop(1, 'rgb(30,22,42)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    bokeh.forEach(b => {
      const a = b.a * (.75 + .25 * Math.sin(time * b.sp + b.ph)), x = b.x + Math.sin(time * b.sp * .6 + b.ph) * 10;
      const g = ctx.createRadialGradient(x, b.y, 0, x, b.y, b.r);
      g.addColorStop(0, `hsla(${b.hue},95%,62%,${a * .55})`); g.addColorStop(.72, `hsla(${b.hue},95%,60%,${a * .7})`); g.addColorStop(.92, `hsla(${b.hue},95%,72%,${a})`); g.addColorStop(1, `hsla(${b.hue},95%,70%,0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, TAU); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    // condensation haze
    ctx.fillStyle = 'rgba(150,175,215,.06)'; ctx.fillRect(0, 0, w, h);
    still.forEach(d => drop(ctx, d.x, d.y, d.r));
    runners.forEach((d, i) => {
      d.ph += .02 * dt;
      const v = (.15 + 1.9 * Math.max(0, Math.sin(d.ph) - .25)) * d.sp;
      d.y += v * dt * 1.6; d.trail = Math.min(140, d.trail + v * dt * 1.2);
      if (d.trail > 0) {
        const tg = ctx.createLinearGradient(0, d.y - d.trail, 0, d.y); tg.addColorStop(0, 'rgba(220,235,255,0)'); tg.addColorStop(1, 'rgba(220,235,255,.2)');
        ctx.fillStyle = tg; ctx.fillRect(d.x - d.r * .35, d.y - d.trail, d.r * .7, d.trail);
      }
      drop(ctx, d.x, d.y, d.r);
      if (d.y - d.r > h) runners[i] = newRunner(w, h, false);
    });
  };
}

/* ── Midnight Library — candlelit shelves, warm dust in the air ──── */
export function createLibraryRenderer() {
  const motes = [], candles = [];
  let shelves = null;
  const step = makeStepper();
  let lw = 0, lh = 0;
  const init = (w, h) => {
    motes.length = candles.length = 0;
    const rows = 4, rh = h / rows;
    shelves = makeLayer(w, h); const c = shelves.getContext('2d');
    c.fillStyle = 'rgb(26,15,9)'; c.fillRect(0, 0, w, h);
    const palette = [[8, 55, 30], [14, 48, 26], [24, 50, 30], [350, 42, 26], [156, 32, 22], [214, 34, 26], [34, 42, 34], [28, 30, 18]];
    for (let r = 0; r < rows; r++) {
      const plankY = (r + 1) * rh - 9;
      let x = rand(0, 8);
      while (x < w) {
        const bw = rand(13, 30), bh = rh * rand(.5, .86) - 6, [hh, ss, ll] = palette[randInt(0, palette.length - 1)];
        if (Math.random() < .06) { x += rand(30, 70); continue; } // gap
        const lean = Math.random() < .05 ? rand(-.18, .18) : 0;
        c.save(); c.translate(x + bw / 2, plankY); c.rotate(lean);
        const g = c.createLinearGradient(-bw / 2, 0, bw / 2, 0);
        g.addColorStop(0, `hsl(${hh},${ss}%,${ll + 9}%)`); g.addColorStop(.5, `hsl(${hh},${ss}%,${ll}%)`); g.addColorStop(1, `hsl(${hh},${ss}%,${ll - 8}%)`);
        c.fillStyle = g; c.fillRect(-bw / 2, -bh, bw, bh);
        c.fillStyle = 'rgba(214,170,90,.55)'; c.fillRect(-bw / 2, -bh * .8, bw, 2); c.fillRect(-bw / 2, -bh * .2, bw, 2);
        c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(bw / 2 - 1.5, -bh, 1.5, bh);
        c.restore();
        x += bw + rand(0, 2);
      }
      const pg = c.createLinearGradient(0, plankY, 0, plankY + 10); pg.addColorStop(0, 'rgb(96,60,32)'); pg.addColorStop(1, 'rgb(38,22,12)');
      c.fillStyle = pg; c.fillRect(0, plankY, w, 10);
      c.fillStyle = 'rgba(255,205,140,.3)'; c.fillRect(0, plankY, w, 1.5);
      c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, plankY + 10, w, 6);
    }
    [[.13, 1], [.87, 0], [.5, 2]].forEach(([fx, row]) => candles.push({ x: w * fx, y: (row + 1) * rh - 9, ph: rand(0, TAU), ps: rand(.07, .12) }));
    for (let i = 0; i < 55; i++) motes.push({ x: rand(0, w), y: rand(0, h), vx: rand(-.08, .08), vy: rand(-.12, -.02), s: rand(.6, 1.8), a: rand(.15, .45), ph: rand(0, TAU), ps: rand(.004, .012) });
  };
  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; }
    const dt = step(time);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(shelves, 0, 0);
    // Night: knock the whole room down, then let the candles put light back
    ctx.fillStyle = 'rgba(6,3,1,.68)'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const rh = h / 4;
    candles.forEach(c => {
      c.ph += c.ps * dt;
      const fk = .88 + .1 * Math.sin(c.ph) + .05 * Math.sin(c.ph * 2.7 + 1);
      const g = ctx.createRadialGradient(c.x, c.y - 20, 0, c.x, c.y - 20, rh * 2.1 * fk);
      g.addColorStop(0, `rgba(255,170,70,${.55 * fk})`); g.addColorStop(.35, `rgba(220,110,30,${.22 * fk})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    ctx.globalCompositeOperation = 'source-over';
    candles.forEach(c => {
      const fk = .88 + .1 * Math.sin(c.ph) + .05 * Math.sin(c.ph * 2.7 + 1);
      ctx.fillStyle = 'rgb(232,214,178)'; ctx.fillRect(c.x - 5, c.y - 26, 10, 26);
      ctx.fillStyle = 'rgba(255,210,140,.9)'; ctx.fillRect(c.x - 5, c.y - 26, 3, 26);
      const fy = c.y - 26;
      const fl = ctx.createRadialGradient(c.x, fy - 8, 0, c.x, fy - 6, 15 * fk);
      fl.addColorStop(0, 'rgba(255,250,215,1)'); fl.addColorStop(.35, 'rgba(255,190,70,.9)'); fl.addColorStop(1, 'rgba(255,90,10,0)');
      ctx.fillStyle = fl; ctx.beginPath(); ctx.ellipse(c.x + Math.sin(c.ph * 1.3) * 1.2, fy - 8 * fk, 4.6, 12 * fk, 0, 0, TAU); ctx.fill();
    });
    // dust motes, brighter inside the candle light
    motes.forEach(m => {
      m.ph += m.ps * dt; m.x += (m.vx + Math.sin(m.ph) * .05) * dt; m.y += m.vy * dt;
      if (m.y < -4) { m.y = h + 4; m.x = rand(0, w); }
      const lit = candles.some(c => Math.hypot(m.x - c.x, m.y - c.y) < rh * 1.6) ? 2.4 : .55;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.s * (.75 + .25 * Math.sin(m.ph * 3)), 0, TAU); ctx.fillStyle = `rgba(255,214,150,${Math.min(.9, m.a * lit)})`; ctx.fill();
    });
    // lamp-under-shadow vignette
    const vg = ctx.createRadialGradient(w * .5, h * .55, Math.min(w, h) * .25, w * .5, h * .5, Math.max(w, h) * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  };
}

/* ── Wormhole — a spiralling energy vortex pulling stardust inward ──
   New scene, genuinely different register from Cosmic (static nebula field):
   a flattened accretion-disk perspective with three soft spiral arms and
   ~260 particles orbiting inward on a log-spiral path, respawning at the rim
   once they cross the event horizon, so the whole thing visibly *flows*. */
export function createWormholeRenderer() {
  const parts = [];
  const step = makeStepper();
  let lw = 0, lh = 0;
  const spawn = (w, h) => { const R = Math.min(w, h) * .62; return { a: rand(0, TAU), r: rand(R * .4, R), rs: rand(.12, .32), as: rand(.15, .5) * (Math.random() < .5 ? 1 : -1), hue: rand(255, 330), size: rand(.8, 2.6) }; };
  const init = (w, h) => { parts.length = 0; for (let i = 0; i < 240; i++) parts.push(spawn(w, h)); };
  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; }
    const dt = step(time), t = time * .001;
    const cx = w * .5, cy = h * .5, R = Math.min(w, h) * .62;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgb(3,2,10)'; ctx.fillRect(0, 0, w, h);
    const neb = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.3);
    neb.addColorStop(0, 'rgba(120,40,180,.35)'); neb.addColorStop(.4, 'rgba(70,20,140,.18)'); neb.addColorStop(.75, 'rgba(20,10,60,.08)'); neb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      for (let i = 0; i <= 140; i++) {
        const u = i / 140, rr = R * u, ang = rr * .045 + arm * (TAU / 3) + t * .25;
        const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * .62;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `hsla(${268 + arm * 20},90%,65%,.12)`; ctx.lineWidth = R * .09; ctx.stroke();
    }
    parts.forEach((p, i) => {
      p.a += p.as * .01 * dt; p.r -= p.rs * dt;
      if (p.r < R * .07) { parts[i] = spawn(w, h); return; }
      const x = cx + Math.cos(p.a) * p.r, y = cy + Math.sin(p.a) * p.r * .62;
      const fade = Math.min(1, (R - p.r) / R * 1.6);
      ctx.beginPath(); ctx.arc(x, y, p.size, 0, TAU); ctx.fillStyle = `hsla(${p.hue},95%,72%,${.75 * fade})`; ctx.fill();
    });
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * .16);
    core.addColorStop(0, 'rgba(255,240,255,.9)'); core.addColorStop(.4, 'rgba(200,140,255,.55)'); core.addColorStop(1, 'rgba(140,60,220,0)');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, R * .16, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    const vg = ctx.createRadialGradient(cx, cy, R * .3, cx, cy, Math.max(w, h) * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  };
}

/* ── Pastel Sky — kawaii cotton-candy dreamscape ───────────────────────
   A soft pink-to-lavender-to-mint gradient sky with puffball clouds built
   from overlapping circles (the same trick sticker/kawaii art uses), a
   crescent moon carved out with the sky's own gradient (so the bite matches
   perfectly instead of a flat colour), rising pastel bokeh orbs and small
   cross-shaped sparkles that pulse in and out. */
export function createPastelSkyRenderer() {
  const stars = [], clouds = [], orbs = [];
  const step = makeStepper();
  let lw = 0, lh = 0, sky = null;
  const HUES = [330, 270, 190, 42];
  const newStar = (w, h) => ({ x: rand(0, w), y: rand(0, h * .82), ph: rand(0, TAU), ps: rand(.02, .05), size: rand(2, 5), hue: randChoice(HUES) });
  const newCloud = (w, h, i) => ({ x: rand(-.1, 1.1) * w, y: rand(h * .08, h * .52), sc: rand(.6, 1.3), speed: rand(4, 9) + i * 1.2, hue: randChoice([345, 20, 265]), op: rand(.55, .85) });
  const newOrb = (w, h) => ({ x: rand(0, w), y: rand(h * .3, h * 1.05), r: rand(3, 8), vy: rand(.06, .17), hue: randChoice(HUES), ph: rand(0, TAU) });
  const init = (w, h) => {
    stars.length = 0; clouds.length = 0; orbs.length = 0;
    for (let i = 0; i < 42; i++) stars.push(newStar(w, h));
    for (let i = 0; i < 6; i++) clouds.push(newCloud(w, h, i));
    for (let i = 0; i < 26; i++) orbs.push(newOrb(w, h));
    sky = null;
  };
  const drawCloud = (ctx, x, y, sc, hue, op) => {
    const blobs = [[0, 0, 26], [22, -8, 20], [-22, -6, 19], [40, 2, 15], [-40, 0, 14], [10, 8, 22], [-10, 9, 20]];
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    blobs.forEach(([bx, by, br]) => { ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fillStyle = `hsla(${hue},70%,94%,${op})`; ctx.fill(); });
    ctx.beginPath(); ctx.ellipse(-6, -6, 16, 8, 0, 0, TAU); ctx.fillStyle = `hsla(${hue},80%,99%,${op * .6})`; ctx.fill();
    ctx.restore();
  };
  const drawSparkle = (ctx, x, y, size, hue, glow) => {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = glow;
    ctx.strokeStyle = `hsla(${hue},90%,80%,1)`; ctx.lineWidth = Math.max(1, size * .28); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(size, 0); ctx.moveTo(0, -size); ctx.lineTo(0, size); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, size * .35, 0, TAU); ctx.fillStyle = `hsla(${hue},100%,92%,1)`; ctx.fill();
    ctx.restore();
  };
  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; }
    const dt = step(time);
    ctx.globalCompositeOperation = 'source-over';
    sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, 'rgb(255,214,235)'); sky.addColorStop(.45, 'rgb(232,205,250)'); sky.addColorStop(.75, 'rgb(198,212,250)'); sky.addColorStop(1, 'rgb(255,236,214)');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    const mx = w * .84, my = h * .16, mr = Math.max(18, h * .045);
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 3);
    mg.addColorStop(0, 'rgba(255,244,214,.55)'); mg.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = mg; ctx.fillRect(0, 0, w, h);
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fillStyle = 'rgb(255,247,224)'; ctx.fill();
    ctx.beginPath(); ctx.arc(mx + mr * .42, my - mr * .12, mr * .92, 0, TAU); ctx.fillStyle = sky; ctx.fill();

    orbs.forEach((o) => {
      o.ph += dt * .01; o.y -= o.vy * dt;
      if (o.y < -10) { o.y = h + 10; o.x = rand(0, w); }
      const glow = .4 + .4 * Math.sin(o.ph);
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fillStyle = `hsla(${o.hue},90%,85%,${glow * .5})`; ctx.fill();
    });
    clouds.forEach((c) => {
      c.x -= c.speed * .01 * dt; if (c.x < -120) c.x = w + 120;
      drawCloud(ctx, c.x, c.y, c.sc, c.hue, c.op);
    });
    stars.forEach((s) => {
      s.ph += s.ps * dt;
      drawSparkle(ctx, s.x, s.y, s.size, s.hue, Math.max(0, Math.sin(s.ph)) * .9 + .1);
    });
  };
}

/* ── Boba Café — cozy kawaii bubble-tea corner ─────────────────────────
   New scene. A caramel-cream gradient with soft bokeh painted once to an
   offscreen layer, a hand-drawn boba cup silhouette (body, milk-tea fill,
   lid, straw) baked into the same layer, then animated string-light
   twinkle, rising steam wisps and tapioca-pearl bubbles drifting up through
   the drink every frame. */
export function createBobaCafeRenderer() {
  const bubbles = [], fairy = [], steam = [];
  const step = makeStepper();
  let bgLayer = null, lw = 0, lh = 0;
  const spawnBubble = (w, h, cx, cupW, topY, cupH) => ({ x: cx + rand(-cupW * .3, cupW * .3), y: rand(topY + cupH * .5, topY + cupH - 10), r: rand(3, 7), vy: rand(.08, .22), hue: randChoice([28, 340, 20]) });
  const spawnSteam = (cx, topY) => ({ x: cx + rand(-14, 14), y: topY - 10, o: rand(.15, .3), vy: rand(.1, .2), life: 0, max: rand(120, 200), wob: rand(0, TAU) });
  let cupGeom = null;
  const init = (w, h) => {
    bgLayer = makeLayer(w, h); const c = bgLayer.getContext('2d');
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, 'rgb(255,235,214)'); sky.addColorStop(.55, 'rgb(255,214,196)'); sky.addColorStop(1, 'rgb(232,182,168)');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 10; i++) {
      const x = rand(0, w), y = rand(0, h * .5), r = rand(20, 60);
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
    const cx = w * .72, cupW = Math.min(w * .32, 220), cupH = cupW * 1.3, topY = h * .98 - cupH;
    cupGeom = { cx, cupW, cupH, topY };
    c.beginPath();
    c.moveTo(cx - cupW * .42, topY); c.lineTo(cx + cupW * .42, topY);
    c.lineTo(cx + cupW * .34, topY + cupH); c.lineTo(cx - cupW * .34, topY + cupH); c.closePath();
    const cupGrad = c.createLinearGradient(0, topY, 0, topY + cupH);
    cupGrad.addColorStop(0, 'rgba(255,255,255,.5)'); cupGrad.addColorStop(1, 'rgba(255,255,255,.28)');
    c.fillStyle = cupGrad; c.fill(); c.lineWidth = 3; c.strokeStyle = 'rgba(120,80,60,.35)'; c.stroke();
    c.beginPath();
    const fillTopY = topY + cupH * .4;
    c.moveTo(cx - cupW * .4, fillTopY); c.lineTo(cx + cupW * .4, fillTopY);
    c.lineTo(cx + cupW * .34, topY + cupH - 4); c.lineTo(cx - cupW * .34, topY + cupH - 4); c.closePath();
    c.fillStyle = 'rgba(196,140,92,.55)'; c.fill();
    if (c.roundRect) { c.beginPath(); c.roundRect(cx - cupW * .46, topY - 10, cupW * .92, 14, 6); }
    else { c.beginPath(); c.rect(cx - cupW * .46, topY - 10, cupW * .92, 14); }
    c.fillStyle = 'rgba(255,255,255,.6)'; c.fill();
    c.beginPath(); c.moveTo(cx + cupW * .14, topY - 34); c.lineTo(cx + cupW * .2, topY + cupH * .5);
    c.strokeStyle = 'rgba(255,200,220,.85)'; c.lineWidth = 7; c.lineCap = 'round'; c.stroke();

    bubbles.length = 0; steam.length = 0; fairy.length = 0;
    for (let i = 0; i < 22; i++) bubbles.push(spawnBubble(w, h, cx, cupW, topY, cupH));
    for (let i = 0; i < 4; i++) steam.push(spawnSteam(cx, topY));
    for (let i = 0; i < 16; i++) fairy.push({ x: rand(0, w), y: h * .07 + Math.sin(i) * 8, ph: rand(0, TAU), ps: rand(.02, .05), hue: randChoice([48, 330, 270]) });
  };
  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; }
    const dt = step(time), t = time * .001;
    const { cx, cupW, cupH, topY } = cupGeom;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bgLayer, 0, 0);
    fairy.forEach((f) => {
      f.ph += f.ps * dt; const glow = .4 + .6 * Math.max(0, Math.sin(f.ph));
      ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, TAU); ctx.fillStyle = `hsla(${f.hue},95%,80%,${glow})`; ctx.fill();
    });
    ctx.globalCompositeOperation = 'lighter';
    steam.forEach((s, i) => {
      s.life += dt; s.y -= s.vy * dt; s.x += Math.sin(t * .6 + s.wob) * .15;
      const fade = 1 - s.life / s.max;
      if (fade <= 0) { steam[i] = spawnSteam(cx, topY); return; }
      ctx.beginPath(); ctx.arc(s.x, s.y, 10 + s.life * .15, 0, TAU); ctx.fillStyle = `rgba(255,255,255,${s.o * fade * .5})`; ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    bubbles.forEach((b) => {
      b.y -= b.vy * dt;
      if (b.y < topY + cupH * .4) { const nb = spawnBubble(w, h, cx, cupW, topY, cupH); Object.assign(b, nb); }
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fillStyle = `hsla(${b.hue},55%,32%,.85)`; ctx.fill();
      ctx.beginPath(); ctx.arc(b.x - b.r * .3, b.y - b.r * .3, b.r * .3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill();
    });
  };
}

/* ── Jelly Aquarium — pastel jellyfish drifting through soft light rays ──
   New scene. A lavender-to-periwinkle water gradient with diagonal light
   shafts painted once; jellyfish are drawn each frame as a quadratic-curve
   bell plus wavy tentacle strokes that sway with a shared sine, rising and
   sinking slowly and pulsing a soft halo, with plain rising bubbles for
   scale and depth. */
export function createJellyAquariumRenderer() {
  const jellies = [], bubbles = [];
  const step = makeStepper();
  let bgLayer = null, lw = 0, lh = 0;
  const spawnJelly = (w, h) => ({ x: rand(w * .1, w * .9), y: rand(h * .15, h * .85), vy: rand(-.05, -.015) - rand(0, .02), sway: rand(0, TAU), sws: rand(.01, .02), size: rand(18, 34), hue: randChoice([280, 330, 190, 250]), ph: rand(0, TAU), tentacles: Math.floor(rand(5, 7)) });
  const spawnBub = (w, h) => ({ x: rand(0, w), y: h + rand(0, 40), vy: rand(.15, .35), r: rand(1.5, 4), wob: rand(0, TAU) });
  const init = (w, h) => {
    jellies.length = 0; bubbles.length = 0;
    for (let i = 0; i < 9; i++) jellies.push(spawnJelly(w, h));
    for (let i = 0; i < 40; i++) bubbles.push(spawnBub(w, h));
    bgLayer = makeLayer(w, h); const c = bgLayer.getContext('2d');
    const sea = c.createLinearGradient(0, 0, 0, h);
    sea.addColorStop(0, 'rgb(214,224,255)'); sea.addColorStop(.5, 'rgb(196,200,252)'); sea.addColorStop(1, 'rgb(158,168,232)');
    c.fillStyle = sea; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) {
      const x = rand(w * .1, w * .9);
      c.beginPath(); c.moveTo(x - 40, 0); c.lineTo(x + 40, 0); c.lineTo(x + 120, h); c.lineTo(x - 120, h); c.closePath();
      const g = c.createLinearGradient(x, 0, x + 60, h);
      g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fill();
    }
  };
  const drawJelly = (ctx, x, y, size, hue, sway, tentacles, glow) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(sway) * .06);
    ctx.beginPath();
    ctx.moveTo(-size, 0);
    ctx.quadraticCurveTo(-size, -size * 1.1, 0, -size * 1.15);
    ctx.quadraticCurveTo(size, -size * 1.1, size, 0);
    ctx.quadraticCurveTo(size * .6, size * .22, 0, size * .14);
    ctx.quadraticCurveTo(-size * .6, size * .22, -size, 0);
    ctx.closePath();
    const bg = ctx.createLinearGradient(0, -size * 1.15, 0, size * .14);
    bg.addColorStop(0, `hsla(${hue},95%,88%,${.85 * glow})`); bg.addColorStop(1, `hsla(${hue},95%,75%,${.35 * glow})`);
    ctx.fillStyle = bg; ctx.fill();
    for (let i = 0; i < tentacles; i++) {
      const tx = -size * .7 + (i / (tentacles - 1)) * size * 1.4;
      const wob = Math.sin(sway * 1.6 + i) * size * .22;
      ctx.beginPath(); ctx.moveTo(tx, size * .1);
      ctx.quadraticCurveTo(tx + wob * .5, size * .9, tx + wob, size * 1.5);
      ctx.strokeStyle = `hsla(${hue},90%,82%,${.5 * glow})`; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
    }
    const hg = ctx.createRadialGradient(0, -size * .4, 0, 0, -size * .4, size * 2.2);
    hg.addColorStop(0, `hsla(${hue},100%,90%,${.28 * glow})`); hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, -size * .4, size * 2.2, 0, TAU); ctx.fill();
    ctx.restore();
  };
  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; }
    const dt = step(time);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bgLayer, 0, 0);
    bubbles.forEach((b) => {
      b.y -= b.vy * dt; b.wob += dt * .02; b.x += Math.sin(b.wob) * .1;
      if (b.y < -10) { b.y = h + 10; b.x = rand(0, w); }
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1; ctx.stroke();
    });
    ctx.globalCompositeOperation = 'lighter';
    jellies.forEach((j) => {
      j.y += j.vy * dt; j.sway += j.sws * dt; j.ph += .01 * dt;
      if (j.y < -60) j.y = h + 60; if (j.y > h + 60) j.y = -60;
      const glow = .6 + .4 * Math.sin(j.ph);
      drawJelly(ctx, j.x, j.y, j.size, j.hue, j.sway, j.tentacles, glow);
    });
    ctx.globalCompositeOperation = 'source-over';
  };
}

/* ── Fireflies — dusk meadow, drifting glow-bugs, moonlit hill ─────
   New scene. Grass hill + moon + sparse stars painted once to an offscreen
   layer; fireflies wander with independent sine-wobble paths and pulse
   individually, drawn additively for a genuine glow rather than a flat dot. */
export function createFirefliesRenderer() {
  const flies = [];
  const step = makeStepper();
  let bgLayer = null, lw = 0, lh = 0;
  const newFly = (w, h) => ({ x: rand(0, w), y: rand(h * .35, h * .92), vx: rand(-.15, .15), vy: rand(-.12, .12), ph: rand(0, TAU), ps: rand(.012, .03), size: rand(1.6, 3.4), hue: rand(46, 70), wob: rand(0, TAU), ws: rand(.004, .009) });
  const init = (w, h) => {
    flies.length = 0; for (let i = 0; i < 50; i++) flies.push(newFly(w, h));
    bgLayer = makeLayer(w, h); const c = bgLayer.getContext('2d');
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, 'rgb(9,15,34)'); sky.addColorStop(.5, 'rgb(21,27,50)'); sky.addColorStop(.8, 'rgb(46,40,58)'); sky.addColorStop(1, 'rgb(28,24,32)');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    const mx = w * .82, my = h * .16;
    const mg = c.createRadialGradient(mx, my, 0, mx, my, h * .3);
    mg.addColorStop(0, 'rgba(240,240,220,.32)'); mg.addColorStop(1, 'rgba(240,240,220,0)');
    c.fillStyle = mg; c.fillRect(0, 0, w, h);
    c.beginPath(); c.arc(mx, my, Math.max(12, h * .026), 0, TAU); c.fillStyle = 'rgb(236,234,214)'; c.fill();
    for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(rand(0, w), rand(0, h * .4), rand(.4, 1.2), 0, TAU); c.fillStyle = `rgba(230,235,255,${rand(.2, .6)})`; c.fill(); }
    const ph1 = rand(0, 6);
    c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) c.lineTo(x, h * .72 + Math.sin(x * .0026 + ph1) * h * .04);
    c.lineTo(w, h); c.closePath(); c.fillStyle = 'rgb(13,19,15)'; c.fill();
    for (let i = 0; i < Math.floor(w / 9); i++) {
      const x = rand(0, w), baseY = h * (.9 + rand(0, .09)), bh = rand(h * .03, h * .09), lean = rand(-.3, .3);
      c.strokeStyle = 'rgba(4,8,6,.9)'; c.lineWidth = rand(1, 2);
      c.beginPath(); c.moveTo(x, baseY); c.quadraticCurveTo(x + lean * bh * .5, baseY - bh * .6, x + lean * bh, baseY - bh); c.stroke();
    }
  };
  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; }
    const dt = step(time);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bgLayer, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    flies.forEach(f => {
      f.ph += f.ps * dt; f.wob += f.ws * dt;
      f.x += (f.vx + Math.sin(f.wob) * .25) * dt; f.y += (f.vy + Math.cos(f.wob * .8) * .2) * dt;
      if (f.x < -10) f.x = w + 10; if (f.x > w + 10) f.x = -10;
      if (f.y < h * .3) f.y = h * .3; if (f.y > h * .95) f.y = h * .95;
      const glow = .3 + .7 * Math.max(0, Math.sin(f.ph));
      const r = f.size * (1 + glow * 1.4);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 4);
      g.addColorStop(0, `hsla(${f.hue},100%,75%,${.85 * glow})`); g.addColorStop(.3, `hsla(${f.hue},100%,65%,${.35 * glow})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r * 4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(f.x, f.y, r * .5, 0, TAU); ctx.fillStyle = `hsla(${f.hue},100%,90%,${.9 * glow})`; ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  };
}

/* ── Meteor Shower — desert dunes under a streaking night sky ──────
   New scene. Three layered dune silhouettes + dense stars painted once;
   meteors are respawned on a stagger so there's always 1-2 in flight, each
   a gradient-stroked line with a bright head, angled low across the sky. */
export function createMeteorRenderer() {
  const stars = [], meteors = [];
  const step = makeStepper();
  let bgLayer = null, lw = 0, lh = 0;
  const spawnMeteor = (w, h) => ({ x: rand(w * .1, w * 1.1), y: rand(-h * .05, h * .35), len: rand(60, 160), speed: rand(6, 11), angle: rand(.55, .75), life: rand(-40, 0), max: rand(40, 80), op: rand(.6, 1) });
  const init = (w, h) => {
    stars.length = 0; meteors.length = 0;
    for (let i = 0; i < 220; i++) stars.push({ x: rand(0, w), y: rand(0, h * .75), r: rand(.3, 2), base: rand(.2, .9), ts: rand(.4, 2), to: rand(0, TAU) });
    for (let i = 0; i < 2; i++) meteors.push(spawnMeteor(w, h));
    bgLayer = makeLayer(w, h); const c = bgLayer.getContext('2d');
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, 'rgb(8,10,28)'); sky.addColorStop(.55, 'rgb(20,18,40)'); sky.addColorStop(.82, 'rgb(58,36,42)'); sky.addColorStop(1, 'rgb(80,52,40)');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    const band = c.createLinearGradient(w * .1, 0, w * .9, h * .6);
    band.addColorStop(0, 'rgba(200,190,255,0)'); band.addColorStop(.5, 'rgba(200,190,255,.05)'); band.addColorStop(1, 'rgba(200,190,255,0)');
    c.fillStyle = band; c.fillRect(0, 0, w, h);
    const dune = (baseY, amp, ph, f, col) => {
      c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) c.lineTo(x, baseY + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.2 + ph * 1.4) * amp * .35);
      c.lineTo(w, h); c.closePath(); c.fillStyle = col; c.fill();
    };
    dune(h * .8, h * .03, rand(0, 6), .0022, 'rgb(64,40,34)');
    dune(h * .87, h * .022, rand(0, 6), .003, 'rgb(38,22,20)');
    dune(h * .94, h * .015, rand(0, 6), .0038, 'rgb(18,10,10)');
  };
  return (ctx, canvas, time) => {
    const { width: w, height: h } = canvas;
    if (w !== lw || h !== lh) { init(w, h); lw = w; lh = h; }
    const dt = step(time), t = time * .001;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bgLayer, 0, 0);
    stars.forEach(s => { const f = s.base * (.5 + .5 * Math.sin(t * s.ts + s.to)); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fillStyle = `rgba(235,235,255,${f})`; ctx.fill(); });
    ctx.globalCompositeOperation = 'lighter';
    meteors.forEach((m, i) => {
      m.life += dt;
      if (m.life > 0) {
        m.x -= Math.cos(m.angle) * m.speed * dt; m.y += Math.sin(m.angle) * m.speed * dt;
        const tailX = m.x + Math.cos(m.angle) * m.len, tailY = m.y - Math.sin(m.angle) * m.len;
        const g = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        g.addColorStop(0, `rgba(255,250,235,${m.op})`); g.addColorStop(.4, `rgba(255,220,180,${m.op * .5})`); g.addColorStop(1, 'rgba(255,200,150,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tailX, tailY); ctx.stroke();
        ctx.beginPath(); ctx.arc(m.x, m.y, 2.2, 0, TAU); ctx.fillStyle = `rgba(255,255,245,${m.op})`; ctx.fill();
      }
      if (m.life > m.max || m.y > h * .85 || m.x < -m.len) meteors[i] = spawnMeteor(w, h);
    });
    ctx.globalCompositeOperation = 'source-over';
  };
}

/* ── Curated registry ─────────────────────────────────────────────────────
   `opacity` is how strongly the canvas sits over `base` (the colour under it,
   also used while scenes cross-fade). The six Zenith originals keep the
   translucent overlay treatment they were designed for; the rebuilt scenes
   and the three new ones below paint their own full backdrop, so they run
   at (nearly) full strength. */
export const AMBIENT_ENVIRONMENTS = {
  rain:        { label: 'Rain',             icon: '🌧', create: createRainRenderer,          opacity: .55, base: '#0b0b12' },
  forest:      { label: 'Forest',           icon: '🌿', create: createForestRenderer,        opacity: .55, base: '#0b0b12' },
  night:       { label: 'Night Sky',        icon: '🌙', create: createNightRenderer,         opacity: .55, base: '#0b0b12' },
  cosmic:      { label: 'Cosmic',           icon: '🌠', create: createCosmicRenderer,        opacity: .55, base: '#0b0b12' },
  lantern:     { label: 'Lantern Night',    icon: '🪔', create: createLanternRenderer,       opacity: .55, base: '#0b0b12' },
  candlelight: { label: 'Candlelight',      icon: '🕯', create: createCandlelightRenderer,   opacity: .55, base: '#0b0b12' },
  fireplace:   { label: 'Fireplace',        icon: '🔥', create: createFireplaceRenderer,     opacity: 1,   base: '#1a0c07' },
  snow:        { label: 'Snowfall',         icon: '❄',  create: createSnowRenderer,          opacity: 1,   base: '#1c3050' },
  ocean:       { label: 'Deep Sea',         icon: '🌊', create: createOceanRenderer,         opacity: 1,   base: '#053458' },
  cherry:      { label: 'Cherry Blossom',   icon: '🌸', create: createCherryBlossomRenderer, opacity: 1,   base: '#602e56' },
  window:      { label: 'Rainy Window',     icon: '🪟', create: createRainyWindowRenderer,   opacity: 1,   base: '#141a2c' },
  library:     { label: 'Midnight Library', icon: '📚', create: createLibraryRenderer,       opacity: 1,   base: '#1a0f09' },
  pastelsky:   { label: 'Pastel Sky',       icon: '🎀', create: createPastelSkyRenderer,     opacity: 1,   base: '#e8c7e8' },
  fireflies:   { label: 'Fireflies',        icon: '✨', create: createFirefliesRenderer,     opacity: 1,   base: '#0d1128' },
  meteor:      { label: 'Meteor Shower',    icon: '☄️', create: createMeteorRenderer,        opacity: 1,   base: '#08122c' },
  wormhole:    { label: 'Wormhole',         icon: '🌀', create: createWormholeRenderer,      opacity: 1,   base: '#03020a' },
  bobacafe:    { label: 'Boba Café',        icon: '🧋', create: createBobaCafeRenderer,      opacity: 1,   base: '#f3d3bd' },
  jellyaquarium: { label: 'Jelly Aquarium', icon: '🪼', create: createJellyAquariumRenderer, opacity: 1,   base: '#c6c8fc' },
  solarsystem: { label: 'Solar System',   icon: '🪐', create: createSolarSystemRenderer,   opacity: 1,   base: '#03030a' },
  milkyway:    { label: 'Milky Way',      icon: '🌌', create: createMilkyWayRenderer,      opacity: 1,   base: '#020207' },
  blackhole:   { label: 'Black Hole',     icon: '🕳',  create: createBlackHoleRenderer,     opacity: 1,   base: '#080605' },
};
