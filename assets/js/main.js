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
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
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

      const bar = $('#loaderBar');
      const count = $('#loaderCount');
      const seen = session.get('zcore-loader') === '1';
      const minTime = reduceMotion ? 200 : (seen ? 900 : 2000);
      const start = performance.now();
      let loaded = document.readyState === 'complete';
      window.addEventListener('load', () => { loaded = true; }, { once: true });
      // Sigurnosni izlaz ako se neki resurs ne učita
      setTimeout(() => { loaded = true; }, 6000);

      let shown = 0;
      function frame(now) {
        const t = Math.min(1, (now - start) / minTime);
        const eased = 1 - Math.pow(1 - t, 3);
        const target = loaded ? eased : Math.min(eased, .9);
        shown += (target - shown) * .18;
        if (loaded && t >= 1 && shown > .995) shown = 1;
        bar.style.transform = `scaleX(${shown})`;
        count.textContent = String(Math.round(shown * 100)).padStart(3, '0');
        if (shown < 1) { requestAnimationFrame(frame); return; }
        session.set('zcore-loader', '1');
        setTimeout(() => {
          loader.classList.add('is-done');
          setTimeout(resolve, reduceMotion ? 0 : 350);
          setTimeout(() => loader.remove(), 1100);
        }, reduceMotion ? 0 : 180);
      }
      requestAnimationFrame(frame);
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
    if (reduceMotion) { heroFinal(); return; }

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
    if (finePointer && !reduceMotion) {
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

  function initSpotlight() {
    const hero = $('.hero');
    if (!hero || !finePointer || reduceMotion) return;
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

    let lastY = window.scrollY;
    let ticking = false;
    function onScroll() {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 8);
      const menuOpen = document.body.classList.contains('menu-open');
      if (!menuOpen) header.classList.toggle('is-hidden', y > 480 && y > lastY + 2);
      if (y < lastY - 2) header.classList.remove('is-hidden');
      lastY = y;
      if (line) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
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
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          (targets.get(en.target) || []).forEach((e) => e.classList.add('is-in'));
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
      mods.forEach((m) => m.classList.toggle('is-dim', f !== 'all' && m.dataset.phase !== f));
    }));
  }

  /* ======================================================================
     Kontakt podaci i obrazac
     ====================================================================== */
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

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
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
  initCookies();
  initToc();
  initSpotlight();

  // Sakrij završni tekst heroja dok loader traje (bez JS ostaje vidljiv)
  if (stage && !reduceMotion) { reelEl.innerHTML = ''; }

  runLoader().then(() => {
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    initDash();
    runHero();
  });
})();
