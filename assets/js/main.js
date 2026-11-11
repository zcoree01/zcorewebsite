/* ==========================================================================
   Zcore Production — interakcije i animacije
   ========================================================================== */

/* ---------- PODEŠAVANJA: upišite prije objave ---------- */
const CONFIG = {
  // E-pošta za kontakt (prikazuje se na stranici i koristi se kad obrazac nije povezan).
  contactEmail: 'kontakt@zcore.ba',
  // Adresa servisa za obrasce (npr. Formspree: 'https://formspree.io/f/xxxxxxx').
  // Ako je prazno, obrazac otvara e-poštu korisnika s popunjenom porukom.
  formEndpoint: '',
};

(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Animacije su iste za sve. Windows s opcijom "Adjust for best performance" javlja
  // prefers-reduced-motion, pa bi se inače na starijim računarima sve ugasilo.
  const reduceMotion = false;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // Slabiji uređaj: malo jezgri/memorije ili sistem traži manje efekata → gasimo samo skupe ukrase
  const lite = (navigator.hardwareConcurrency || 8) <= 4 ||
    (navigator.deviceMemory || 8) <= 4 ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (lite) document.documentElement.classList.add('lite');
  // Osvježavanje stranice uvijek kreće od vrha (bez skoka ispod loadera)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* privatni prozor */ } },
  };
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  /* ======================================================================
     Loader
     ====================================================================== */
  function runLoader() {
    return new Promise((resolve) => {
      const loader = $('#loader');
      if (!loader) { resolve(); return; }

      const today = new Date().toDateString();
      // Ko je stranicu već vidio danas, ne gleda loader ponovo (klasu postavlja skripta u <head>)
      if (document.documentElement.classList.contains('skip-loader')) {
        loader.remove();
        store.set('zcore-loader-day', today);
        const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        Promise.race([fontsReady, new Promise((r) => setTimeout(r, 400))]).then(() => resolve());
        return;
      }

      const count = $('#loaderCount');
      // Dovoljno dugo da se znak sklopi do kraja (inače izgleda isječeno)
      const minTime = 1500;
      const start = performance.now();
      // Čekamo i fontove, da se tekst ne "preskoči" u drugi font nakon loadera
      let pageLoaded = document.readyState === 'complete';
      let fontsLoaded = !(document.fonts && document.fonts.ready);
      window.addEventListener('load', () => { pageLoaded = true; }, { once: true });
      if (!fontsLoaded) document.fonts.ready.then(() => { fontsLoaded = true; });
      // Sigurnosni izlaz ako se neki resurs ne učita
      setTimeout(() => { pageLoaded = true; fontsLoaded = true; }, 6000);

      // Traka je CSS animacija (radi je grafička kartica, ne zastaje kad je procesor zauzet);
      // brojač se osvježava rijetko, a JS samo čeka da prođe minimalno vrijeme i da se stranica učita.
      loader.style.setProperty('--lt', minTime + 'ms');
      loader.classList.add('is-running');
      const tick = setInterval(() => {
        const t = Math.min(1, (performance.now() - start) / minTime);
        count.textContent = String(Math.round((1 - Math.pow(1 - t, 3)) * 92)).padStart(3, '0');
      }, 90);
      function check() {
        if (!(pageLoaded && fontsLoaded) || performance.now() - start < minTime) { setTimeout(check, 50); return; }
        clearInterval(tick);
        loader.classList.add('is-full');
        count.textContent = '100';
        store.set('zcore-loader-day', today);
        setTimeout(() => {
          loader.classList.add('is-done');
          setTimeout(resolve, 300);
          loader.addEventListener('animationend', (e) => { if (e.target === loader) loader.remove(); });
          setTimeout(() => { if (loader.isConnected) loader.remove(); }, 1600);
        }, 300);
      }
      check();
    });
  }

  /* ======================================================================
     Hero: kucanje → brisanje → "reels" tekst → Zcore (bez ponavljanja)
     ====================================================================== */
  const stage = $('#heroStage');
  const typeEl = $('#heroType');
  const reelEl = $('#heroReel');

  function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // lines: [{ text, sub?, hl?, shake? }]
  function buildReel(lines) {
    reelEl.classList.remove('is-out');
    reelEl.innerHTML = lines.map((l) => {
      const words = l.text.split(' ').map((w) => `<span class="reel-word">${esc(w)}</span>`).join(' ');
      const inner = l.hl ? `<span class="reel-hl">${words}</span>` : words;
      return `<span class="reel-line${l.sub ? ' reel-line--sub' : ''}${l.shake ? ' js-shake' : ''}">${inner}</span>`;
    }).join('');
  }

  async function popIn(stagger = 130) {
    const items = $$('.reel-hl, .reel-word', reelEl);
    for (const el of items) {
      el.classList.add('is-in');
      if (!el.classList.contains('reel-hl')) await sleep(stagger);
    }
    $$('.js-shake', reelEl).forEach((el) => el.classList.add('reel-shake'));
  }

  async function popOut() {
    reelEl.classList.add('is-out');
    await sleep(480);
  }

  async function typeInto(textNode, caret, text, speed) {
    caret.classList.add('is-typing');
    for (const ch of text) {
      textNode.textContent += ch;
      await sleep(speed + Math.random() * speed * .6);
    }
    caret.classList.remove('is-typing');
  }

  async function eraseFrom(textNode, caret, speed) {
    caret.classList.add('is-typing');
    while (textNode.textContent.length) {
      textNode.textContent = textNode.textContent.slice(0, -1);
      await sleep(speed);
    }
    caret.classList.remove('is-typing');
  }

  // Završni blok: veliko "Zcore", ispod dva reda tačno u širini riječi "Zcore"
  const FINAL_LINES = [['Proizvodnja', 'na'], ['jednom', 'mjestu']];
  function finalHTML(withCaret, wordsIn) {
    const cls = 'reel-word' + (wordsIn ? ' is-in' : '');
    return '<span class="reel-final">' +
      `<span class="reel-big">${withCaret ? '<span class="tt"></span><span class="caret"></span>' : 'Zcore'}</span>` +
      FINAL_LINES.map((ws) => `<span class="fit-line">${ws.map((w) => `<span class="${cls}">${w}</span>`).join(' ')}</span>`).join('') +
      '</span>';
  }

  let probe;
  function fitFinal() {
    const final = stage && $('.reel-final', stage);
    if (!final) return;
    const big = $('.reel-big', final);
    if (!probe) {
      probe = document.createElement('span');
      probe.className = 'reel-big';
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap;display:inline-block';
      probe.textContent = 'Zcore';
    }
    final.appendChild(probe);
    const W = probe.getBoundingClientRect().width;
    final.removeChild(probe);
    final.style.width = W + 'px';
    big.style.minWidth = W + 'px';
    $$('.fit-line', final).forEach((line) => {
      line.style.fontSize = '100px';
      line.style.display = 'inline-block';
      const w = line.getBoundingClientRect().width;
      line.style.display = '';
      line.style.fontSize = (100 * W / w) + 'px';
    });
  }

  // "za jednu informaciju." tačno u širini crnog okvira "15 minuta"
  function fitSubToHighlight() {
    const hl = $('.reel-hl', reelEl);
    const sub = $('.reel-line--sub', reelEl);
    if (!hl || !sub) return;
    const hr = hl.getBoundingClientRect();
    const W = hr.width;
    sub.style.whiteSpace = 'nowrap';
    sub.style.fontSize = '100px';
    sub.style.display = 'inline-block';
    const w = sub.getBoundingClientRect().width;
    sub.style.display = '';
    sub.style.width = W + 'px';
    sub.style.fontSize = (100 * W / w) + 'px';
    sub.style.marginLeft = (hr.left - reelEl.getBoundingClientRect().left) + 'px';
    sub.style.marginTop = '.12em';
  }

  function sizeStage() {
    if (!stage) return;
    const h = Math.max(typeEl.offsetHeight, reelEl.offsetHeight);
    if (h) stage.style.height = h + 'px';
  }

  async function heroFinal() {
    typeEl.innerHTML = '';
    reelEl.classList.remove('is-out');
    reelEl.innerHTML = finalHTML(false, true);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    fitFinal();
    sizeStage();
  }

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { fitFinal(); sizeStage(); }, 120);
  });

  async function runHero() {
    if (!stage) return;
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    // Ponovna posjeta istog dana: odmah završni prikaz (bez kucanja i „Šef zove”)
    if (reduceMotion || document.documentElement.classList.contains('skip-loader')) { heroFinal(); return; }

    reelEl.innerHTML = '';

    // 1) Kucanje: "Gdje je nalog?"
    typeEl.innerHTML = '<span class="tt">Gdje je nalog?</span><span class="caret"></span>';
    sizeStage();
    const tt = $('.tt', typeEl);
    tt.textContent = '';
    const caret = $('.caret', typeEl);
    await sleep(350);
    await typeInto(tt, caret, 'Gdje je nalog?', 85);
    await sleep(1500);

    // 2) Brisanje
    await eraseFrom(tt, caret, 38);
    await sleep(260);
    typeEl.innerHTML = '';

    // 3) Reels tekst
    buildReel([{ text: 'Šef zove.', shake: true }]);
    sizeStage();
    await popIn(160);
    await sleep(1250);
    await popOut();

    buildReel([
      { text: '15 minuta', hl: true },
      { text: 'za jednu informaciju.', sub: true },
    ]);
    fitSubToHighlight();
    sizeStage();
    await popIn(140);
    await sleep(1900);
    await popOut();

    // 4) Kraj: veliko Zcore + "Proizvodnja na / jednom mjestu" — i stop
    reelEl.classList.remove('is-out');
    reelEl.innerHTML = finalHTML(true, false);
    fitFinal();
    sizeStage();
    const tt2 = $('.tt', reelEl);
    const caret2 = $('.caret', reelEl);
    await sleep(250);
    await typeInto(tt2, caret2, 'Zcore', 120);
    await sleep(300);
    for (const w of $$('.reel-word', reelEl)) { w.classList.add('is-in'); await sleep(150); }
    await sleep(2400);
    caret2.classList.add('is-gone');
  }

  /* ======================================================================
     Hero vizual: brojači, živi tajmer, tilt
     ====================================================================== */
  function countUp(el, to, dur = 1400) {
    const start = performance.now();
    const from = 0;
    function f(now) {
      const t = Math.min(1, (now - start) / dur);
      const v = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      el.textContent = v;
      if (t < 1) requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  }

  // Pokreće fn kad element uđe u ekran (jednom)
  function onVisible(el, fn, threshold = .35) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
    }, { threshold });
    io.observe(el);
  }

  function initDash() {
    const dash = $('#dash');
    if (!dash) return;
    if (reduceMotion) { dash.classList.add('is-in', 'is-loaded'); startDashLive(dash); return; }
    // prije učitavanja: nule, prazne trake, statusi skriveni
    $$('[data-count]', dash).forEach((el) => { el.textContent = '0'; });
    setStopTimer(0);
    onVisible(dash, () => {
      dash.classList.add('is-in');
      countTimer(42, 1500);
      $$('[data-count]', dash).forEach((el, i) => setTimeout(() => countUp(el, +el.dataset.count, 1500), i * 90));
      setTimeout(() => dash.classList.add('is-loaded'), 1100);
      setTimeout(() => startDashLive(dash), 1700);
    });
  }

  function setStopTimer(secs) {
    const m = Math.floor(secs / 60), s = secs % 60;
    $$('[data-stop-timer]').forEach((el) => { el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; });
    $$('[data-stop-timer-short]').forEach((el) => { el.textContent = `${m}:${String(s).padStart(2, '0')}`; });
  }

  function countTimer(to, dur) {
    const start = performance.now();
    function f(now) {
      const t = Math.min(1, (now - start) / dur);
      setStopTimer(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  }

  function startDashLive(dash) {
    // Živi tajmer zastoja
    let secs = 42;
    setInterval(() => { secs += 1; setStopTimer(secs); }, 1000);

    // Nalog #1042 polako napreduje
    const qty = $('#dashQty');
    const bar = $('#dashBar');
    const good = $('#kpiGood');
    let q = 52, g = 214;
    const tick = setInterval(() => {
      if (q >= 100) { clearInterval(tick); return; }
      q += 1; g += 1;
      qty.textContent = q;
      good.textContent = g;
      bar.style.setProperty('--p', q + '%');
    }, 4200);

    // Tilt na mišu
    if (finePointer && !lite) {
      const wrap = dash.parentElement;
      wrap.addEventListener('mousemove', (e) => {
        const r = wrap.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        dash.style.transform = `perspective(1200px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
      });
      wrap.addEventListener('mouseleave', () => { dash.style.transform = ''; });
    }
  }

  /* ======================================================================
     Beskonačne trake (riječi ispod heroja, logotipi klijenata)
     Grupa se puni ponavljanjem dok ne bude šira od ekrana, pa se kopira
     jednom: pomjeranje za -50% je tada uvijek bez praznog prostora.
     ====================================================================== */
  function loopTrack(track, pxPerSec = 60) {
    if (!track) return;
    const first = track.firstElementChild;
    if (!first) return;
    if (!track.__orig) track.__orig = first.innerHTML;
    first.innerHTML = track.__orig;
    while (track.children.length > 1) track.lastElementChild.remove();
    const need = Math.max(window.innerWidth, document.documentElement.clientWidth) + 200;
    let guard = 0;
    while (first.scrollWidth < need && guard++ < 30) {
      const tmp = document.createElement('div');
      tmp.innerHTML = track.__orig;
      Array.from(tmp.children).forEach((el) => { el.setAttribute('aria-hidden', 'true'); first.appendChild(el); });
    }
    const copy = first.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    track.appendChild(copy);
    // ista brzina bez obzira na dužinu trake
    track.style.animationDuration = `${Math.max(10, first.scrollWidth / pxPerSec)}s`;
  }
  const loops = [];
  function registerLoop(track, speed) {
    if (!track) return;
    loops.push([track, speed]);
    loopTrack(track, speed);
  }
  let loopResizeT, loopW = window.innerWidth;
  window.addEventListener('resize', () => {
    clearTimeout(loopResizeT);
    loopResizeT = setTimeout(() => {
      if (Math.abs(window.innerWidth - loopW) < 40) return;
      loopW = window.innerWidth;
      loops.forEach(([t, s]) => loopTrack(t, s));
    }, 200);
  });
  window.ZcoreLoop = registerLoop;

  /* ======================================================================
     Glatko skrolanje do sekcije (radi i kad je u sistemu isključeno)
     ====================================================================== */
  function initSmoothScroll() {
    const root = document.documentElement;
    let anim = null;
    const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    function stop() { if (anim) { cancelAnimationFrame(anim); anim = null; root.style.scrollBehavior = ''; } }
    ['wheel', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, stop, { passive: true }));

    function scrollToY(y) {
      stop();
      const start = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const end = Math.max(0, Math.min(max, y));
      const dist = end - start;
      if (Math.abs(dist) < 2) return;
      const dur = Math.min(1000, Math.max(450, 350 + Math.abs(dist) * 0.12));
      const t0 = performance.now();
      root.style.scrollBehavior = 'auto';
      function step(now) {
        const t = Math.min(1, (now - t0) / dur);
        window.scrollTo(0, start + dist * easeInOut(t));
        if (t < 1) anim = requestAnimationFrame(step);
        else { anim = null; root.style.scrollBehavior = ''; }
      }
      anim = requestAnimationFrame(step);
    }

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const url = new URL(a.getAttribute('href'), location.href);
      if (url.origin !== location.origin || !url.hash) return;
      const samePage = url.pathname === location.pathname ||
        ((url.pathname === '/' || url.pathname === '/index.html') && (location.pathname === '/' || location.pathname === '/index.html'));
      if (!samePage) return;
      const id = decodeURIComponent(url.hash.slice(1));
      const target = id === 'top' ? document.body : document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const header = document.getElementById('header');
      const offset = (header ? header.offsetHeight : 0) + 8;
      const y = id === 'top' ? 0 : target.getBoundingClientRect().top + window.scrollY - offset;
      scrollToY(y);
      if (history.pushState) history.pushState(null, '', url.hash);
    });
  }

  function initSpotlight() {
    const hero = $('.hero');
    if (!hero || !finePointer || lite) return;
    const spot = $('.hero__spot', hero);
    hero.addEventListener('mousemove', (e) => {
      const r = hero.getBoundingClientRect();
      spot.style.setProperty('--mx', `${e.clientX - r.left}px`);
      spot.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }

  /* ======================================================================
     Header, meni, napredak skrolanja
     ====================================================================== */
  function initHeader() {
    const header = $('#header');
    const line = $('#progressLine');
    const btn = $('#menuBtn');
    const nav = $('#nav');
    if (!header) return;

    // Sakrij/prikaži po smjeru i pređenoj udaljenosti, ne po brzini:
    // sporo skrolanje ili usporavanje više ne pali/gasi traku.
    const HIDE_AFTER = 60;   // px skrolanja dolje prije sakrivanja
    const SHOW_AFTER = 40;   // px skrolanja gore prije prikazivanja
    let lastY = window.scrollY;
    let anchorY = lastY;     // gdje je počeo trenutni smjer
    let dir = 0;             // 1 dolje, -1 gore
    let ticking = false;
    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const raw = window.scrollY;
      const y = Math.min(Math.max(raw, 0), Math.max(max, 0)); // bez iOS „gumenog” odskoka
      header.classList.toggle('is-scrolled', y > 8);
      const menuOpen = document.body.classList.contains('menu-open');
      const d = y - lastY;
      if (d !== 0) {
        const nd = d > 0 ? 1 : -1;
        if (nd !== dir) { dir = nd; anchorY = lastY; }
        const travelled = Math.abs(y - anchorY);
        if (y <= 120) header.classList.remove('is-hidden');
        else if (dir > 0 && travelled > HIDE_AFTER && y > 480 && !menuOpen) header.classList.add('is-hidden');
        else if (dir < 0 && travelled > SHOW_AFTER) header.classList.remove('is-hidden');
      }
      lastY = y;
      if (line) {
        line.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      }
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
    }, { passive: true });
    onScroll();

    function setMenu(open) {
      document.body.classList.toggle('menu-open', open);
      header.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Zatvori meni' : 'Otvori meni');
      if (open) header.classList.remove('is-hidden');
    }
    if (btn && nav) {
      btn.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
      $$('a', nav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
      window.matchMedia('(min-width: 881px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
    }

    // Aktivni link u navigaciji
    const links = $$('.nav__link[href^="#"]');
    if (links.length && 'IntersectionObserver' in window) {
      const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          const a = map.get(en.target.id);
          if (a && en.isIntersecting) { links.forEach((l) => l.classList.remove('is-active')); a.classList.add('is-active'); }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    }
  }

  /* ======================================================================
     Reveal pri skrolanju
     ====================================================================== */
  function initReveal() {
    const els = $$('.reveal, .reveal-mask');
    if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach((e) => e.classList.add('is-in')); return; }
    // Elementi s clip-path maskom se prate preko roditelja (potpuno odsječen element IO ne vidi)
    const targets = new Map();
    els.forEach((e) => {
      const t = e.classList.contains('reveal-mask') ? e.parentElement : e;
      if (!targets.has(t)) targets.set(t, []);
      targets.get(t).push(e);
    });
    // Brzina skrolanja: kad se sekcije proleti brzo, elementi se pojave odmah, bez animacije
    // (inače desetine animacija krenu odjednom i slabiji računar/telefon zastaje)
    let vy = 0, lastY = window.scrollY, lastT = performance.now();
    window.addEventListener('scroll', () => {
      const now = performance.now(), y = window.scrollY;
      vy = Math.abs(y - lastY) / Math.max(1, now - lastT); lastY = y; lastT = now;
    }, { passive: true });
    const io = new IntersectionObserver((entries) => {
      const fast = vy > 2.2 && performance.now() - lastT < 120;
      entries.forEach((en) => {
        if (en.isIntersecting) {
          (targets.get(en.target) || []).forEach((e) => { if (fast) e.classList.add('is-now'); e.classList.add('is-in'); });
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
    targets.forEach((_, t) => io.observe(t));
  }

  /* ======================================================================
     Telefon: probni unos
     ====================================================================== */
  function initPhone() {
    const goodEl = $('#phoneGood');
    if (!goodEl) return;
    const scrapEl = $('#phoneScrap');
    const bar = $('#phoneBar');
    const state = $('#phoneState');
    const toast = $('#toast');
    let good = 52, scrap = 0, toastT;

    // Učitavanje: broj komada raste do 52, traka se puni
    if (reduceMotion) { bar.classList.add('is-in'); }
    else {
      goodEl.textContent = '0';
      onVisible($('#phone'), () => {
        bar.classList.add('is-in');
        countUp(goodEl, good, 1400);
      }, .4);
    }

    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('is-on');
      clearTimeout(toastT);
      toastT = setTimeout(() => toast.classList.remove('is-on'), 1400);
    }
    function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

    $('#btnGood').addEventListener('click', () => {
      if (good >= 100) { showToast('Nalog završen · 100 / 100'); return; }
      good += 1;
      goodEl.textContent = good;
      bar.style.setProperty('--p', good + '%');
      bump(goodEl);
      if (navigator.vibrate) navigator.vibrate(12);
      showToast(good === 100 ? 'Nalog završen · 100 / 100' : '+1 dobar komad');
      if (good === 100) state.textContent = 'Završeno';
    });
    $('#btnScrap').addEventListener('click', () => {
      scrap += 1;
      scrapEl.textContent = scrap;
      if (navigator.vibrate) navigator.vibrate([10, 40, 10]);
      showToast('+1 škart · odvojeno od dobrih');
    });
    $$('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const on = chip.getAttribute('aria-pressed') !== 'true';
        const name = chip.dataset.chip;
        if (name === 'Zastoj') {
          chip.setAttribute('aria-pressed', String(on));
          state.textContent = on ? 'Zastoj' : (good >= 100 ? 'Završeno' : 'U toku');
          showToast(on ? 'Zastoj prijavljen' : 'Rad nastavljen');
        } else {
          chip.setAttribute('aria-pressed', 'true');
          showToast(name === 'Napomena' ? 'Napomena dodana na nalog' : 'Promjena alata upisana');
          setTimeout(() => chip.setAttribute('aria-pressed', 'false'), 900);
        }
      });
    });
  }

  /* ======================================================================
     Filter modula
     ====================================================================== */
  function initFilters() {
    const btns = $$('.filter');
    if (!btns.length) return;
    const mods = $$('.module');
    btns.forEach((b) => b.addEventListener('click', () => {
      btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const f = b.dataset.filter;
      let i = 0;
      mods.forEach((m) => {
        const show = f === 'all' || m.dataset.phase === f;
        m.classList.toggle('is-hidden', !show);
        m.classList.remove('is-pop');
        if (show) {
          m.classList.add('is-in');
          void m.offsetWidth;
          m.style.setProperty('--pd', `${i++ * 60}ms`);
          m.classList.add('is-pop');
        }
      });
    }));
  }

  /* ======================================================================
     Kontakt podaci i obrazac
     ====================================================================== */
  /* ======================================================================
     Cijene: mjesečno / godišnje, i izabrani paket u poruci obrasca
     ====================================================================== */
  function initPricing() {
    $$('[data-billing]').forEach((b) => b.addEventListener('click', () => {
      const yearly = b.dataset.billing === 'y';
      $$('[data-billing]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.billing === b.dataset.billing)));
      $$('[data-pricing], .pricing-note, .plan-ent').forEach((el) => el.classList.toggle('is-yearly', yearly));
    }));
    const msg = $('#f-poruka');
    if (!msg) return;
    const setPlan = (plan) => {
      if (!plan || !/^[A-Za-z]{2,20}$/.test(plan)) return;
      if (!msg.value.trim() || /^Zanima nas paket \w+\.$/.test(msg.value.trim())) msg.value = `Zanima nas paket ${plan}.`;
    };
    setPlan(new URLSearchParams(location.search).get('paket'));
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-plan]');
      if (a) setPlan(a.dataset.plan);
    });
  }

  function initContact() {
    $$('[data-contact-email]').forEach((a) => {
      if (CONFIG.contactEmail) {
        a.textContent = CONFIG.contactEmail;
        a.href = 'mailto:' + CONFIG.contactEmail;
      } else {
        a.removeAttribute('href');
      }
    });

    const form = $('#contactForm');
    if (!form) return;
    const status = $('#formStatus');
    const btn = $('button[type="submit"]', form);
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function check(input) {
      let ok = true;
      if (input.type === 'checkbox') ok = input.checked;
      else if (input.type === 'email') ok = emailRe.test(input.value.trim());
      else if (input.required) ok = input.value.trim().length > 0;
      const field = input.closest('.field');
      if (field) field.classList.toggle('has-error', !ok);
      input.setAttribute('aria-invalid', String(!ok));
      return ok;
    }
    $$('[required]', form).forEach((i) => {
      i.addEventListener('blur', () => { if (i.value || i.type === 'checkbox') check(i); });
      i.addEventListener('input', () => { if (i.getAttribute('aria-invalid') === 'true') check(i); });
      i.addEventListener('change', () => { if (i.type === 'checkbox') check(i); });
    });

    /* ---------- Animacija slanja u istom okviru ---------- */
    const SA_ART = `
      <svg class="sa-art" viewBox="0 0 200 150" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <g class="sa-speed" stroke="#8C8C8C" stroke-width="2.5"><path d="M40 100h-22"/><path d="M46 110h-30"/><path d="M40 120h-18"/></g>
        <g class="sa-env"><g class="sa-bob">
          <path class="sa-flap-back" d="M56 64 L100 34 L144 64" fill="#161616" stroke="#fff" stroke-width="2.5"/>
          <g class="sa-letter">
            <rect x="66" y="34" width="68" height="44" rx="3" fill="#161616" stroke="#fff" stroke-width="2.5"/>
            <path d="M76 46h48M76 55h48M76 64h28" stroke="#8C8C8C" stroke-width="2.5"/>
          </g>
          <path d="M56 64 H144 V108 A4 4 0 0 1 140 112 H60 A4 4 0 0 1 56 108 Z" fill="#161616" stroke="#fff" stroke-width="2.5"/>
          <path d="M58 110 L92 86 M142 110 L108 86" stroke="#4A4A4A" stroke-width="2.5"/>
          <path class="sa-flap-front" d="M56 64 L100 94 L144 64 Z" fill="#161616" stroke="#fff" stroke-width="2.5"/>
        </g></g>
        <g class="sa-check" stroke="#fff"><circle cx="100" cy="76" r="34" stroke-width="3.5" pathLength="1" transform="rotate(-90 100 76)"/><path d="M85 77 l11 11 l20 -23" stroke-width="5" pathLength="1"/></g>
        <g class="sa-err" stroke="#fff"><circle cx="100" cy="76" r="34" stroke-width="3.5" pathLength="1" transform="rotate(-90 100 76)"/><path d="M88 64 l24 24" stroke-width="5" pathLength="1"/><path d="M112 64 l-24 24" stroke-width="5" pathLength="1"/></g>
      </svg>
      <p class="sa-label">Šaljem upit</p>
      <div class="sa-bar"><i></i></div>
      <div class="sa-result"><h3></h3><p></p><button type="button" class="btn btn--light btn--sm"></button></div>`;
    const anim = document.createElement('div');
    anim.className = 'send-anim';
    anim.setAttribute('role', 'status');
    anim.setAttribute('aria-live', 'polite');
    form.appendChild(anim);
    Array.from(form.children).forEach((el, i) => el.style.setProperty('--i', i));
    let afterResult = null;

    function animStart() {
      anim.innerHTML = SA_ART;
      anim.className = 'send-anim';
      void anim.offsetWidth;
      anim.classList.add('is-sending');
      form.classList.add('is-busy');
      form.setAttribute('aria-busy', 'true');
    }
    function animResult(ok, title, html, btnText, onBtn) {
      const label = $('.sa-label', anim);
      return new Promise((resolve) => {
        const finish = () => {
          anim.classList.remove('is-sending', 'is-flying');
          anim.classList.add(ok ? 'is-done' : 'is-error');
          label.textContent = ok ? 'Upit poslan' : 'Upit nije poslan';
          $('.sa-result h3', anim).textContent = title;
          $('.sa-result p', anim).innerHTML = html;
          const b = $('.sa-result button', anim);
          b.textContent = btnText;
          afterResult = onBtn;
          form.removeAttribute('aria-busy');
          setTimeout(() => b.focus({ preventScroll: true }), 900);
          resolve();
        };
        if (ok) {
          anim.classList.add('is-flying');
          label.textContent = 'Šaljem upit';
          setTimeout(finish, 650);
        } else finish();
      });
    }
    // Prvo nestane animacija (potvrda), tek onda se vrate polja obrasca.
    function animClose() {
      form.removeAttribute('aria-busy');
      if (!form.classList.contains('is-busy')) return;
      form.classList.add('is-closing');
      setTimeout(() => {
        anim.className = 'send-anim';
        anim.innerHTML = '';
        form.classList.remove('is-busy', 'is-closing');
      }, 320);
    }
    anim.addEventListener('click', (e) => {
      if (e.target.closest('.sa-result button') && afterResult) afterResult();
    });
    const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (form.classList.contains('is-busy')) return;
      status.classList.remove('is-ok');
      const fields = $$('[required]', form);
      const results = fields.map(check);
      if (results.includes(false)) {
        status.textContent = 'Provjerite označena polja.';
        fields[results.indexOf(false)].focus();
        return;
      }
      if (form._gotcha && form._gotcha.value) return; // spam

      const data = new FormData(form);
      data.delete('_gotcha');

      // 1) Upit ide u bazu; vidi se u admin panelu (Upiti)
      // Animacija kreće odmah; biblioteka za bazu se učita tek sada (početna ostaje lagana)
      status.textContent = '';
      animStart();
      const t0 = performance.now();
      const sb = window.ZcoreCMS ? await window.ZcoreCMS.dbAsync() : null;
      if (sb) {
        const row = {
          company: String(data.get('firma') || '').trim(),
          name: String(data.get('ime') || '').trim(),
          email: String(data.get('email') || '').trim(),
          employees: String(data.get('zaposleni') || '').trim() || null,
          message: String(data.get('poruka') || '').trim() || null,
          consent: true,
        };
        let error = null;
        try { ({ error } = await sb.from('inquiries').insert(row)); } catch (err) { error = err; }
        // koverta se stigne zatvoriti prije nego odleti
        const wait = 1500 - (performance.now() - t0);
        if (wait > 0) await sleep(wait);
        if (!error) {
          await animResult(true, 'Upit je poslan.',
            `Hvala, <b>${escHtml(row.company)}</b>. Javit ćemo vam se na <b>${escHtml(row.email)}</b>.`,
            'Pošalji novi upit', () => {
              form.reset();
              $$('.field', form).forEach((f) => f.classList.remove('has-error'));
              $$('[aria-invalid]', form).forEach((i) => i.removeAttribute('aria-invalid'));
              animClose();
              setTimeout(() => $('#f-firma').focus({ preventScroll: true }), 800);
            });
          return;
        }
        const msg = /Previše/.test(String(error.message || ''))
          ? 'Previše upita u kratkom vremenu. Pokušajte za nekoliko minuta.'
          : `Provjerite internet vezu i pokušajte ponovo, ili nam pišite na ${escHtml(CONFIG.contactEmail || 'Instagramu @zcore.ba')}.`;
        await animResult(false, 'Slanje nije uspjelo.', msg, 'Nazad na obrazac', () => {
          animClose(); // upisani podaci ostaju
        });
        return;
      }
      animClose();

      if (CONFIG.formEndpoint) {
        btn.classList.add('is-loading');
        status.textContent = 'Šaljem…';
        try {
          const res = await fetch(CONFIG.formEndpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error(res.status);
          form.reset();
          status.textContent = 'Hvala. Upit je poslan, javit ćemo vam se e-poštom.';
          status.classList.add('is-ok');
        } catch (err) {
          status.textContent = 'Slanje nije uspjelo. Pokušajte ponovo ili nam pišite na Instagramu @zcore.ba.';
        } finally {
          btn.classList.remove('is-loading');
        }
        return;
      }

      if (CONFIG.contactEmail) {
        const body = [
          `Firma: ${data.get('firma')}`,
          `Ime i prezime: ${data.get('ime')}`,
          `E-pošta: ${data.get('email')}`,
          `Broj zaposlenih: ${data.get('zaposleni')}`,
          '',
          `Kako danas pratimo proizvodnju:`,
          `${data.get('poruka') || '-'}`,
        ].join('\n');
        window.location.href = `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent('Prijava za testiranje – ' + data.get('firma'))}&body=${encodeURIComponent(body)}`;
        status.textContent = 'Otvaramo vašu e-poštu s popunjenom porukom. Pošaljite je i javit ćemo se.';
        status.classList.add('is-ok');
        return;
      }

      status.textContent = 'Obrazac još nije povezan. Pišite nam na Instagramu @zcore.ba.';
    });
  }

  /* ======================================================================
     Kolačići
     ====================================================================== */
  function initCookies() {
    const box = $('#cookie');
    if (!box) return;
    const KEY = 'zcore-cookies';
    const show = () => { box.setAttribute('aria-hidden', 'false'); box.classList.add('is-on'); };
    const hide = () => { box.classList.remove('is-on'); box.setAttribute('aria-hidden', 'true'); };
    if (!store.get(KEY)) setTimeout(show, 1600);
    $$('[data-cookie]', box).forEach((b) => b.addEventListener('click', () => {
      store.set(KEY, JSON.stringify({ choice: b.dataset.cookie, at: new Date().toISOString() }));
      hide();
    }));
    $$('[data-cookie-settings]').forEach((b) => b.addEventListener('click', show));
  }

  /* ======================================================================
     Pravne stranice: aktivna stavka sadržaja
     ====================================================================== */
  function initToc() {
    const toc = $('.toc');
    if (!toc || !('IntersectionObserver' in window)) return;
    const links = $$('a[href^="#"]', toc);
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((l) => l.classList.remove('is-active'));
          const a = map.get(en.target.id);
          if (a) a.classList.add('is-active');
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ======================================================================
     Start
     ====================================================================== */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  initHeader();
  initReveal();
  initPhone();
  initFilters();
  initContact();
  initPricing();
  initToc();
  initSpotlight();
  initSmoothScroll();
  registerLoop(document.querySelector('.ticker__track'), 55);

  // Sakrij završni tekst heroja dok loader traje (bez JS ostaje vidljiv)
  if (stage && !reduceMotion) { reelEl.innerHTML = ''; }

  runLoader().then(() => {
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    initDash();
    runHero();
    initCookies(); // baner tek nakon loadera
  });
})();
