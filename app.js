/* ═══════════════════════════════════════════════════════════
   ROYAL WEDDING INVITE — ENGINE
   Frame-scrub cinema · petals · scratch card
   synth bells · countdown · RSVP · 3D-world portal
   ═══════════════════════════════════════════════════════════ */
(() => {
"use strict";

const CFG = window.WEDDING_CONFIG;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const IS_TOUCH = matchMedia("(pointer: coarse)").matches;
const SAVE_DATA = !!(navigator.connection && navigator.connection.saveData);
const DPR = Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2);
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
/* QA shim: "?tick" drives the loop with setTimeout where rAF is unavailable
   (hidden-tab automated testing). Real visitors always get rAF. */
const RAF = /[?&]tick/.test(location.search)
  ? (fn) => setTimeout(() => fn(performance.now()), 16)
  : (fn) => requestAnimationFrame(fn);

/* ── Theme from config ──────────────────────────────────── */
{
  const t = CFG.theme, r = document.documentElement.style;
  r.setProperty("--maroon", t.maroon);
  r.setProperty("--maroon-deep", t.maroonDeep);
  r.setProperty("--gold", t.gold);
  r.setProperty("--gold-soft", t.goldSoft);
  r.setProperty("--ivory", t.ivory);
  r.setProperty("--ink", t.inkOnIvory);
}

/* ── Stable viewport unit (no URL-bar jumps) ────────────── */
let vhPx = Math.max(window.innerHeight, 1) / 100;
const setVh = () => {
  if (window.innerHeight < 120) return;   // ignore transient 0-height resize events
  vhPx = window.innerHeight / 100;
  document.documentElement.style.setProperty("--vh", vhPx + "px");
};
setVh();
let lastW = window.innerWidth, rzTimer = 0;
const remeasure = () => {
  setVh();
  scrub.resize();
  petals.resize();
  sanctum.resize();
};
window.addEventListener("resize", () => {
  // On touch devices ignore height-only resizes (URL bar collapse)
  if (IS_TOUCH && window.innerWidth === lastW) return;
  lastW = window.innerWidth;
  remeasure();
  clearTimeout(rzTimer);
  rzTimer = setTimeout(remeasure, 280);   // settle pass after the browser finishes resizing
});
window.addEventListener("orientationchange", () => {
  clearTimeout(rzTimer);
  rzTimer = setTimeout(remeasure, 350);
});

/* ═══════════════ AUDIO — synthesized temple sounds ═══════ */
const audio = (() => {
  let ctx = null, master = null, bgm = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem("wed-muted") === "1"; } catch {}
  let bgmFadeToken = 0;

  const init = () => {
    if (ctx) { ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();                                  // iOS ships it suspended
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  };

  /* Background score — the real instrument, started inside the tap gesture */
  const startBgm = () => {
    if (bgm) return;
    bgm = new Audio("assets/audio/bgm.m4a");
    bgm.preload = "metadata";
    bgm.loop = true;
    bgm.playsInline = true;
    bgm.volume = 0;
    bgm.muted = muted;
    bgm.play().then(() => fadeBgmTo(0.32, 1900)).catch(() => {});
  };

  const fadeBgmTo = (target, duration = 600, pauseAtEnd = false) => {
    if (!bgm) return;
    const token = ++bgmFadeToken;
    const from = bgm.volume;
    const started = performance.now();
    const step = (now) => {
      if (token !== bgmFadeToken || !bgm) return;
      const p = clamp((now - started) / Math.max(1, duration), 0, 1);
      const eased = 1 - Math.pow(1 - p, 2);
      bgm.volume = from + (target - from) * eased;
      if (p < 1) requestAnimationFrame(step);
      else if (pauseAtEnd) bgm.pause();
    };
    requestAnimationFrame(step);
  };

  /* Soft airy whoosh for scroll gusts */
  let lastWhoosh = -1;
  const whoosh = (strength = 0.5) => {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    if (t - lastWhoosh < 0.65) return;
    lastWhoosh = t;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = "bandpass"; f.Q.value = 0.6;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + 0.28);
    f.frequency.exponentialRampToValueAtTime(240, t + 0.7);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * strength, t + 0.16);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + 0.75);
  };

  /* Scratchy foil texture while the finger rubs */
  let lastScratch = 0;
  const scratchNoise = () => {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    if (t - lastScratch < 0.07) return;
    lastScratch = t;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    f.type = "highpass"; f.frequency.value = 2400 + Math.random() * 1200;
    g.gain.setValueAtTime(0.028, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + 0.09);
  };

  /* Temple bell — inharmonic partials + strike noise */
  const bell = (base = 432, vol = 0.5, dur = 3.2) => {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const partials = [[1, 1], [2.74, 0.45], [5.4, 0.22], [8.93, 0.09]];
    partials.forEach(([ratio, g]) => {
      const o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = "sine";
      o.frequency.value = base * ratio;
      o.detune.value = (Math.random() - 0.5) * 6;
      gn.gain.setValueAtTime(vol * g * 0.32, now);
      gn.gain.exponentialRampToValueAtTime(0.0001, now + dur * (1 - ratio * 0.06));
      o.connect(gn).connect(master);
      o.start(now); o.stop(now + dur);
    });
    // strike transient
    const nb = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g2 = ctx.createGain();
    src.buffer = nb; f.type = "bandpass"; f.frequency.value = base * 2.7; f.Q.value = 2;
    g2.gain.value = vol * 0.25;
    src.connect(f).connect(g2).connect(master);
    src.start(now);
  };

  const chime = () => bell(864, 0.22, 1.6);

  const toggleMute = () => {
    muted = !muted;
    try { localStorage.setItem("wed-muted", muted ? "1" : "0"); } catch {}
    if (master) master.gain.linearRampToValueAtTime(muted ? 0 : 1, ctx.currentTime + 0.3);
    if (bgm) bgm.muted = muted;
    return muted;
  };

  const fadeForWorld = (duration = 720) => {
    if (ctx && master) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.0001, now + duration / 1000);
    }
    fadeBgmTo(0, duration, true);
  };

  const pauseForWorld = () => {
    ++bgmFadeToken;
    if (bgm) {
      bgm.pause();
      bgm.volume = 0;
    }
    if (ctx && ctx.state !== "closed") ctx.suspend().catch(() => {});
  };

  const restoreAfterWorld = () => {
    ++bgmFadeToken;
    if (ctx && ctx.state !== "closed") ctx.resume().catch(() => {});
    if (ctx && master) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(muted ? 0.0001 : 1, now + 0.45);
    }
    if (bgm && !muted) {
      bgm.volume = 0;
      bgm.play().then(() => fadeBgmTo(0.32, 650)).catch(() => {});
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { ctx && ctx.suspend(); bgm && bgm.pause(); }
    else { ctx && ctx.resume(); bgm && !muted && bgm.play().catch(() => {}); }
  });

  return {
    init, bell, chime, startBgm, whoosh, scratchNoise, toggleMute,
    fadeForWorld, pauseForWorld, restoreAfterWorld, isMuted: () => muted,
    hasBgm: () => !!bgm,
  };
})();

/* ═══════════════ FRAME STORE — two-tier loader ═══════════ */
const frames = (() => {
  const N = CFG.frames.count;
  const lo = new Array(N), hi = new Array(N);
  const loState = new Uint8Array(N);          // 0 none · 1 loading · 2 ready · 3 failed
  const hiState = new Uint8Array(N);
  const name = (i) => CFG.frames.prefix + String(i + 1).padStart(3, "0") + CFG.frames.ext;
  const memory = Number(navigator.deviceMemory || 8);
  const lowMemory = memory <= 2;
  const connection = navigator.connection || {};
  const slowConnection = /(^|-)2g$/.test(connection.effectiveType || "");
  const hiEnabled = !SAVE_DATA && !IS_TOUCH && !slowConnection && innerWidth >= 900 && memory >= 4;
  // Prepare roughly one full viewport of decoded frames before the doors open.
  // The longer seal screen prevents a cold swipe from outrunning the runway.
  const GATE_TARGET = SAVE_DATA ? 10 : lowMemory ? 20 : IS_TOUCH ? 32 : 40;
  const GATE = Math.min(GATE_TARGET, N);
  const GATE_LIMIT = SAVE_DATA ? 1 : lowMemory ? 2 : IS_TOUCH ? 3 : 5;
  const LO_LIMIT = SAVE_DATA ? 1 : lowMemory ? 2 : IS_TOUCH ? 3 : 5;
  const LO_AHEAD = SAVE_DATA ? 10 : lowMemory ? 18 : IS_TOUCH ? 24 : 36;
  const LO_BEHIND = SAVE_DATA || lowMemory ? 6 : IS_TOUCH ? 8 : 12;
  const LO_KEEP_AHEAD = LO_AHEAD + 4;
  const LO_KEEP_BEHIND = LO_BEHIND + 4;
  // Portrait frames stay in a bounded window; upgrade desktop stills singly.
  const HI_LIMIT = 1, HI_RADIUS = 1, HI_KEEP = 2;
  let loActive = 0, loStreaming = false, demandActive = true;
  let hiActive = 0, current = 0, direction = 1, hiStarted = false, hiCalm = false;

  const evictLo = () => {
    if (!loStreaming) return;
    const keepAhead = demandActive ? LO_KEEP_AHEAD : 3;
    const keepBehind = demandActive ? LO_KEEP_BEHIND : 3;
    for (let i = 0; i < N; i++) {
      const distance = (i - current) * direction;
      if (loState[i] === 2 && (distance < -keepBehind || distance > keepAhead)) {
        if (lo[i]) {
          lo[i].onload = lo[i].onerror = null;
          lo[i].src = "";
        }
        lo[i] = null;
        loState[i] = 0;
      }
    }
  };

  const loadLo = (i, done) => {
    if (i < 0 || i >= N || loState[i] !== 0) return false;
    loState[i] = 1;
    loActive++;
    const img = new Image();
    img.decoding = "async";
    img._scrubKey = `lo-${i}`;
    if (loStreaming) {
      const distance = Math.abs(i - current);
      img.fetchPriority = SAVE_DATA ? "low" : distance <= 4 ? "high" : "auto";
    }
    lo[i] = img;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      loState[i] = img.naturalWidth ? 2 : 3;
      loActive--;
      evictLo();
      if (done) done(loState[i] === 2);
    };
    const timeout = setTimeout(() => { img.src = ""; settle(); }, 9000);
    img.onload = () => {
      if (typeof img.decode === "function") img.decode().then(settle, settle);
      else settle();
    };
    img.onerror = settle;
    img.src = CFG.frames.loPath + name(i);
    return true;
  };

  /* Entry is gated on the first GATE frames only; the rest stream behind
     the opened doors. No request for the remaining frames is made up front. */
  const preloadLo = (onProgress) => new Promise((resolve, reject) => {
    if (!GATE) { resolve(); return; }
    let next = 0, readyCount = 0, finished = false;
    const retryQueue = [];
    const attempts = new Uint8Array(GATE);
    const MAX_GATE_ATTEMPTS = 5;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve();
    };
    const fail = (idx) => {
      if (finished) return;
      finished = true;
      reject(new Error(`Opening frame ${idx + 1} could not be prepared`));
    };
    const queueRetry = (idx) => {
      const delay = Math.min(3200, 350 * Math.pow(1.8, Math.min(attempts[idx], 5)));
      setTimeout(() => {
        if (finished) return;
        if (loState[idx] === 3) loState[idx] = 0;
        retryQueue.push(idx);
        pumpGate();
      }, delay);
    };
    const pumpGate = () => {
      if (finished) return;
      while (!finished && loActive < GATE_LIMIT && (retryQueue.length || next < GATE)) {
        const idx = retryQueue.length ? retryQueue.shift() : next++;
        if (loState[idx] === 3) loState[idx] = 0;
        attempts[idx] = Math.min(attempts[idx] + 1, 20);
        const started = loadLo(idx, (ready) => {
          if (finished) return;
          if (ready) {
            readyCount++;
            onProgress(readyCount / GATE);
            if (readyCount === GATE) { finish(); return; }
          } else if (attempts[idx] >= MAX_GATE_ATTEMPTS) {
            fail(idx);
            return;
          } else queueRetry(idx);
          pumpGate();
        });
        if (!started && loState[idx] !== 2) {
          if (attempts[idx] >= MAX_GATE_ATTEMPTS) fail(idx);
          else queueRetry(idx);
        }
      }
    };
    pumpGate();
  });

  const pumpLo = () => {
    if (!loStreaming || !demandActive) return;
    while (loActive < LO_LIMIT) {
      let idx = -1;
      for (let d = 0; d <= LO_AHEAD; d++) {
        const a = current + d * direction;
        if (a >= 0 && a < N && loState[a] === 0) { idx = a; break; }
        // Warm nearby reverse frames too, before filling the distant runway.
        const near = current - d * direction;
        if (d > 0 && d <= 3 && near >= 0 && near < N && loState[near] === 0) { idx = near; break; }
      }
      if (idx < 0) {
        for (let d = 1; d <= LO_BEHIND; d++) {
          const b = current - d * direction;
          if (b >= 0 && b < N && loState[b] === 0) { idx = b; break; }
        }
      }
      if (idx < 0 || !loadLo(idx, pumpLo)) return;
    }
  };

  const evictHi = () => {
    const keep = demandActive ? HI_KEEP : 1;
    for (let i = 0; i < N; i++) {
      if (hiState[i] === 2 && Math.abs(i - current) > keep) {
        if (hi[i]) {
          hi[i].onload = hi[i].onerror = null;
          hi[i].src = "";
        }
        hi[i] = null;
        hiState[i] = 0;
      }
    }
  };

  const pumpHi = () => {
    if (!hiEnabled || !hiStarted || !demandActive || !hiCalm) return;
    while (hiActive < HI_LIMIT) {
      let idx = -1;
      for (let d = 0; d <= HI_RADIUS; d++) {
        const a = current + d, b = current - d;
        if (a < N && hiState[a] === 0) { idx = a; break; }
        if (b >= 0 && hiState[b] === 0) { idx = b; break; }
      }
      if (idx === -1) return;
      hiState[idx] = 1; hiActive++;
      const img = new Image();
      img.decoding = "async";
      img._scrubKey = `hi-${idx}`;
      hi[idx] = img;
      let settled = false;
      const finish = (ready) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        hiState[idx] = ready ? 2 : 3;
        hiActive--;
        if (ready) evictHi();
        pumpHi();
      };
      const timeout = setTimeout(() => { img.src = ""; finish(false); }, 9000);
      img.onload = () => {
        if (typeof img.decode === "function") img.decode().then(() => finish(true), () => finish(true));
        else finish(true);
      };
      img.onerror = () => finish(false);
      img.src = CFG.frames.hiPath + name(idx);
    }
  };

  return {
    N,
    preloadLo,
    startLo: () => {
      if (loStreaming) return;
      loStreaming = true;
      pumpLo();
    },
    startHi: () => {
      if (!hiEnabled || hiStarted) return;
      setTimeout(() => { hiStarted = true; pumpHi(); }, 5500);
    },
    setHiCalm: (next) => {
      if (hiCalm === next) return;
      hiCalm = next;
      if (hiCalm) pumpHi();
    },
    setDemandActive: (next) => {
      demandActive = next;
      if (demandActive) {
        pumpLo();
        pumpHi();
      } else {
        hiCalm = false;
        evictLo();
        evictHi();
      }
    },
    setPlayhead: (i) => {
      const next = clamp(Math.round(i), 0, N - 1);
      if (next === current) return;
      direction = next > current ? 1 : -1;
      current = next;
      evictLo();
      pumpLo();
      evictHi();
      pumpHi();
    },
    /* best available image for frame i; prefer hi only when settled */
    get: (i, settled) => {
      if (settled && hiState[i] === 2 && hi[i]) return hi[i];
      if (loState[i] === 2 && lo[i]) return lo[i];
      for (let d = 1; d < N; d++) {
        const a = i + d * direction, b = i - d * direction;
        if (a >= 0 && a < N && loState[a] === 2 && lo[a]) return lo[a];
        if (b >= 0 && b < N && loState[b] === 2 && lo[b]) return lo[b];
      }
      return null;
    },
    prime: (i, img) => {
      if (i < 0 || i >= N || !img || !img.naturalWidth) return;
      img._scrubKey = `lo-${i}`;
      lo[i] = img;
      loState[i] = 2;
    },
  };
})();

/* ═══════════════ SCRUB ENGINE — the unfolding ════════════ */
const scrub = (() => {
  const canvas = $("#scrub"), ctx2d = canvas.getContext("2d", { alpha: false });
  const hero = $("#hero");
  // Give the sequence enough physical scroll distance to advance
  // one-or-two frames per touch sample instead of jumping several at once.
  const SCRUB_VH = IS_TOUCH ? 450 : 340;
  let cur = 0, target = 0, drawn = "", settledFrames = 0, active = true;
  let scrollStart = 0, scrollDistance = 1, backdropKey = "";

  const measureScrollRange = () => {
    const rect = hero.getBoundingClientRect();
    scrollStart = window.scrollY + rect.top;
    scrollDistance = Math.max(rect.height - vhPx * 100, 1);
  };

  new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting;
    frames.setDemandActive(active);
    if (active) {
      measureScrollRange();
      drawn = "";
    }
  }, { rootMargin: "160px 0px" }).observe(hero);

  const resize = () => {
    const nextWidth = Math.round(canvas.clientWidth * DPR);
    const nextHeight = Math.round(canvas.clientHeight * DPR);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      ctx2d.imageSmoothingEnabled = true;
      ctx2d.imageSmoothingQuality = "high";
      backdropKey = "";
    }
    ivory = IVORY();
    drawn = "";
    hero.style.height = (REDUCED ? 100 : SCRUB_VH + 100) * vhPx + "px";
    measureScrollRange();
    if (REDUCED && nextWidth > 1 && nextHeight > 1) draw(frames.get(0, false));
  };

  const IVORY = () => getComputedStyle(document.documentElement).getPropertyValue("--ivory").trim() || "#F4EBDB";
  let ivory = "#F4EBDB";
  const draw = (img) => {
    if (!img || !img.naturalWidth) return false;
    if (canvas.width < 2 || canvas.height < 2) { resize(); if (canvas.width < 2) return; }
    const cw = canvas.width, ch = canvas.height;
    // The world floats above the page; the CSS vignette feathers its edges.
    const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight) * 0.97;
    const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    const py = (ch - h) * 0.42;                       // sit slightly above centre; copy breathes below
    const x = Math.round((cw - w) / 2);
    const y = Math.round(py);
    const nextBackdropKey = `${x}:${y}:${w}:${h}`;
    if (nextBackdropKey !== backdropKey) {
      ctx2d.fillStyle = ivory;
      ctx2d.fillRect(0, 0, cw, ch);
      // Fit the existing feathered edge to the portrait artwork, not the screen.
      hero.style.setProperty("--scene-x", `${x / cw * 100}%`);
      hero.style.setProperty("--scene-y", `${y / ch * 100}%`);
      hero.style.setProperty("--scene-w", `${w / cw * 100}%`);
      hero.style.setProperty("--scene-h", `${h / ch * 100}%`);
      backdropKey = nextBackdropKey;
    }
    ctx2d.drawImage(img, x, y, w, h);
    return true;
  };

  let progress = 0;
  const tick = (dt) => {
    if (!active) return 0;
    progress = clamp((window.scrollY - scrollStart) / scrollDistance, 0, 1);
    target = progress * (frames.N - 1);
    const gap = Math.abs(target - cur);
    const response = IS_TOUCH ? (gap > 8 ? 30 : 22) : (gap > 10 ? 20 : 14);
    cur = lerp(cur, target, 1 - Math.exp(-dt * response));
    const vel = Math.abs(target - cur);
    if (vel < 1.4) settledFrames++; else settledFrames = 0;
    const i = Math.round(cur);
    frames.setPlayhead(i);
    const settled = settledFrames > 2;
    frames.setHiCalm(settledFrames > 8);
    const img = frames.get(i, settled);
    const key = img?._scrubKey || "";
    if (img && key !== drawn && draw(img)) drawn = key;

    return vel;
  };

  return {
    resize, tick,
    getProgress: () => progress,
    firstPaint: () => draw(frames.get(0, false)),
  };
})();

/* ═══════════════ PETALS — ambient particle system ════════ */
const petals = (() => {
  const canvas = $("#petals"), c = canvas.getContext("2d");
  let petalDpr = IS_TOUCH ? 1 : Math.min(DPR, 1.25);
  const COLORS = [
    ["#8C2B47", "#5C1428"],   // rose maroon
    ["#E5B54B", "#C9922B"],   // marigold
    ["#F4EBDB", "#E0CDA8"],   // ivory
  ];
  /* Pre-render each petal once. Drawing sprites is considerably cheaper than
     rebuilding a gradient and Bezier path for every particle on every frame. */
  const SPRITES = COLORS.map(([c1, c2]) => {
    const sprite = document.createElement("canvas");
    sprite.width = 48; sprite.height = 64;
    const sc = sprite.getContext("2d");
    const gradient = sc.createLinearGradient(24, 2, 24, 62);
    gradient.addColorStop(0, c1); gradient.addColorStop(1, c2);
    sc.fillStyle = gradient;
    sc.beginPath();
    sc.moveTo(24, 2);
    sc.quadraticCurveTo(46, 21, 24, 62);
    sc.quadraticCurveTo(2, 21, 24, 2);
    sc.fill();
    return sprite;
  });
  let list = [], gust = 0, running = false, lowPerf = false, paintAcc = 0;

  const resize = () => {
    canvas.width = Math.round(innerWidth * petalDpr);
    canvas.height = Math.round(innerHeight * petalDpr);
  };

  const spawn = (x, y, burst = false) => {
    const sprite = (Math.random() * SPRITES.length) | 0;
    list.push({
      x: x ?? Math.random() * innerWidth,
      y: y ?? -30,
      s: 7 + Math.random() * 11,
      vy: (burst ? 1.5 : 0.35) + Math.random() * 0.55,
      vx: burst ? (Math.random() - 0.5) * 3 : 0,
      ph: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.04,
      sprite,
      burst,
      life: 1,
      fade: burst ? 0.004 : 0,
    });
  };

  const baseCount = () => (lowPerf ? 2 : IS_TOUCH ? 4 : 8);

  const step = (dt) => {
    if (!running) return;
    paintAcc += dt;
    const interval = 1 / (lowPerf ? 18 : IS_TOUCH ? 24 : 30);
    if (paintAcc < interval) return;
    dt = Math.min(paintAcc, 0.06);
    paintAcc = 0;
    c.clearRect(0, 0, canvas.width, canvas.height);
    const n = baseCount();
    if (list.length < n && Math.random() < 0.1) spawn();
    gust *= Math.pow(0.92, dt * 60);
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.ph += dt * 1.6;
      p.x += (Math.sin(p.ph) * 0.5 + p.vx) * dt * 60;
      p.y += (p.vy + gust) * dt * 60;
      p.rot += (p.vr + Math.sin(p.ph) * 0.008) * dt * 60;
      p.vx *= Math.pow(0.97, dt * 60);
      if (p.fade) p.life -= p.fade * dt * 600;
      if (p.y > innerHeight + 40 || p.life <= 0) { list.splice(i, 1); continue; }
      // draw petal
      c.save();
      c.translate(p.x * petalDpr, p.y * petalDpr);
      c.rotate(p.rot);
      c.scale(petalDpr, petalDpr);
      c.globalAlpha = 0.78 * Math.max(p.life, 0);
      c.drawImage(SPRITES[p.sprite], -p.s * 0.78, -p.s, p.s * 1.56, p.s * 2);
      c.restore();
    }
  };

  return {
    resize, step,
    start: () => { running = true; paintAcc = 1; gust = 0; },
    addGust: (g) => { if (running) gust = clamp(gust + g, -2, 4); },
    burst: (x, y, n = 12) => {
      if (!running) return;
      const cap = lowPerf ? 6 : IS_TOUCH ? 8 : 12;
      for (let i = 0; i < Math.min(n, cap); i++) spawn(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 40, true);
    },
    setLowPerf: () => {
      lowPerf = true;
      if (petalDpr > 1) { petalDpr = 1; resize(); }
      let ambient = 0, transient = 0;
      list = list.filter((p) => p.burst ? transient++ < 6 : ambient++ < 2);
    },
  };
})();

/* ═══════════════ COUNTDOWN ═══════════════════════════════ */
(() => {
  const tgt = new Date(CFG.wedding.dateISO).getTime();
  const el = { d: $("#cd-d"), h: $("#cd-h"), m: $("#cd-m"), s: $("#cd-s") };
  const pad = (n) => String(n).padStart(2, "0");
  const set = (node, txt) => { if (node.textContent !== txt) node.textContent = txt; };
  const upd = () => {
    let ms = tgt - Date.now();
    if (ms <= 0) {
      $("#countdown").innerHTML = `<p class="countdown-complete">॥ शुभ विवाह ॥ Today, forever begins.</p>`;
      clearInterval(iv);
      return;
    }
    set(el.d, pad(ms / 864e5 | 0));
    set(el.h, pad((ms / 36e5 | 0) % 24));
    set(el.m, pad((ms / 6e4 | 0) % 60));
    set(el.s, pad((ms / 1e3 | 0) % 60));
  };
  const iv = setInterval(upd, 1000);
  upd();
})();

/* ═══════════════ EVENT CARDS ═════════════════════════════ */
(() => {
  const ICONS = {
    haldi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 13h16c0 3.5-2.5 7-8 7s-8-3.5-8-7z"/><path d="M12 10c0-2.4 1.8-3.2 1.8-5M9 10c0-1.7 1.2-2.3 1.2-3.8M15 10c0-1.7 1.2-2.3 1.2-3.8"/></svg>`,
    sangeet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 18V6l10-2v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/></svg>`,
    wedding: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 3c2.8 3.2 5 5.9 5 9a5 5 0 0 1-10 0c0-3.1 2.2-5.8 5-9z"/><path d="M12 21v-4"/><path d="M7 21h10"/></svg>`,
    reception: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 3h4l-1.2 7a2.8 2.8 0 1 1-1.6 0z" transform="rotate(-14 9 12)"/><path d="M13 3h4l-1.2 7a2.8 2.8 0 1 1-1.6 0z" transform="rotate(14 15 12)"/><path d="M12 2l.5 1.5M10 1.5l0 1"/></svg>`,
  };
  const wrap = $("#event-cards");
  CFG.events.forEach((ev) => {
    const card = document.createElement("article");
    const attire = CFG.dressCodes?.[ev.dressCode];
    card.className = "event-card";
    card.classList.toggle("has-attire", Boolean(attire));
    card.style.setProperty("--accent", ev.accent);
    card.innerHTML = `
      <div class="event-summary">
        <span class="event-ico" aria-hidden="true">${ICONS[ev.icon] || ICONS.wedding}</span>
        <h3 class="event-name">${ev.name}</h3>
        <p class="event-line">${ev.line}</p>
        <p class="event-meta"><b>${ev.date}</b> · ${ev.time}<br>${ev.venue}</p>
      </div>
      ${attire ? `<div class="event-attire">
        <span class="dress-swatches attire-swatches ${attire.palette}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <dl><dt>Dress code</dt><dd>${attire.theme}</dd></dl>
      </div>` : ""}`;
    wrap.appendChild(card);
  });

  let chimed = 0;
  const show = (el, stagger) => setTimeout(() => {
    el.classList.add("shown");
    if (chimed++ < 4) audio.chime();
  }, 120 * stagger);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        show(e.target, [...wrap.children].indexOf(e.target));
        io.unobserve(e.target);
      });
    }, { threshold: 0.25 });
    [...wrap.children].forEach((el) => io.observe(el));
  } else {
    [...wrap.children].forEach((el, i) => show(el, i));
  }
})();

/* ═══════════════ SCRATCH CARD ════════════════════════════ */
(() => {
  const heading = $("#scratch-heading");
  const message = $("#scratch-message");
  const canvas = $("#scratch-foil");
  const wrap = $("#scratch-wrap");
  if (!heading || !message || !canvas || !wrap || !CFG.scratch) return;
  heading.textContent = CFG.scratch.heading;
  message.textContent = CFG.scratch.message;

  const c = canvas.getContext("2d");
  let painted = false, cleared = false, strokes = 0, foilW = 0, foilH = 0;

  /* Run the decorative border only while the card is near the viewport. */
  if (!REDUCED && "IntersectionObserver" in window) {
    const borderObserver = new IntersectionObserver(([entry]) => {
      wrap.classList.toggle("scratch-border-active", entry.isIntersecting);
    }, { rootMargin: "14% 0px", threshold: 0.04 });
    borderObserver.observe(wrap);
  } else if (!REDUCED) wrap.classList.add("scratch-border-active");

  const paintFoil = () => {
    foilW = wrap.clientWidth; foilH = wrap.clientHeight;
    const w = canvas.width = foilW * DPR;
    const h = canvas.height = foilH * DPR;
    const g = c.createLinearGradient(0, 0, w * 0.3, h);
    g.addColorStop(0, "#D9B45C"); g.addColorStop(0.35, "#B8923B");
    g.addColorStop(0.55, "#EBD292"); g.addColorStop(0.8, "#C09A40");
    g.addColorStop(1, "#A37F2E");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // speckle texture
    c.globalAlpha = 0.12;
    for (let i = 0, count = IS_TOUCH ? 320 : 600; i < count; i++) {
      c.fillStyle = Math.random() > 0.5 ? "#fff" : "#6b5215";
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    c.globalAlpha = 1;
    // ornament ring + text
    c.strokeStyle = "rgba(90,60,10,.55)";
    c.lineWidth = 2 * DPR;
    c.setLineDash([6 * DPR, 5 * DPR]);
    c.beginPath(); c.arc(w / 2, h / 2, Math.min(w, h) * 0.3, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);
    c.fillStyle = "rgba(74,15,34,.78)";
    c.font = `600 ${15 * DPR}px Cinzel, serif`;
    c.textAlign = "center";
    c.fillText("SCRATCH HERE", w / 2, h / 2 - 6 * DPR);
    c.font = `${24 * DPR}px serif`;
    c.fillText("🪙", w / 2, h / 2 + 26 * DPR);
    painted = true;
  };
  const prepareFoil = () => { if (!painted && !cleared) paintFoil(); };
  if ("IntersectionObserver" in window) {
    const foilObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      prepareFoil();
      foilObserver.disconnect();
    }, { rootMargin: "700px 0px" });
    foilObserver.observe(wrap);
  } else setTimeout(prepareFoil, 0);
  /* Repaint only on REAL size changes (rotation) — a repaint wipes scratch
     progress, and mobile URL-bar collapse fires tiny resizes constantly. */
  new ResizeObserver(() => {
    if (!painted || cleared || strokes > 0) return;   // never wipe scratch progress
    const dw = Math.abs(wrap.clientWidth - foilW), dh = Math.abs(wrap.clientHeight - foilH);
    if (dw < 24 && dh < 24) return;
    foilW = wrap.clientWidth; foilH = wrap.clientHeight;
    paintFoil();
  }).observe(wrap);

  /* Track the scratched area on a tiny logical grid. This avoids expensive
     full-canvas pixel readbacks while a finger is moving. */
  const GRID_W = 36, GRID_H = 48;
  const scratched = new Uint8Array(GRID_W * GRID_H);
  let scratchedCells = 0;
  const markScratched = (from, to) => {
    const ax = from ? from.x / canvas.width * GRID_W : to.x / canvas.width * GRID_W;
    const ay = from ? from.y / canvas.height * GRID_H : to.y / canvas.height * GRID_H;
    const bx = to.x / canvas.width * GRID_W;
    const by = to.y / canvas.height * GRID_H;
    const rx = Math.max(1, c.lineWidth * 0.5 / canvas.width * GRID_W);
    const ry = Math.max(1, c.lineWidth * 0.5 / canvas.height * GRID_H);
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / Math.max(1, Math.min(rx, ry) * .55)));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const gx = lerp(ax, bx, t), gy = lerp(ay, by, t);
      const x0 = Math.max(0, Math.floor(gx - rx)), x1 = Math.min(GRID_W - 1, Math.ceil(gx + rx));
      const y0 = Math.max(0, Math.floor(gy - ry)), y1 = Math.min(GRID_H - 1, Math.ceil(gy + ry));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = (x + .5 - gx) / rx, dy = (y + .5 - gy) / ry;
          const cell = y * GRID_W + x;
          if (dx * dx + dy * dy <= 1 && !scratched[cell]) {
            scratched[cell] = 1;
            scratchedCells++;
          }
        }
      }
    }
    return scratchedCells / scratched.length > .55;
  };

  let last = null, scratchRect = null, activePointer = null;
  const DBG = /[?&]tick/.test(location.search) ? (window.__scratchDbg = { calls: 0, drawn: 0, blocked: "" }) : null;
  const scratch = (e) => {
    if (DBG) DBG.calls++;
    if (cleared || !painted) { if (DBG) DBG.blocked = `cleared=${cleared} painted=${painted}`; return; }
    if (DBG) DBG.drawn++;
    const r = scratchRect || canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);
    c.globalCompositeOperation = "destination-out";
    c.lineWidth = 46 * DPR;
    c.lineCap = "round";
    c.beginPath();
    if (last) c.moveTo(last.x, last.y); else c.moveTo(x - 0.1, y);
    c.lineTo(x, y);
    c.stroke();
    c.globalCompositeOperation = "source-over";
    const enough = markScratched(last, { x, y });
    last = { x, y };
    audio.scratchNoise();
    if (++strokes % 4 === 0 && enough) reveal();
  };

  const reveal = () => {
    cleared = true;
    canvas.classList.add("cleared");
    wrap.classList.add("celebrate");
    // a small ceremony: three rising bells + petal fountain + shimmer flash
    audio.bell(520, 0.5, 2.6);
    setTimeout(() => audio.bell(660, 0.42, 2.4), 260);
    setTimeout(() => audio.bell(880, 0.36, 3.0), 540);
    if (navigator.vibrate) navigator.vibrate([30, 80, 30, 80, 60]);
    const r = wrap.getBoundingClientRect();
    petals.burst(r.left + r.width / 2, r.top + r.height / 3, IS_TOUCH ? 8 : 12);
    setTimeout(() => petals.burst(r.left + r.width / 2, r.top + r.height / 2, IS_TOUCH ? 5 : 8), 450);
    setTimeout(() => petals.burst(r.left + r.width / 2, r.top + r.height / 4, IS_TOUCH ? 4 : 6), 900);
  };

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    prepareFoil();
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    activePointer = e.pointerId;
    scratchRect = canvas.getBoundingClientRect();
    last = null;
    scratch(e);
  }, { passive: false });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId !== activePointer) return;
    e.preventDefault();
    const coalesced = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : null;
    const samples = coalesced?.length ? coalesced : [e];
    samples.forEach(scratch);
  }, { passive: false });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => canvas.addEventListener(eventName, () => {
    activePointer = null;
    last = null;
    scratchRect = null;
  }));
})();

/* ═══════════════ SANCTUM — scroll-unlocked hidden film ═══ */
const sanctum = (() => {
  const sec = $("#sanctum");
  if (!sec) return { tick: () => {}, resize: () => {} };
  const S = CFG.sanctum;
  $("#sanctum-eyebrow").textContent = S.eyebrow;
  $("#sanctum-heading").textContent = S.heading;
  $("#sanctum-hint").textContent = S.hint;
  $("#sanctum-veil-text").textContent = S.veilText;
  const canvas = $("#sanctum-canvas"), c = canvas.getContext("2d", { alpha: false });
  const progressEl = $("#sanctum-progress"), veilText = $("#sanctum-veil-text");
  const imgs = new Array(S.count);
  const imgState = new Uint8Array(S.count);
  const gateCount = Math.min(SAVE_DATA ? 6 : IS_TOUCH ? 10 : 16, S.count);
  const loadLimit = SAVE_DATA ? 2 : IS_TOUCH ? 3 : 5;
  const ahead = SAVE_DATA ? 8 : IS_TOUCH ? 14 : 20;
  const behind = IS_TOUCH ? 6 : 10;
  const keepAhead = ahead + 4;
  const keepBehind = behind + 4;
  const name = (i) => S.path + S.prefix + String(i + 1).padStart(3, "0") + S.ext;
  let state = "locked";            // locked → loading → unlocked
  let inView = false, cur = 0, target = 0, drawn = "", activeLoads = 0;
  let scrollStart = 0, scrollDistance = 1, loadCenter = -1, progressFrame = -1;

  const measureScrollRange = (rect = null) => {
    const r = rect || sec.getBoundingClientRect();
    scrollStart = window.scrollY + r.top;
    scrollDistance = Math.max(r.height - vhPx * 100, 1);
  };

  const evict = () => {
    if (state !== "unlocked") return;
    const center = Math.round(target);
    const retainAhead = inView ? keepAhead : 3;
    const retainBehind = inView ? keepBehind : 3;
    for (let i = 0; i < S.count; i++) {
      if (imgState[i] === 2 && (i < center - retainBehind || i > center + retainAhead)) {
        imgs[i].onload = imgs[i].onerror = null;
        imgs[i].src = "";
        imgs[i] = null;
        imgState[i] = 0;
      }
    }
  };

  const loadFrame = (i, done) => {
    if (i < 0 || i >= S.count || imgState[i] !== 0) return false;
    imgState[i] = 1;
    activeLoads++;
    const img = new Image();
    img.decoding = "async";
    img._scrubKey = `sanctum-${i}`;
    if (state === "unlocked") {
      const distance = Math.abs(i - Math.round(target));
      img.fetchPriority = distance <= 2 ? "high" : distance <= ahead ? "auto" : "low";
    }
    imgs[i] = img;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      imgState[i] = img.naturalWidth ? 2 : 3;
      activeLoads--;
      evict();
      if (done) done();
    };
    const timeout = setTimeout(() => { img.src = ""; settle(); }, 9000);
    img.onload = () => {
      if (typeof img.decode === "function") img.decode().then(settle, settle);
      else settle();
    };
    img.onerror = settle;
    img.src = name(i);
    return true;
  };

  const pumpWindow = () => {
    if (state !== "unlocked" || !inView) return;
    const center = clamp(Math.round(target), 0, S.count - 1);
    while (activeLoads < loadLimit) {
      let idx = -1;
      for (let d = 0; d <= ahead; d++) {
        const i = center + d;
        if (i < S.count && imgState[i] === 0) { idx = i; break; }
      }
      if (idx < 0) {
        for (let d = 1; d <= behind; d++) {
          const i = center - d;
          if (i >= 0 && imgState[i] === 0) { idx = i; break; }
        }
      }
      if (idx < 0 || !loadFrame(idx, pumpWindow)) return;
    }
  };

  new IntersectionObserver((es) => {
    es.forEach((e) => {
      inView = e.isIntersecting;
      if (e.isIntersecting) {
        measureScrollRange(e.boundingClientRect);
        if (state === "locked") load();   // everyone gets the moment
        else if (state === "unlocked") { loadCenter = -1; pumpWindow(); }
      } else if (state === "unlocked") evict();
    });
  }, { rootMargin: SAVE_DATA ? "240px 0px" : IS_TOUCH ? "520px 0px" : "700px 0px" }).observe(sec);

  const load = () => {
    state = "loading";
    sec.classList.add("loading");
    veilText.textContent = "Unfolding…";
    progressEl.classList.remove("hidden");
    let done = 0, next = 0;
    const pump = () => {
      while (activeLoads < loadLimit && next < gateCount) {
        const i = next++;
        loadFrame(i, () => {
          done++;
          progressEl.textContent = Math.round(done / gateCount * 100) + "%";
          if (done === gateCount) unlock();
          else pump();
        });
      }
    };
    pump();
  };

  const resize = () => {
    measureScrollRange();
    const r = canvas.getBoundingClientRect();
    if (r.width < 2) return;
    const nextWidth = Math.round(r.width * DPR);
    const nextHeight = Math.round(r.height * DPR);
    if (canvas.width === nextWidth && canvas.height === nextHeight) return;
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    drawn = "";
  };

  const pickFrame = (i) => {
    let img = imgState[i] === 2 ? imgs[i] : null;
    if (!img) {
      for (let d = 1; d < S.count; d++) {
        const a = i + d, b = i - d;
        if (a < S.count && imgState[a] === 2) { img = imgs[a]; break; }
        if (b >= 0 && imgState[b] === 2) { img = imgs[b]; break; }
      }
    }
    return img;
  };

  const draw = (img) => {
    if (!img || !img.naturalWidth) return false;
    if (canvas.width < 2) resize();
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    c.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    return true;
  };

  const unlock = () => {
    state = "unlocked";
    resize();
    const first = pickFrame(0);
    if (draw(first)) drawn = first._scrubKey;
    if (inView) pumpWindow();
    else evict();
    sec.classList.remove("loading");
    sec.classList.add("unlocked");
    audio.bell(560, 0.5, 3.4);
    if (navigator.vibrate) navigator.vibrate([20, 60, 30]);
    setTimeout(() => {
      const r = sec.querySelector("#sanctum-portal").getBoundingClientRect();
      petals.burst(r.left + r.width / 2, r.top + r.height / 3, IS_TOUCH ? 8 : 12);
    }, 920);
  };

  const tick = (dt) => {
    if (state !== "unlocked" || !inView) return;
    const p = clamp((window.scrollY - scrollStart) / scrollDistance, 0, 1);
    target = p * (S.count - 1);
    const gap = Math.abs(target - cur);
    const response = IS_TOUCH ? (gap > 8 ? 16 : 11) : (gap > 8 ? 12 : 8);
    cur = lerp(cur, target, 1 - Math.exp(-dt * response));
    const i = Math.round(cur);
    const nextLoadCenter = Math.round(target);
    if (nextLoadCenter !== loadCenter) {
      loadCenter = nextLoadCenter;
      pumpWindow();
      evict();
    }
    const img = pickFrame(i);
    const key = img?._scrubKey || "";
    if (img && key !== drawn && draw(img)) drawn = key;
    if (i !== progressFrame) {
      progressFrame = i;
      fillEl.style.transform = `scaleX(${(i / (S.count - 1)).toFixed(3)})`;
    }
  };
  const fillEl = $("#sanctum-fill");

  return {
    tick,
    resize: () => { if (state === "unlocked") resize(); else if (inView) measureScrollRange(); },
  };
})();

/* ═══════════════ DECOR REVEAL — no per-frame parallax ════ */
(() => {
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      e.target.classList.toggle("shown", e.isIntersecting);
    });
  }, { threshold: 0.04 });
  document.querySelectorAll(".decor, .foot-diya").forEach((el) => io.observe(el));
})();

/* ═══════════════ VENUE DETAILS ═══════════════════════════ */
(() => {
  const venueName = $("#venue-name");
  const venueAddress = $("#venue-address");
  const mapsButton = $("#maps-btn");
  if (venueName) venueName.textContent = CFG.venue.name;
  if (venueAddress) venueAddress.textContent = CFG.venue.address;
  const mapsHref = CFG.venue.mapsUrl || ("https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(CFG.venue.mapsQuery));
  if (mapsButton) mapsButton.href = mapsHref;
  const mapLink = $("#map-link");
  if (mapLink) mapLink.href = mapsHref;
  const rsvpDeadline = $("#rsvp-deadline");
  if (rsvpDeadline && CFG.rsvp) rsvpDeadline.textContent = CFG.rsvp.deadline;

  // Submission and confirmation are handled by rsvp.js, never browser storage.
})();

/* ═══════════════ FILM BANDS — lazy cinematic loops ═══════ */
const finale = (() => {
  const el = document.getElementById("finale");
  let done = false;
  const reveal = () => {
    if (done || !el) return;
    done = true;
    el.classList.add("shown");
    audio.chime();
  };
  let tick = () => {};
  if (el && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { reveal(); io.disconnect(); }
    }, { rootMargin: "0px 0px -22% 0px", threshold: 0.01 });
    io.observe(el);
  } else if (el) {
    tick = () => { if (el.getBoundingClientRect().top < innerHeight * 0.78) reveal(); };
  }
  return { tick };
})();

/* The invitation and 3D world stay as separate routes. This transition starts
   the heavier world only after a deliberate tap, then releases this page. */
(() => {
  const link = $("#world-portal-link"), overlay = $("#portal-transition");
  if (!link || !overlay) return;
  const isPrimaryActivation = (e) => !e.defaultPrevented && e.button === 0
    && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  const rememberAudioIntent = () => {
    try {
      const intent = audio.isMuted() ? "muted" : "play";
      sessionStorage.setItem("wedding-world-audio-intent", intent);
      // The world starts its own score from the beginning; never carry this
      // page's media time into the 3D scene.
      sessionStorage.removeItem("wedding-world-audio-state");
    } catch { /* private modes may restrict storage; the world still opens directly */ }
  };
  let leaving = false, navTimer = 0;
  const reset = () => {
    const shouldRestore = leaving || document.body.classList.contains("portal-opening");
    leaving = false;
    clearTimeout(navTimer);
    document.body.classList.remove("portal-opening");
    document.body.removeAttribute("aria-busy");
    link.removeAttribute("aria-disabled");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.removeProperty("--portal-x");
    overlay.style.removeProperty("--portal-y");
    if (shouldRestore) audio.restoreAfterWorld();
  };
  addEventListener("pagehide", () => { if (leaving) audio.pauseForWorld(); });
  addEventListener("pageshow", reset);

  if (REDUCED) {
    link.addEventListener("click", (e) => {
      if (!isPrimaryActivation(e)) return;
      leaving = true;
      rememberAudioIntent();
      audio.pauseForWorld();
    });
    return;
  }

  link.addEventListener("click", (e) => {
    if (!isPrimaryActivation(e)) return;
    e.preventDefault();
    if (leaving) return;
    leaving = true;
    rememberAudioIntent();

    const visual = link.querySelector(".world-portal-visual");
    const r = (visual || link).getBoundingClientRect();
    overlay.style.setProperty("--portal-x", `${r.left + r.width / 2}px`);
    overlay.style.setProperty("--portal-y", `${r.top + r.height / 2}px`);
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("portal-opening");
    document.body.setAttribute("aria-busy", "true");
    link.setAttribute("aria-disabled", "true");

    audio.bell(540, 0.22, 1.3);
    audio.whoosh(0.9);
    audio.fadeForWorld(360);
    document.querySelectorAll("video").forEach((video) => video.pause());

    navTimer = setTimeout(() => {
      // Safari may keep a page alive briefly during same-tab navigation.
      // Stop the invitation score synchronously before the world takes over.
      audio.pauseForWorld();
      try { location.assign(link.href); }
      catch { location.href = link.href; }
    }, 820);
  });
})();

const films = (() => {
  const vids = [...document.querySelectorAll(".film-band video")];
  const visible = new Set();
  const timers = new WeakMap();
  const pauseAll = () => vids.forEach((v) => { if (!v.paused) v.pause(); });
  const wake = (v) => {
    if (!v.poster && v.dataset.poster) v.poster = v.dataset.poster;
    if (!v.src && v.dataset.src) v.src = v.dataset.src;
    if (v.paused) v.play().catch(() => {});
  };
  let tick = () => {};
  if ("IntersectionObserver" in window) {
    const posterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const v = entry.target;
        if (!v.poster && v.dataset.poster) v.poster = v.dataset.poster;
        posterObserver.unobserve(v);
      });
    }, { rootMargin: "600px 0px" });
    const playObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const v = entry.target;
        clearTimeout(timers.get(v));
        if (entry.isIntersecting) {
          visible.add(v);
          const timer = setTimeout(() => {
            if (visible.has(v) && !document.hidden) wake(v);
          }, IS_TOUCH ? 160 : 0);
          timers.set(v, timer);
        } else {
          visible.delete(v);
          if (!v.paused) v.pause();
        }
      });
    }, { rootMargin: IS_TOUCH ? "40px 0px" : "140px 0px", threshold: 0.01 });
    vids.forEach((v) => { posterObserver.observe(v); playObserver.observe(v); });
  } else {
    let acc = 0;
    tick = (dt) => {
      acc += dt;
      if (acc < 0.5 || !vids.length) return;
      acc = 0;
      vids.forEach((v) => {
        const r = v.getBoundingClientRect();
        const near = r.bottom > -100 && r.top < innerHeight + 100;
        if (near) wake(v);
        else if (!v.paused) v.pause();
      });
    };
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseAll();
    else visible.forEach(wake);
  });
  addEventListener("pagehide", pauseAll);
  return { tick };
})();

/* ═══════════════ SOUND TOGGLE ════════════════════════════ */
(() => {
  const b = $("#sound-toggle");
  if (audio.isMuted()) b.classList.add("muted");
  b.addEventListener("click", () => {
    if (!audio.hasBgm()) {
      audio.init();
      if (audio.isMuted()) b.classList.toggle("muted", audio.toggleMute());
      audio.startBgm();
      if (!audio.isMuted()) audio.chime();
      return;
    }
    audio.init();
    b.classList.toggle("muted", audio.toggleMute());
    if (!audio.isMuted()) audio.chime();
  });
})();

/* ═══════════════ FINISHING TOUCHES ═══════════════════════ */
(() => {
  /* Names → letter spans for the cascade entrance */
  const names = $(".names");
  if (names) {
    names.setAttribute("aria-label", names.textContent.trim());
    let li = 0;
    const split = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const ch of n.textContent) {
            if (ch.trim() === "") { frag.appendChild(document.createTextNode(ch)); continue; }
            const s = document.createElement("span");
            s.className = "ltr";
            s.style.setProperty("--li", li++);
            s.textContent = ch;
            s.setAttribute("aria-hidden", "true");
            frag.appendChild(s);
          }
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          n.classList.add("ltr");
          n.style.setProperty("--li", li++);
          n.setAttribute("aria-hidden", "true");
        }
      });
    };
    split(names);
  }

  /* Self-drawing flourish under every section title */
  const FLOURISH = `<svg class="flourish" viewBox="0 0 150 26" aria-hidden="true">
    <path d="M5 13 C 30 13, 40 4, 62 12"/><path d="M145 13 C 120 13, 110 22, 88 14"/>
    <circle cx="75" cy="13" r="7.5"/>
    <rect class="gem" x="71" y="9" width="8" height="8"/>
  </svg>`;
  document.querySelectorAll(".sec-head").forEach((h) => {
    h.insertAdjacentHTML("beforeend", FLOURISH);
  });
  const headIO = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("shown"); headIO.unobserve(e.target); } });
  }, { threshold: 0.5 });
  document.querySelectorAll(".sec-head").forEach((h) => headIO.observe(h));

  /* One quiet entrance per major glass surface. Nothing follows the scroll
     frame-by-frame: once visible, each observer releases its element. */
  const revealItems = document.querySelectorAll(
    ".countdown-card, .film-band, #scratch-wrap, .venue-card, .rsvp-block"
  );
  revealItems.forEach((el) => el.classList.add("soft-reveal"));
  if (REDUCED || !("IntersectionObserver" in window)) {
    revealItems.forEach((el) => el.classList.add("revealed"));
  } else {
    const revealIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("revealed");
        revealIO.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.12 });
    revealItems.forEach((el) => revealIO.observe(el));
  }

  /* Tap sparkle — a pinch of petals wherever a finger lands */
  let lastSpark = 0;
  document.addEventListener("pointerdown", (e) => {
    const t = performance.now();
    if (t - lastSpark < 450 || REDUCED) return;
    lastSpark = t;
    petals.burst(e.clientX, e.clientY, IS_TOUCH ? 1 : 2);
  }, { passive: true });
})();

/* ═══════════════ MANDALA (loader SVG petals) ═════════════ */
(() => {
  const ring = $("#petal-ring");
  const NS = "http://www.w3.org/2000/svg";
  for (let i = 0; i < 24; i++) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", "M0,-88 C6,-76 6,-66 0,-58 C-6,-66 -6,-76 0,-88 Z");
    p.setAttribute("fill", i % 2 ? "rgba(201,162,75,.5)" : "none");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", ".7");
    p.setAttribute("transform", `rotate(${i * 15})`);
    ring.appendChild(p);
  }
})();

/* ═══════════════ MAIN LOOP + FPS GUARD ═══════════════════ */
const threadEl = $("#thread");
const doc = document.documentElement;
let pageScrollRange = Math.max(doc.scrollHeight - vhPx * 100, 1);
const refreshScrollRange = () => { pageScrollRange = Math.max(doc.scrollHeight - vhPx * 100, 1); };
const refreshPageMetrics = () => {
  refreshScrollRange();
  sanctum.resize();
};
if ("ResizeObserver" in window) new ResizeObserver(refreshPageMetrics).observe(document.body);
addEventListener("load", refreshPageMetrics, { once: true });
let lastT = performance.now(), fpsAcc = 0, fpsN = 0, degraded = false, lastSp = -1;
const mainLoop = (t) => {
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;
  const vel = scrub.tick(dt) || 0;
  petals.addGust(Math.min(vel * 0.004, 0.4));
  if (vel > 7) audio.whoosh(Math.min(vel / 26, 1));   // airy gust on brisk scrolls
  petals.step(dt);
  sanctum.tick(dt);
  films.tick(dt);
  finale.tick();
  // golden scroll thread
  const sp = clamp(scrollY / pageScrollRange, 0, 1);
  if (Math.abs(sp - lastSp) > 0.0004) {
    threadEl.style.setProperty("--sp", sp.toFixed(4));
    lastSp = sp;
  }
  // fps monitor
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 2 && !degraded) {
    if (fpsN / fpsAcc < 44) { degraded = true; petals.setLowPerf(); }
    fpsAcc = 0; fpsN = 0;
  }
  RAF(mainLoop);
};

/* ═══════════════ BOOT — the seal opens ═══════════════════ */
(() => {
  const loader = $("#loader"), sealBtn = $("#seal-btn");
  const pctEl = $("#loader-pct"), copyEl = $("#loader-copy");
  const statusEl = $("#loader-status"), tapEl = $("#loader-tap");
  const retryEl = $("#loader-retry");
  const ring = $("#progress-ring");
  const CIRC = 414.7;

  scrub.resize();
  petals.resize();

  if (REDUCED) {
    // Reduced motion: static invitation, no film scrub, no petals
    loader.classList.add("gone");
    document.body.classList.remove("is-loading");
    $("#hero").classList.add("entered");
    $("#hero").style.height = "calc(var(--vh) * 100)";
    const img = new Image();
    img.onload = () => { frames.prime(0, img); scrub.firstPaint(); };
    img.src = CFG.frames.loPath + CFG.frames.prefix + "001" + CFG.frames.ext;
    $("#sound-toggle").classList.remove("hidden");
    return;
  }

  const ringPetals = [...document.querySelectorAll("#petal-ring path")];
  ringPetals.forEach((p) => { p.style.opacity = .18; p.style.transition = "opacity .6s ease"; });
  const slowNotice = setTimeout(() => {
    copyEl.textContent = "Smoothing every frame…";
  }, 12000);
  retryEl.addEventListener("click", () => location.reload(), { once: true });
  frames.preloadLo((f) => {
    pctEl.textContent = Math.round(f * 100) + "%";
    ring.style.strokeDashoffset = CIRC * (1 - f);
    // the mandala blooms petal by petal as the world loads
    const lit = Math.round(f * ringPetals.length);
    for (let k = 0; k < lit; k++) ringPetals[k].style.opacity = 1;
  }).then(() => {
    clearTimeout(slowNotice);
    try { scrub.firstPaint(); } catch { /* paint must never block entry */ }
    statusEl.classList.add("hidden");
    tapEl.classList.remove("hidden");
    sealBtn.disabled = false;
    // Use the natural pause before the seal tap to decode the opening runway.
    // The queue remains bounded, so this adds readiness rather than a bulk preload.
    if (!SAVE_DATA) frames.startLo();
  }).catch(() => {
    clearTimeout(slowNotice);
    copyEl.textContent = "Preparation paused";
    pctEl.textContent = "";
    retryEl.classList.remove("hidden");
  });

  sealBtn.addEventListener("click", () => {
    audio.init();
    audio.bell(432, 0.55, 4);                // the seal breaks with a temple bell
    setTimeout(() => audio.bell(648, 0.3, 3), 350);
    audio.whoosh(1);                         // doors part with a breath of air
    audio.startBgm();                        // the score begins inside the tap gesture
    loader.classList.add("open");
    $("#hero").classList.add("entered");     // names cascade in as the doors part
    frames.startLo();
    setTimeout(() => {
      loader.classList.add("gone");
      document.body.classList.remove("is-loading");
      $("#sound-toggle").classList.remove("hidden");
      $("#thread").classList.add("on");
      lastT = performance.now();
      RAF(mainLoop);
      frames.startHi();
      // Let the opening frame runway and soundtrack settle before ambient petals begin.
      setTimeout(() => petals.start(), IS_TOUCH ? 3500 : 2500);
    }, 1500);
  }, { once: true });
})();

})();
