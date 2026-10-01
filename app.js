/* A photo-led invitation: no render loop, video decoding or world preload. */
(() => {
  'use strict';
  const config = window.WEDDING_CONFIG;
  if (!config) return;

  function renderEvents() {
    const groups = [document.querySelector('#events-day-one'), document.querySelector('#events-day-two')];
    const fragmentByDay = [document.createDocumentFragment(), document.createDocumentFragment()];
    for (const event of config.events) {
      const item = document.createElement('article');
      item.className = 'event';
      item.id = event.id;
      const top = document.createElement('div');
      top.className = 'event-top';
      const heading = document.createElement('h4');
      heading.textContent = event.name;
      const time = document.createElement('time');
      time.dateTime = event.timeISO;
      time.textContent = event.time;
      top.append(heading, time);
      const line = document.createElement('p');
      line.textContent = event.line;
      item.append(top, line);
      const attire = config.dressCodes[event.dressCode];
      if (attire) {
        const note = document.createElement('p');
        note.className = 'event-attire';
        const palette = document.createElement('span');
        palette.className = 'attire-swatches';
        palette.setAttribute('aria-hidden', 'true');
        attire.colors.forEach(color => {
          const swatch = document.createElement('i');
          swatch.style.setProperty('--swatch', color);
          palette.append(swatch);
        });
        const label = document.createElement('b');
        label.textContent = attire.theme;
        note.append(palette, label);
        item.append(note);
      }
      fragmentByDay[event.day - 1].append(item);
    }
    groups.forEach((group, index) => group?.replaceChildren(fragmentByDay[index]));
  }
  renderEvents();

  const deadline = new Date(config.wedding.dateISO).getTime();
  const clock = ['cd-d', 'cd-h', 'cd-m', 'cd-s'].map(id => document.getElementById(id));
  function tick() {
    const seconds = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
    const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
    clock.forEach((element, index) => {
      const value = String(values[index]).padStart(2, '0');
      if (element && element.textContent !== value) element.textContent = value;
    });
  }
  tick();
  let clockTimer = window.setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => {
    window.clearInterval(clockTimer);
    if (!document.hidden) { tick(); clockTimer = window.setInterval(tick, 1000); }
  });

  // Each photograph unfolds once as the guest reaches it; nothing tracks scroll.
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });
    document.querySelectorAll('.photo-reveal').forEach(photo => observer.observe(photo));
  }

  const audio = document.querySelector('#bgm');
  const button = document.querySelector('#sound-toggle');
  const label = document.querySelector('#sound-label');
  const status = document.querySelector('#music-status');
  if (!audio || !button) return;
  const preferenceKey = 'vt-photo-invite-music-muted';
  let muted = false;
  let starting = false;
  let pausedForBackground = false;
  try { muted = localStorage.getItem(preferenceKey) === 'true'; } catch {}
  audio.volume = .45;

  function updateMusic() {
    const playing = !audio.paused && !muted;
    button.setAttribute('aria-pressed', String(playing));
    button.setAttribute('aria-label', playing ? 'Pause background music' : 'Play background music');
    label.textContent = playing ? 'Music on' : 'Play music';
  }
  function savePreference() {
    try { localStorage.setItem(preferenceKey, String(muted)); } catch {}
  }
  async function startMusic() {
    if (muted || starting || !audio.paused || document.hidden) return;
    starting = true;
    try {
      await audio.play();
      if (muted) audio.pause();
      status.textContent = '';
    } catch {
      status.textContent = 'Tap Play music to start the background soundtrack.';
    } finally { starting = false; updateMusic(); }
  }
  button.addEventListener('click', () => {
    if (!audio.paused || starting) {
      muted = true;
      audio.pause();
    } else {
      muted = false;
      startMusic();
    }
    savePreference();
    updateMusic();
  });
  function unlockOnGesture(event) {
    if (event.target.closest('#sound-toggle')) return;
    if (!muted) startMusic();
  }
  // Mobile requires play() inside a real gesture; no delayed audio handoff.
  document.addEventListener('pointerdown', unlockOnGesture, { passive: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') unlockOnGesture(event);
  });
  audio.addEventListener('play', updateMusic);
  audio.addEventListener('pause', updateMusic);
  audio.addEventListener('error', () => {
    updateMusic();
    label.textContent = 'Retry music';
    status.textContent = 'The soundtrack could not load. Check your connection and tap Retry music.';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pausedForBackground = !audio.paused;
      audio.pause();
    } else if (pausedForBackground && !muted) {
      pausedForBackground = false;
      startMusic();
    }
  });
  window.addEventListener('pagehide', () => audio.pause());
  updateMusic();
})();
