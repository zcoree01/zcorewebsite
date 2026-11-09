/* ==========================================================================
   Alat d.o.o. Konjic — interakcije i animacije (po uzoru na zcore.ba)
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Animacije su iste za sve. Windows s opcijom "Adjust for best performance" javlja
  // prefers-reduced-motion, pa bi se inače na mnogim računarima sve ugasilo.
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // Slabiji uređaj → gasimo samo skupe ukrase (svjetlo, tilt, parallax)
  const lite = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  if (lite) document.documentElement.classList.add('lite');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* privatni prozor */ } },
  };

  /* ======================================================================
     Loader: broji 000 → 100, pa se zavjesa podigne (skew)
     Ne čeka video ni sve slike — samo fontove i glavnu sliku, max 2,5 s.
     ====================================================================== */
  function runLoader() {
    return new Promise((resolve) => {
      const loader = $('#loader');
      if (!loader) { resolve(); return; }
      const bar = $('#loaderBar');
      const count = $('#loaderCount');
      const seen = session.get('alat-loader') === '1';
      const minTime = seen ? 550 : 1500;
      const start = performance.now();

      let ready = false;
      const waits = [];
      if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready);
      const heroImg = $('.hero__media img, .hero__media video');
      if (heroImg && heroImg.tagName === 'IMG' && !heroImg.complete) {
        waits.push(new Promise((r) => { heroImg.addEventListener('load', r, { once: true }); heroImg.addEventListener('error', r, { once: true }); }));
      }
      Promise.all(waits).then(() => { ready = true; });
      setTimeout(() => { ready = true; }, 2500);

      let shown = 0;
      let last = start;
      function frame(now) {
        const t = Math.min(1, (now - start) / minTime);
        const eased = 1 - Math.pow(1 - t, 3);
        const target = ready ? eased : Math.min(eased, .9);
        const dt = Math.min(100, now - last); last = now;
        shown += (target - shown) * Math.min(1, dt / 70);
        if (ready && t >= 1 && shown > .995) shown = 1;
        bar.style.transform = `scaleX(${shown})`;
        count.textContent = String(Math.round(shown * 100)).padStart(3, '0');
        if (shown < 1) { requestAnimationFrame(frame); return; }
        session.set('alat-loader', '1');
        setTimeout(() => {
          loader.classList.add('is-done');
          setTimeout(resolve, 280);
          loader.addEventListener('animationend', (e) => { if (e.target === loader) loader.remove(); });
          setTimeout(() => { if (loader.isConnected) loader.remove(); }, 1600);
        }, 120);
      }
      requestAnimationFrame(frame);
    });
  }
  window.addEventListener('pageshow', (e) => {
    // povratak "nazad" iz keša: skloni zavjesu
    if (e.persisted) { const c = $('.page-cover'); if (c) c.classList.remove('is-on'); }
  });

  /* ======================================================================
     Prelaz na drugu stranicu
     ====================================================================== */
  function initPageTransitions() {
    const cover = $('.page-cover');
    if (!cover) return;
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || a.target === '_blank' || a.hasAttribute('download') ||
          e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = a.getAttribute('href');
      if (/^(mailto|tel):/i.test(href) || href.charAt(0) === '#') return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname) return; // isto (sidro) — rješava glatko skrolanje
      e.preventDefault();
      cover.classList.add('is-on');
      setTimeout(() => { location.href = a.href; }, 520);
    });
  }

  /* ======================================================================
     Hero naslov
     - početna: kucanje "Preciznost" → riječi iskaču → "detalju." u plavom okviru
     - podstranice: riječi iskaču jedna po jedna
     ====================================================================== */
  const words = (text, cls = '') => text.split(' ').map((w) => `<span class="reel-word${cls}">${w}</span>`).join(' ');

  async function typeInto(node, caret, text, speed) {
    caret.classList.add('is-typing');
    for (const ch of text) {
      node.textContent += ch;
      await sleep(speed + Math.random() * speed * .6);
    }
    caret.classList.remove('is-typing');
  }

  function prepHero() {
    const title = $('.hero__title[data-hero]');
    if (!title) return null;
    // zadrži visinu naslova da se stranica ne pomjera
    title.style.minHeight = title.offsetHeight + 'px';
    const mode = title.dataset.hero;
    if (mode === 'type') {
      title.innerHTML = '<span class="tline"><span class="tt"></span><span class="caret"></span></span>' +
        `<span class="tline">${words('u svakom')} <span class="reel-hl">${words('detalju.')}</span></span>`;
    } else {
      const lines = JSON.parse(title.dataset.lines || '[]');
      title.innerHTML = lines.map((l) => `<span class="tline${l.hl ? ' tline--hl' : ''}">${words(l.text)}</span>`).join('');
    }
    return title;
  }

  async function runHero(title) {
    if (!title) return;
    if (title.dataset.hero === 'type') {
      const tt = $('.tt', title);
      const caret = $('.caret', title);
      await sleep(150);
      await typeInto(tt, caret, 'Preciznost', 70);
      await sleep(180);
      for (const el of $$('.reel-word', title)) {
        el.classList.add('is-in');
        await sleep(130);
      }
      const hl = $('.reel-hl', title);
      hl.classList.add('is-in', 'reel-shake');
      await sleep(2200);
      caret.classList.add('is-gone');
    } else {
      for (const el of $$('.reel-word', title)) {
        el.classList.add('is-in');
        await sleep(90);
      }
      $$('.reel-hl', title).forEach((h) => h.classList.add('is-in'));
    }
  }

  /* ======================================================================
     Header, meni, napredak skrolanja
     ====================================================================== */
  function initHeader() {
    const header = $('.header');
    const progress = $('.progress');
    const burger = $('.burger');
    let lastY = window.scrollY, ticking = false;

    function onScroll() {
      const y = window.scrollY;
      if (header) {
        header.classList.toggle('is-scrolled', y > 30);
        const menuOpen = document.body.classList.contains('menu-open');
        if (!menuOpen) header.classList.toggle('is-hidden', y > 480 && y > lastY + 2);
        if (y < lastY - 2) header.classList.remove('is-hidden');
      }
      if (progress) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      }
      updateTimeline();
      updateParallax();
      lastY = y; ticking = false;
    }
    window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
    onScroll();

    function setMenu(open) {
      document.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Zatvori meni' : 'Otvori meni');
      if (open && header) header.classList.remove('is-hidden');
    }
    if (burger) {
      burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
      $$('.mobile-menu a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
      window.matchMedia('(min-width: 1101px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
    }
  }

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
      const dur = Math.min(1100, Math.max(450, 350 + Math.abs(dist) * 0.12));
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
    window.AlatScrollTo = scrollToY;

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const url = new URL(a.getAttribute('href'), location.href);
      if (url.origin !== location.origin || !url.hash || url.pathname !== location.pathname) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      const header = $('.header');
      scrollToY(target.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0) - 8);
      if (history.pushState) history.pushState(null, '', url.hash);
    });
  }

  /* ======================================================================
     Reveal pri skrolanju
     ====================================================================== */
  function initReveal() {
    $$('[data-stagger]').forEach((group) => {
      const step = parseFloat(group.getAttribute('data-stagger')) || 0.08;
      $$('[data-reveal]', group).forEach((el, i) => el.style.setProperty('--d', (i * step).toFixed(2) + 's'));
    });
    const els = $$('[data-reveal], .stat, .t-item, .cap, .tech-card');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
    els.forEach((e) => io.observe(e));
  }

  /* ======================================================================
     Brojači
     ====================================================================== */
  function countUp(el) {
    const raw = el.getAttribute('data-count');
    const to = parseFloat(raw);
    const from = parseFloat(el.getAttribute('data-from') || '0');
    const dec = (raw.split('.')[1] || '').length;
    const dur = 1600, start = performance.now();
    const fmt = (v) => (dec ? v.toFixed(dec) : String(Math.round(v)));
    function f(now) {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(f);
      else { const p = el.closest('.stat__num'); if (p) { p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); } }
    }
    requestAnimationFrame(f);
  }
  function initCounters() {
    const els = $$('[data-count]');
    els.forEach((el) => { el.textContent = el.getAttribute('data-from') || '0'; });
    if (!('IntersectionObserver' in window)) { els.forEach(countUp); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); countUp(en.target); } });
    }, { threshold: .5 });
    els.forEach((el) => io.observe(el));
  }

  /* ======================================================================
     Beskonačna traka (puni se dok ne bude šira od ekrana, kao na zcore)
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
    while (first.scrollWidth < need && guard++ < 30) first.insertAdjacentHTML('beforeend', track.__orig);
    const copy = first.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    track.appendChild(copy);
    track.style.animationDuration = `${Math.max(10, first.scrollWidth / pxPerSec)}s`;
  }
  function initTicker() {
    const tracks = $$('.marquee__track');
    tracks.forEach((t) => loopTrack(t, 55));
    let w = window.innerWidth, rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { if (Math.abs(window.innerWidth - w) < 40) return; w = window.innerWidth; tracks.forEach((t) => loopTrack(t, 55)); }, 200);
    });
  }

  /* ======================================================================
     Svjetlo koje prati miš, spotlight na karticama, tilt
     ====================================================================== */
  function initPointerFx() {
    if (!finePointer) return;
    $$('.svc').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
    if (lite) return;
    $$('.hero, .page-hero').forEach((hero) => {
      const spot = $('.hero__spot', hero);
      if (!spot) return;
      hero.addEventListener('mousemove', (e) => {
        const r = hero.getBoundingClientRect();
        spot.style.setProperty('--mx', `${e.clientX - r.left}px`);
        spot.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
    $$('.machine, .float-card, .iso-seal').forEach((el) => {
      el.classList.add('tilt');
      const max = el.classList.contains('machine') ? 5 : 8;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        el.style.transition = 'transform .15s ease-out';
        el.style.transform = `perspective(900px) rotateY(${x * max}deg) rotateX(${-y * max}deg) translateY(-4px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transition = ''; el.style.transform = ''; });
    });
  }

  /* ======================================================================
     Timeline progres + parallax
     ====================================================================== */
  const tl = $('.timeline'), tlProg = $('.timeline__progress');
  function updateTimeline() {
    if (!tl || !tlProg) return;
    const r = tl.getBoundingClientRect();
    const p = Math.min(Math.max((window.innerHeight * .6 - r.top) / r.height, 0), 1);
    tlProg.style.height = (p * 100) + '%';
  }
  const parallax = lite ? [] : $$('[data-parallax]');
  function updateParallax() {
    parallax.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const speed = parseFloat(el.getAttribute('data-parallax')) || .12;
      el.style.transform = `translate3d(0,${((r.top + r.height / 2 - window.innerHeight / 2) * -speed).toFixed(1)}px,0)`;
    });
  }

  /* ======================================================================
     Filter mašina (iskakanje kao zcore moduli)
     ====================================================================== */
  function initFilters() {
    const tabs = $$('.tab[data-filter]');
    if (!tabs.length) return;
    const items = $$('.machine');
    tabs.forEach((tab) => tab.addEventListener('click', () => {
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      const f = tab.dataset.filter;
      let i = 0;
      items.forEach((m) => {
        const show = f === 'all' || m.dataset.cat === f;
        m.hidden = !show;
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
     FAQ: jedno otvoreno pitanje
     ====================================================================== */
  function initFaq() {
    const faqs = $$('.faq details');
    faqs.forEach((d) => d.addEventListener('toggle', () => { if (d.open) faqs.forEach((o) => { if (o !== d) o.open = false; }); }));
    if (location.hash === '#faq' && faqs[0]) faqs[0].open = true;
  }

  /* ======================================================================
     Mapa (učitava se tek na klik)
     ====================================================================== */
  function initMap() {
    const btn = $('[data-load-map]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const box = btn.closest('.map');
      const iframe = document.createElement('iframe');
      iframe.src = box.dataset.src;
      iframe.title = 'Lokacija Alat d.o.o. Konjic na Google Maps';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.allowFullscreen = true;
      box.innerHTML = '';
      box.appendChild(iframe);
    });
  }

  /* ======================================================================
     Kontakt obrazac + animacija slanja (koverta odleti, kvačica)
     ====================================================================== */
  function initContact() {
    const form = $('#contact-form');
    if (!form) return;
    const status = $('.form__status', form);
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const started = Date.now();

    function check(input) {
      let ok = true;
      if (input.type === 'checkbox') ok = input.checked;
      else if (input.type === 'email') ok = emailRe.test(input.value.trim());
      else ok = input.value.trim().length > 0;
      const field = input.closest('.field, .consent');
      if (field) field.classList.toggle('has-error', !ok);
      input.setAttribute('aria-invalid', String(!ok));
      return ok;
    }
    $$('[required]', form).forEach((i) => {
      i.addEventListener('blur', () => { if (i.value || i.type === 'checkbox') check(i); });
      i.addEventListener('input', () => { if (i.getAttribute('aria-invalid') === 'true') check(i); });
      i.addEventListener('change', () => { if (i.type === 'checkbox') check(i); });
    });

    const SA_ART = `
      <svg class="sa-art" viewBox="0 0 200 150" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <g class="sa-speed" stroke="#5c96ff" stroke-width="1.5"><path d="M40 100h-22"/><path d="M46 110h-30"/><path d="M40 120h-18"/></g>
        <g class="sa-env">
          <path class="sa-flap-back" d="M56 64 L100 34 L144 64" fill="#fff" stroke="#0b0f16" stroke-width="1.5"/>
          <g class="sa-letter">
            <rect x="66" y="34" width="68" height="44" rx="3" fill="#fff" stroke="#0b0f16" stroke-width="1.5"/>
            <path d="M76 46h48M76 55h48M76 64h28" stroke="#5c96ff" stroke-width="1.5"/>
          </g>
          <path d="M56 64 H144 V108 A4 4 0 0 1 140 112 H60 A4 4 0 0 1 56 108 Z" fill="#fff" stroke="#0b0f16" stroke-width="1.5"/>
          <path d="M57 111 L92 86 M143 111 L108 86" stroke="#c4ccd8" stroke-width="1.5"/>
          <path class="sa-flap-front" d="M56 64 L100 94 L144 64 Z" fill="#fff" stroke="#0b0f16" stroke-width="1.5"/>
        </g>
        <g class="sa-check" stroke="#5c96ff"><circle cx="100" cy="76" r="32" stroke-width="2" transform="rotate(-90 100 76)"/><path d="M86 77 l10 10 l19 -21" stroke-width="3"/></g>
        <g class="sa-err" stroke="#d13438"><circle cx="100" cy="76" r="32" stroke-width="2" transform="rotate(-90 100 76)"/><path d="M89 65 l22 22" stroke-width="3"/><path d="M111 65 l-22 22" stroke-width="3"/></g>
      </svg>
      <p class="sa-label">Šaljem upit</p>
      <div class="sa-bar"><i></i></div>
      <div class="sa-result"><h3></h3><p></p><button type="button" class="btn btn--dark"></button></div>`;
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
      return new Promise((resolve) => {
        const finish = () => {
          anim.classList.remove('is-sending', 'is-flying');
          anim.classList.add(ok ? 'is-done' : 'is-error');
          $('.sa-label', anim).textContent = ok ? 'Upit poslan' : 'Upit nije poslan';
          $('.sa-result h3', anim).textContent = title;
          $('.sa-result p', anim).innerHTML = html;
          const b = $('.sa-result button', anim);
          b.textContent = btnText;
          afterResult = onBtn;
          form.removeAttribute('aria-busy');
          setTimeout(() => b.focus({ preventScroll: true }), 900);
          resolve();
        };
        if (ok) { anim.classList.add('is-flying'); setTimeout(finish, 650); } else finish();
      });
    }
    function animClose() {
      form.classList.remove('is-busy');
      form.removeAttribute('aria-busy');
      setTimeout(() => { anim.className = 'send-anim'; anim.innerHTML = ''; }, 500);
    }
    anim.addEventListener('click', (e) => { if (e.target.closest('.sa-result button') && afterResult) afterResult(); });
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function mailto(data) {
      const body = [
        `Ime i prezime: ${data.get('name')}`,
        `Email: ${data.get('email')}`,
        `Telefon: ${data.get('phone') || '-'}`,
        '',
        `${data.get('message')}`,
      ].join('\n');
      location.href = `mailto:info@alatkonjic.com?subject=${encodeURIComponent(data.get('subject') || 'Upit sa web stranice')}&body=${encodeURIComponent(body)}`;
    }
    function resetForm() {
      form.reset();
      $$('.has-error', form).forEach((f) => f.classList.remove('has-error'));
      $$('[aria-invalid]', form).forEach((i) => i.removeAttribute('aria-invalid'));
      animClose();
      setTimeout(() => $('#name').focus({ preventScroll: true }), 450);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (form.classList.contains('is-busy')) return;
      status.className = 'form__status'; status.textContent = '';
      const fields = $$('[required]', form);
      const results = fields.map(check);
      if (results.includes(false)) {
        status.className = 'form__status is-err';
        status.textContent = 'Provjerite označena polja.';
        fields[results.indexOf(false)].focus();
        return;
      }
      const data = new FormData(form);
      if (data.get('website')) return; // spam
      data.append('elapsed', String(Date.now() - started));

      animStart();
      const t0 = performance.now();
      const endpoint = form.dataset.endpoint;
      let ok = false;
      if (endpoint && location.protocol !== 'file:') {
        try {
          const r = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
          const j = await r.json().catch(() => ({}));
          ok = r.ok && j.ok === true;
        } catch (err) { ok = false; }
      }
      // koverta se stigne zatvoriti prije nego odleti
      const wait = 1500 - (performance.now() - t0);
      if (wait > 0) await sleep(wait);

      if (ok) {
        await animResult(true, 'Upit je poslan.',
          `Hvala, <b>${esc(data.get('name'))}</b>. Odgovorit ćemo na <b>${esc(data.get('email'))}</b> u roku od jednog radnog dana.`,
          'Pošalji novi upit', resetForm);
        return;
      }
      // Bez servera (npr. GitHub Pages ili lokalno): otvori email s popunjenom porukom
      await animResult(true, 'Još samo jedan klik.',
        'Otvaramo vaš email program s pripremljenom porukom – pritisnite <b>Pošalji</b>. Ako se ne otvori, pišite na <b>info@alatkonjic.com</b>.',
        'Nazad na obrazac', () => animClose());
      mailto(data);
    });
  }

  /* ======================================================================
     Hero video: pauza kad nije na ekranu (štedi procesor)
     ====================================================================== */
  function initVideo() {
    const vid = $('.hero__media video');
    if (!vid) return;
    const conn = navigator.connection || {};
    if (conn.saveData) { vid.removeAttribute('autoplay'); vid.pause(); return; }
    const play = () => { const p = vid.play(); if (p && p.catch) p.catch(() => {}); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((en) => { en[0].isIntersecting ? play() : vid.pause(); }).observe(vid);
    } else play();
  }

  /* ======================================================================
     Start
     ====================================================================== */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  const toTop = $('.to-top');
  initHeader();
  initSmoothScroll();
  if (toTop) toTop.addEventListener('click', () => window.AlatScrollTo(0));
  initPageTransitions();
  initReveal();
  initCounters();
  initTicker();
  initPointerFx();
  initFilters();
  initFaq();
  initMap();
  initContact();
  initVideo();
  const heroTitle = prepHero();

  runLoader().then(() => {
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    runHero(heroTitle);
  });
})();
