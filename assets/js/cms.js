/* ==========================================================================
   Zcore web – blog i klijenti (čitanje iz baze, zajedničko za sve stranice)
   ========================================================================== */
(() => {
  'use strict';

  const cfg = window.ZCORE_CONFIG || {};
  let client = null;

  function db() {
    if (client) return client;
    if (!cfg.supabaseUrl || !cfg.supabaseKey || !window.supabase) return null;
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'zcore-admin' },
    });
    return client;
  }

  const isLocal = /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname) || location.protocol === 'file:';

  function postUrl(slug) {
    return isLocal ? `/objava.html?slug=${encodeURIComponent(slug)}` : `/blog/${encodeURIComponent(slug)}`;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];
  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}.`;
  }

  function readingTime(md) {
    const words = String(md || '').replace(/[#>*_`\[\]()!-]/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  function slugify(s) {
    const map = { č: 'c', ć: 'c', đ: 'dj', š: 's', ž: 'z', Č: 'c', Ć: 'c', Đ: 'dj', Š: 's', Ž: 'z' };
    return String(s || '').replace(/[čćđšžČĆĐŠŽ]/g, (c) => map[c]).toLowerCase()
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  }

  function renderMarkdown(md) {
    const raw = window.marked ? window.marked.parse(String(md || ''), { breaks: true, gfm: true }) : esc(md).replace(/\n/g, '<br>');
    return window.DOMPurify ? window.DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] }) : raw;
  }

  /* ---------- Jedinstvena naslovna slika za svaku objavu ----------
     Kad objava nema svoju sliku, pravi se crno-bijela grafika iz naslova:
     ista pravila za sve objave, ali svaka izgleda drugačije. */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let s = seed || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; };
  }
  function coverSVG(post, opts = {}) {
    const key = post.slug || post.title || 'zcore';
    const r = rng(hash(key));
    const dark = opts.dark != null ? opts.dark : r() > .45;
    const bg = dark ? '#0A0A0A' : '#F4F4F2';
    const fg = dark ? '#FFFFFF' : '#0A0A0A';
    const line = dark ? 'rgba(255,255,255,.08)' : 'rgba(10,10,10,.08)';
    const W = 1200, H = 675;
    const cell = [60, 80, 100, 120][Math.floor(r() * 4)];
    let grid = '';
    for (let x = cell; x < W; x += cell) grid += `<path d="M${x} 0V${H}" stroke="${line}"/>`;
    for (let y = cell; y < H; y += cell) grid += `<path d="M0 ${y}H${W}" stroke="${line}"/>`;
    // dijagonala iz znaka (≈50°) na nasumičnom mjestu
    const dx = 200 + r() * 800;
    const slope = .84;
    const diag = `<path d="M${dx} 0 L${dx - H / slope} ${H}" stroke="${fg}" stroke-width="${10 + Math.floor(r() * 26)}" opacity=".9"/>`;
    // ugao iz znaka u jednom od uglova
    const corner = Math.floor(r() * 4);
    const cs = 120 + r() * 120;
    const cx = corner % 2 ? W - 40 : 40, cy = corner > 1 ? H - 40 : 40;
    const sx = corner % 2 ? -1 : 1, sy = corner > 1 ? -1 : 1;
    const cornerPath = `<path d="M${cx} ${cy} h${sx * cs} C${cx + sx * cs * .55} ${cy + sy * 6} ${cx + sx * 12} ${cy + sy * cs * .45} ${cx + sx * 4} ${cy + sy * cs} Z" fill="${fg}"/>`;
    // veliki obrisni broj / slovo
    const big = esc((post.number != null ? String(post.number).padStart(2, '0') : (post.title || 'Z').trim().charAt(0).toUpperCase()));
    // slovo ide dolje, na suprotnu stranu od ugla (da se ne preklapaju)
    const right = corner === 2 ? true : corner === 3 ? false : r() > .5;
    const bx = right ? W - 60 : 60;
    const anchor = right ? 'end' : 'start';
    const bigText = `<text x="${bx}" y="${H - 70}" text-anchor="${anchor}" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="${300 + Math.floor(r() * 120)}" letter-spacing="-12" fill="none" stroke="${fg}" stroke-width="2" opacity=".55">${big}</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><rect width="${W}" height="${H}" fill="${bg}"/>${grid}${diag}${cornerPath}${bigText}</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function coverSrc(post) {
    return post.cover_url || coverSVG(post);
  }

  /* ---------- Čitanje ---------- */
  const POST_FIELDS = 'id, slug, title, excerpt, category, author, cover_url, published_at';

  async function getPosts({ limit = 50, category = null, excludeSlug = null } = {}) {
    const c = db(); if (!c) return [];
    let q = c.from('posts').select(POST_FIELDS).eq('published', true)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false }).limit(limit);
    if (category) q = q.eq('category', category);
    if (excludeSlug) q = q.neq('slug', excludeSlug);
    const { data, error } = await q;
    if (error) { console.warn('Blog:', error.message); return []; }
    return data || [];
  }

  async function getPost(slug) {
    const c = db(); if (!c) return null;
    const { data, error } = await c.from('posts').select('*').eq('slug', slug).maybeSingle();
    if (error) { console.warn('Objava:', error.message); return null; }
    return data;
  }

  async function getClients() {
    const c = db(); if (!c) return [];
    const { data, error } = await c.from('clients').select('id, name, logo_url, website')
      .eq('visible', true).order('sort', { ascending: true }).order('created_at', { ascending: true });
    if (error) { console.warn('Klijenti:', error.message); return []; }
    return data || [];
  }

  /* ---------- Kartice ---------- */
  function postCard(p, { featured = false } = {}) {
    const date = formatDate(p.published_at);
    return `
      <a class="post-card${featured ? ' post-card--featured' : ''}" href="${postUrl(p.slug)}">
        <span class="post-card__media"><img src="${esc(coverSrc(p))}" alt="" loading="lazy" decoding="async"></span>
        <span class="post-card__body">
          <span class="post-card__meta"><span class="label">${esc(p.category || 'Vijesti')}</span><span class="label">${esc(date)}</span></span>
          <span class="post-card__title">${esc(p.title)}</span>
          ${p.excerpt ? `<span class="post-card__excerpt">${esc(p.excerpt)}</span>` : ''}
          <span class="post-card__more">Pročitaj <span class="arrow" aria-hidden="true">→</span></span>
        </span>
      </a>`;
  }

  function logoItem(c) {
    const img = c.logo_url
      ? `<img src="${esc(c.logo_url)}" alt="${esc(c.name)}" loading="lazy" decoding="async">`
      : `<span class="client-logo__name">${esc(c.name)}</span>`;
    return c.website
      ? `<a class="client-logo" href="${esc(c.website)}" target="_blank" rel="noopener" title="${esc(c.name)}">${img}</a>`
      : `<span class="client-logo" title="${esc(c.name)}">${img}</span>`;
  }

  /* ---------- Sekcije na početnoj ---------- */
  async function initHomeSections() {
    const clientsSec = document.getElementById('klijenti');
    const newsSec = document.getElementById('vijesti');
    if (!clientsSec && !newsSec) return;

    if (clientsSec) {
      const list = await getClients();
      if (list.length) {
        const track = clientsSec.querySelector('[data-clients]');
        const items = list.map(logoItem).join('');
        // Više logotipa: beskonačna traka; malo logotipa: mirni red
        if (list.length >= 5) {
          track.classList.add('clients--marquee');
          track.innerHTML = `<div class="clients__track"><div class="clients__group">${items}</div></div>`;
          clientsSec.hidden = false;
          // popuni traku do širine ekrana i kopiraj je, da nema praznog prostora
          if (window.ZcoreLoop) window.ZcoreLoop(track.querySelector('.clients__track'), 45);
          else track.querySelector('.clients__track').insertAdjacentHTML('beforeend', `<div class="clients__group" aria-hidden="true">${items}</div>`);
        } else {
          track.innerHTML = `<div class="clients__row">${items}</div>`;
        }
        clientsSec.hidden = false;
      }
    }

    if (newsSec) {
      const posts = await getPosts({ limit: 3 });
      if (posts.length) {
        newsSec.querySelector('[data-news]').innerHTML = posts.map((p) => postCard(p)).join('');
        newsSec.hidden = false;
      }
    }
    if (window.ZcoreReveal) window.ZcoreReveal();
  }

  window.ZcoreCMS = {
    db, postUrl, esc, formatDate, readingTime, slugify, renderMarkdown, coverSVG, coverSrc,
    getPosts, getPost, getClients, postCard, logoItem, initHomeSections, isLocal,
  };
})();
