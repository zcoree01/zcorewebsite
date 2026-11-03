/* Zcore web – stranica bloga i šablon objave */
(() => {
  'use strict';
  const C = window.ZcoreCMS;
  if (!C) return;
  const page = document.body.dataset.page;

  function emptyState(title, text) {
    return `<div class="blog-empty" style="grid-column:1/-1"><span class="label">Blog</span><h2>${C.esc(title)}</h2><p>${C.esc(text)}</p></div>`;
  }

  /* ---------- Lista objava ---------- */
  async function initList() {
    const grid = document.getElementById('posts');
    const catsEl = document.getElementById('cats');
    if (!C.db()) { grid.innerHTML = emptyState('Prve objave stižu uskoro.', 'Pratite nas i na Instagramu @zcore.ba.'); return; }

    const all = await C.getPosts({ limit: 100 });
    if (!all.length) { grid.innerHTML = emptyState('Prve objave stižu uskoro.', 'Pratite nas i na Instagramu @zcore.ba.'); return; }

    const params = new URLSearchParams(location.search);
    let active = params.get('kategorija') || 'all';

    const cats = [...new Set(all.map((p) => p.category).filter(Boolean))];
    if (cats.length > 1) {
      catsEl.innerHTML = ['all', ...cats].map((c) =>
        `<button type="button" class="filter" data-cat="${C.esc(c)}" aria-pressed="${c === active}">${c === 'all' ? 'Sve' : C.esc(c)}</button>`).join('');
      catsEl.hidden = false;
      catsEl.addEventListener('click', (e) => {
        const b = e.target.closest('[data-cat]');
        if (!b) return;
        active = b.dataset.cat;
        catsEl.querySelectorAll('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        const url = new URL(location.href);
        if (active === 'all') url.searchParams.delete('kategorija'); else url.searchParams.set('kategorija', active);
        history.replaceState(null, '', url);
        render();
      });
    }

    function render() {
      const list = active === 'all' ? all : all.filter((p) => p.category === active);
      grid.innerHTML = list.length
        ? list.map((p, i) => C.postCard(p, { featured: i === 0 && active === 'all' })).join('')
        : emptyState('Nema objava u ovoj kategoriji.', 'Izaberite drugu kategoriju.');
      // pojavljivanje kartica jedna za drugom
      grid.querySelectorAll('.post-card').forEach((el, i) => {
        el.animate([{ opacity: 0, transform: 'translate3d(0,24px,0)' }, { opacity: 1, transform: 'none' }],
          { duration: 700, delay: Math.min(i, 8) * 70, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
      });
    }
    render();
  }

  /* ---------- Jedna objava (šablon) ---------- */
  function currentSlug() {
    const q = new URLSearchParams(location.search).get('slug');
    if (q) return q;
    const m = location.pathname.match(/\/blog\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function setMeta(name, value, attr = 'name') {
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', value);
  }

  function notFound() {
    document.title = 'Objava nije pronađena – Zcore';
    document.getElementById('post').innerHTML = `
      <div class="container post-404">
        <span class="label">Greška 404</span>
        <h1 class="post-title">Ova objava ne postoji.</h1>
        <p class="post-lead">Možda je uklonjena ili je adresa pogrešno upisana.</p>
        <a class="btn btn--primary" href="/blog">Sve vijesti <span class="arrow" aria-hidden="true">→</span></a>
      </div>`;
  }

  async function initPost() {
    const slug = currentSlug();
    const art = document.getElementById('post');
    if (!slug || !C.db()) { notFound(); return; }
    const p = await C.getPost(slug);
    if (!p) { notFound(); return; }

    const f = (k) => art.querySelector(`[data-f="${k}"]`);
    f('category').textContent = p.category || 'Vijesti';
    f('title').textContent = p.title;
    if (p.excerpt) f('excerpt').textContent = p.excerpt; else f('excerpt').remove();
    f('date').textContent = C.formatDate(p.published_at);
    f('read').textContent = C.readingTime(p.content);
    f('author').textContent = p.author || 'Zcore';
    const cover = f('cover');
    cover.src = C.coverSrc(p);
    cover.alt = p.cover_url ? p.title : '';
    f('content').innerHTML = C.renderMarkdown(p.content);
    // vanjski linkovi u novom tabu
    f('content').querySelectorAll('a[href^="http"]').forEach((a) => {
      if (!a.href.includes(location.hostname)) { a.target = '_blank'; a.rel = 'noopener'; }
    });
    f('content').querySelectorAll('img').forEach((img) => { img.loading = 'lazy'; img.decoding = 'async'; });
    art.setAttribute('aria-busy', 'false');
    if (!p.published) {
      const badge = document.createElement('div');
      badge.className = 'label';
      badge.style.cssText = 'background:var(--ink);color:var(--paper);padding:6px 10px;border-radius:8px;align-self:flex-start';
      badge.textContent = 'Nacrt · vidi se samo adminu';
      art.querySelector('.post-hero__in').prepend(badge);
    }

    // SEO i dijeljenje
    const url = location.origin + C.postUrl(p.slug);
    document.title = `${p.title} – Zcore`;
    setMeta('description', p.excerpt || p.title);
    setMeta('og:title', p.title, 'property');
    setMeta('og:description', p.excerpt || '', 'property');
    setMeta('og:url', url, 'property');
    if (p.cover_url) setMeta('og:image', p.cover_url, 'property');
    const enc = encodeURIComponent(url);
    art.querySelector('[data-share="linkedin"]').href = `https://www.linkedin.com/sharing/share-offsite/?url=${enc}`;
    art.querySelector('[data-share="facebook"]').href = `https://www.facebook.com/sharer/sharer.php?u=${enc}`;
    art.querySelector('[data-share="whatsapp"]').href = `https://wa.me/?text=${encodeURIComponent(p.title + ' ' + url)}`;
    art.querySelector('[data-share="copy"]').addEventListener('click', async () => {
      const note = document.getElementById('shareNote');
      try { await navigator.clipboard.writeText(url); note.textContent = 'Link je kopiran.'; }
      catch (e) { note.textContent = url; }
      setTimeout(() => { note.textContent = ''; }, 2500);
    });

    // Još objava: prvo ista kategorija, pa ostale
    let rel = await C.getPosts({ limit: 3, category: p.category, excludeSlug: p.slug });
    if (rel.length < 3) {
      const more = await C.getPosts({ limit: 6, excludeSlug: p.slug });
      more.forEach((x) => { if (rel.length < 3 && !rel.some((r) => r.slug === x.slug)) rel.push(x); });
    }
    if (rel.length) {
      const sec = document.getElementById('related');
      sec.querySelector('[data-related]').innerHTML = rel.map((x) => C.postCard(x)).join('');
      sec.hidden = false;
    }
  }

  if (page === 'blog') initList();
  if (page === 'post') initPost();
})();
