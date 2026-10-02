/* The original animated invitation, now framed around personal photographs. */
(() => {
"use strict";
const CFG = window.WEDDING_CONFIG;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const IS_TOUCH = matchMedia("(pointer: coarse)").matches;
const $ = s => document.querySelector(s);
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
let entered = false;
$("#invitation-content").inert = true;
$("#finale").inert = true;
let vh = innerHeight;
document.documentElement.style.setProperty("--vh", vh / 100 + "px");

/* Play the existing piano score inside the guest's tap, with quiet ceremony chimes. */
const audio = (() => {
 const bgm = $("#bgm"), button = $("#sound-toggle"), status = $("#music-status");
 let muted = false, starting = false, context = null, resumeAfterBackground = false;
 try { muted = localStorage.getItem("vt-photo-invite-music-muted") === "true"; } catch {}
 bgm.volume = .38;
 const sync = () => {
  const playing = !bgm.paused && !muted;
  button.classList.toggle("muted", !playing);
  button.setAttribute("aria-pressed", String(playing));
  button.setAttribute("aria-label", playing ? "Pause background music" : "Play background music");
 };
 const init = () => {
  if (muted) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (AudioContext && !context) context = new AudioContext();
  if (context?.state === "suspended") context.resume().catch(() => {});
 };
 const start = () => {
  if (muted || starting || !bgm.paused || document.hidden) return;
  init(); starting = true;
  bgm.play().then(() => { if (muted) bgm.pause(); status.textContent = ""; })
   .catch(() => { status.textContent = "Tap the music bell to start the soundtrack."; })
   .finally(() => { starting = false; sync(); });
 };
 const bell = (base = 432, volume = .13, duration = 2) => {
  if (!context || muted || context.state !== "running" || document.hidden) return;
  const time = context.currentTime;
  [[1,1],[2.74,.3],[5.4,.1]].forEach(([ratio, weight]) => {
   const oscillator = context.createOscillator(), gain = context.createGain();
   oscillator.type = "sine"; oscillator.frequency.value = base * ratio;
   gain.gain.setValueAtTime(.0001, time);
   gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume * weight * .2), time + .015);
   gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
   oscillator.connect(gain).connect(context.destination);
   oscillator.start(time); oscillator.stop(time + duration + .02);
   oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
 };
 button.addEventListener("click", () => {
  if (!bgm.paused || starting) { muted = true; bgm.pause(); }
  else { muted = false; start(); bell(864,.09,1.3); }
  try { localStorage.setItem("vt-photo-invite-music-muted",String(muted)); } catch {}
  sync();
 });
 document.addEventListener("pointerdown", event => {
  if (entered && !event.target.closest("#sound-toggle") && !muted) start();
 }, {passive:true});
 document.addEventListener("keydown", event => {
  if (entered && (event.key === "Enter" || event.key === " ") && !event.target.closest("#sound-toggle")) start();
 });
 document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
   resumeAfterBackground = !bgm.paused;
   bgm.pause(); context?.suspend().catch(() => {});
  } else if (resumeAfterBackground && !muted) { resumeAfterBackground = false; start(); }
 });
 window.addEventListener("pagehide", () => { bgm.pause(); context?.suspend().catch(() => {}); });
 bgm.addEventListener("play",sync); bgm.addEventListener("pause",sync);
 bgm.addEventListener("error", () => { sync(); status.textContent = "The soundtrack could not load. Please tap the music bell to retry."; });
 sync();
 return {start, bell, chime: () => bell(864,.07,1.4)};
})();

/* Small composited petals: no full-screen canvas or perpetual JS frame loop. */
const petals = (() => {
 const layer = $("#petals");
 let running = false;
 const makePetal = className => {
  const petal = document.createElement("i");
  petal.className = className;
  return petal;
 };
 return {
  start() {
   if (running || REDUCED) return;
   running = true;
   const count = IS_TOUCH ? 3 : 5;
   for (let i = 0; i < count; i++) {
    const petal = makePetal("ambient-petal");
    petal.style.left = `${12 + i * 76 / Math.max(count - 1,1)}%`;
    petal.style.setProperty("--drift", `${i % 2 ? -32 : 32}px`);
    petal.style.setProperty("--duration", `${18 + i * 3}s`);
    petal.style.setProperty("--delay", `${-i * 4}s`);
    layer.appendChild(petal);
   }
  },
  burst(x,y,n = 1) {
   if (!running || REDUCED || document.hidden) return;
   for (let i = 0; i < Math.min(n,2); i++) {
    if (layer.querySelectorAll(".tap-petal").length >= 4) break;
    const petal = makePetal("tap-petal");
    petal.style.left = x + "px";
    petal.style.top = y + "px";
    petal.style.setProperty("--drift", `${i ? 32 : -24}px`);
    petal.addEventListener("animationend", () => petal.remove(), {once:true});
    layer.appendChild(petal);
   }
  }
 };
})();

/* Scrolling only updates the narrow progress thread, never the portrait.
   Geometry is cached on resize; there are no layout reads during scrolling. */
const hero = $("#hero"), heroPhoto = $(".hero-photo");
const thread = $("#thread");
let pageRange = 1, scrollQueued = false;
const measure = () => {
 pageRange = Math.max(1,document.documentElement.scrollHeight-vh);
 updateScroll();
};
function updateScroll() {
 scrollQueued = false;
 if (!entered) return;
 thread.style.setProperty("--sp",clamp(scrollY/pageRange,0,1).toFixed(4));
}
window.addEventListener("scroll", () => {
 if (scrollQueued || !entered) return;
 scrollQueued = true;
 requestAnimationFrame(updateScroll);
}, {passive:true});
let lastWidth = innerWidth, resizeTimer;
addEventListener("resize", () => {
 if (IS_TOUCH && innerWidth === lastWidth) return;
 lastWidth = innerWidth;
 clearTimeout(resizeTimer);
 resizeTimer = setTimeout(() => {
  vh = innerHeight; document.documentElement.style.setProperty("--vh",vh/100+"px");
  measure();
 },120);
});
if ("ResizeObserver" in window) new ResizeObserver(measure).observe(document.body);
addEventListener("load",measure,{once:true});

/* Countdown remains its own animated glass keepsake. */
const deadline = new Date(CFG.wedding.dateISO).getTime();
const clock = ["cd-d","cd-h","cd-m","cd-s"].map(id => document.getElementById(id));
function tickClock() {
 const seconds = Math.max(0,Math.floor((deadline-Date.now())/1000));
 const values = [Math.floor(seconds/86400),Math.floor(seconds/3600)%24,Math.floor(seconds/60)%60,seconds%60];
 clock.forEach((el,i) => {
  const value = String(values[i]).padStart(2,"0");
  if (el.textContent !== value) el.textContent = value;
 });
}
tickClock();
let clockTimer = setInterval(tickClock,1000);
document.addEventListener("visibilitychange", () => {
 clearInterval(clockTimer);
 if (!document.hidden) { tickClock(); clockTimer = setInterval(tickClock,1000); }
});

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
    card.id = ev.id;
    card.style.setProperty("--accent", ev.id === "sangeet" ? "#9D3B70" : "#B23766");
    card.innerHTML = `
      <div class="event-summary">
        <span class="event-ico" aria-hidden="true">${ICONS[ev.id] || ICONS.reception}</span>
        <h3 class="event-name">${ev.name}</h3>
        <p class="event-line">${ev.line}</p>
        <p class="event-meta"><b>${ev.day === 1 ? "Wednesday, 25 November 2026" : "Thursday, 26 November 2026"}</b> · ${ev.time}<br>${CFG.venue.name}</p>
      </div>
      ${attire ? `<div class="event-attire">
        <span class="dress-swatches attire-swatches ${ev.dressCode === "pink" ? "pink-swatches" : ev.dressCode === "glitter" ? "evening-swatches" : "soft-swatches"}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <dl><dt>Dress code</dt><dd>${attire.theme}${attire.colorNames ? `<span class="attire-colors">${attire.colorNames}</span>` : ""}</dd></dl>
      </div>` : ""}`;
    wrap.appendChild(card);
  });

  let chimed = 0;
  const show = (el, stagger) => setTimeout(() => {
    el.classList.add("shown");
    if (chimed++ < 4 && !REDUCED) audio.chime();
  }, REDUCED ? 0 : 80 * stagger);
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
    ".countdown-card, .film-band, .venue-card, .rsvp-surface, .guest-welcome, .story-prose"
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
    p.setAttribute("fill", i % 2 ? "rgba(200,81,131,.3)" : "none");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", ".7");
    p.setAttribute("transform", `rotate(${i * 15})`);
    ring.appendChild(p);
  }
})();



/* Pause decorative loops offscreen, and release one-shot reveal observers. */
const finale = $("#finale");
const motionObserver = new IntersectionObserver(entries => {
 entries.forEach(({target,isIntersecting}) => {
  target.classList.toggle("motion-active",isIntersecting);
  if (target === finale && isIntersecting) target.classList.add("shown");
 });
},{threshold:.05});
motionObserver.observe(finale);
document.addEventListener("visibilitychange", () => {
 document.body.classList.toggle("page-paused",document.hidden);
});

/* Original mandala seal and opening doors; just the first photo is prepared. */
const loader = $("#loader"), seal = $("#seal-btn"), tap = $("#loader-tap");
const ring = $("#progress-ring"), status = $("#loader-status");
let opened = false;
function openInvitation(playMusic) {
 if (opened) return;
 opened = true; entered = true;
 if (playMusic) { audio.start(); audio.bell(); }
 hero.classList.add("entered");
 loader.classList.add("open");
 seal.disabled = true;
 setTimeout(() => {
  loader.classList.add("gone");
  loader.setAttribute("aria-hidden", "true");
  document.body.classList.remove("is-loading");
  $("#invitation-content").inert = false;
  $("#finale").inert = false;
  $("#sound-toggle").classList.remove("hidden");
  thread.classList.add("on");
  hero.classList.add("portrait-ready");
  measure();
  if (!REDUCED) {
   petals.start();
  }
  $("#hero-title")?.focus({preventScroll:true});
 }, REDUCED ? 0 : 1450);
}
function ready() {
 status.classList.add("hidden");
 tap.classList.remove("hidden");
 seal.disabled = false;
 if (!REDUCED && !opened) seal.focus({preventScroll:true});
 ring.style.strokeDashoffset = "0";
 document.querySelectorAll("#petal-ring path").forEach(el => el.style.opacity = "1");
}
let readyTimer = setTimeout(ready,6000);
Promise.resolve(heroPhoto.decode?.()).catch(() => {}).finally(() => { clearTimeout(readyTimer); ready(); });
seal.addEventListener("click",()=>openInvitation(true),{once:true});
$("#loader-retry").addEventListener("click",()=>location.reload());
if (REDUCED) openInvitation(false);
measure();
})();
