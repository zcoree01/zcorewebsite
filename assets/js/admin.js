/* ==========================================================================
   Zcore web – admin panel (objave i klijenti)
   Pristup imaju samo e-pošte iz tabele admin_emails u bazi.
   ========================================================================== */
(() => {
  'use strict';
  const C = window.ZcoreCMS;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = C.esc;
  const BUCKET = 'media';
  const MAX_UPLOAD = 5 * 1024 * 1024;

  const views = { login: $('#viewLogin'), notice: $('#viewNotice'), app: $('#viewApp') };
  function show(name) { Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; }); }

  let toastT;
  function toast(msg, err = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('is-err', err);
    t.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('is-on'), 2600);
  }

  const sb = C.db();
  if (!sb) {
    $('#noticeTitle').textContent = 'Baza još nije povezana';
    $('#noticeText').textContent = 'U fajl assets/js/config.js treba upisati adresu i javni ključ Supabase projekta.';
    $$('[data-logout]').forEach((b) => { b.hidden = true; });
    show('notice');
    return;
  }

  /* ======================================================================
     Prijava
     ====================================================================== */
  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { show('login'); $('#lEmail').focus(); return; }
    const { data: ok, error } = await sb.rpc('is_admin');
    if (error || !ok) {
      $('#noticeTitle').textContent = 'Nemate pristup';
      $('#noticeText').textContent = `Račun ${session.user.email} nije na listi admina.`;
      show('notice');
      return;
    }
    $('#userEmail').textContent = session.user.email;
    show('app');
    openTab(location.hash === '#klijenti' ? 'clients' : 'posts');
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#loginMsg');
    const btn = $('button[type="submit"]', e.target);
    msg.classList.remove('is-err');
    msg.textContent = 'Prijavljujem…';
    btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: $('#lEmail').value.trim(), password: $('#lPass').value });
    btn.disabled = false;
    if (error) {
      msg.classList.add('is-err');
      msg.textContent = /invalid/i.test(error.message) ? 'Pogrešna e-pošta ili lozinka.' : error.message;
      return;
    }
    msg.textContent = '';
    boot();
  });

  $$('[data-logout]').forEach((b) => b.addEventListener('click', async () => {
    if (dirty && !confirm('Imate nesačuvane izmjene. Ipak se odjaviti?')) return;
    dirty = false;
    await sb.auth.signOut();
    show('login');
  }));

  /* ======================================================================
     Tabovi
     ====================================================================== */
  function openTab(name) {
    $$('.adm-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    $('#tabPosts').hidden = name !== 'posts';
    $('#tabEditor').hidden = true;
    $('#tabClients').hidden = name !== 'clients';
    history.replaceState(null, '', name === 'clients' ? '#klijenti' : '#objave');
    if (name === 'posts') loadPosts();
    if (name === 'clients') loadClients();
  }
  $$('.adm-tab').forEach((t) => t.addEventListener('click', () => {
    if (dirty && !confirm('Imate nesačuvane izmjene. Napustiti uređivanje?')) return;
    dirty = false;
    openTab(t.dataset.tab);
  }));

  /* ======================================================================
     Slike
     ====================================================================== */
  async function upload(file, folder) {
    if (!file) return null;
    if (!file.type.startsWith('image/')) { toast('Izaberite sliku (PNG, JPG, WEBP ili SVG).', true); return null; }
    if (file.size > MAX_UPLOAD) { toast('Slika je veća od 5 MB. Smanjite je pa pokušajte ponovo.', true); return null; }
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    const path = `${folder}/${id}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type });
    if (error) { toast('Učitavanje slike nije uspjelo: ' + error.message, true); return null; }
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /* ======================================================================
     Objave – lista
     ====================================================================== */
  let posts = [];
  function statusOf(p) {
    if (!p.published) return ['Nacrt', ''];
    if (new Date(p.published_at) > new Date()) return ['Zakazano', 'adm-status--later'];
    return ['Objavljeno', 'adm-status--live'];
  }

  async function loadPosts() {
    const list = $('#postsList');
    const { data, error } = await sb.from('posts')
      .select('id, slug, title, excerpt, category, author, cover_url, published, published_at, updated_at')
      .order('published_at', { ascending: false });
    if (error) { list.innerHTML = `<div class="adm-empty">Greška: ${esc(error.message)}</div>`; return; }
    posts = data || [];
    if (!posts.length) {
      list.innerHTML = '<div class="adm-empty"><strong style="color:var(--ink);font-size:18px">Još nema objava.</strong><span>Kliknite „+ Nova objava” da napišete prvu.</span></div>';
      return;
    }
    list.innerHTML = posts.map((p) => {
      const [st, cls] = statusOf(p);
      return `<div class="adm-item" data-id="${p.id}">
        <div class="adm-item__img"><img src="${esc(C.coverSrc(p))}" alt="" loading="lazy"></div>
        <div>
          <div class="adm-item__title">${esc(p.title)}</div>
          <div class="adm-item__meta"><span class="adm-status ${cls}">${st}</span><span>${esc(p.category || '')}</span><span>${esc(C.formatDate(p.published_at))}</span></div>
        </div>
        <div class="adm-item__actions">
          <a class="adm-link" href="${C.postUrl(p.slug)}" target="_blank" rel="noopener">Pogledaj</a>
          <button type="button" class="btn btn--outline btn--sm" data-edit="${p.id}">Uredi</button>
        </div>
      </div>`;
    }).join('');
  }

  $('#postsList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit]');
    if (b) editPost(posts.find((p) => p.id === b.dataset.edit));
  });
  $('#newPost').addEventListener('click', () => editPost(null));

  /* ======================================================================
     Objave – uređivač
     ====================================================================== */
  let current = null;       // objava koja se uređuje (null = nova)
  let coverUrl = null;
  let slugTouched = false;
  let dirty = false;
  const f = {
    title: $('#pTitle'), excerpt: $('#pExcerpt'), content: $('#pContent'), published: $('#pPublished'),
    date: $('#pDate'), category: $('#pCategory'), author: $('#pAuthor'), slug: $('#pSlug'),
  };

  function toLocalInput(iso) {
    const d = iso ? new Date(iso) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function refreshCover() {
    const fake = { slug: f.slug.value || f.title.value || 'nova', title: f.title.value || 'Z', category: f.category.value };
    $('#coverPreview').src = coverUrl || C.coverSVG(fake);
    $('#removeCover').hidden = !coverUrl;
    $('#coverHint').textContent = coverUrl ? 'Vlastita slika.' : 'Bez slike stranica sama napravi jedinstvenu grafiku za ovu objavu (mijenja se s naslovom).';
  }

  async function fillCategories() {
    const { data } = await sb.from('posts').select('category');
    const cats = [...new Set(['Vijesti', 'Iz pogona', 'Savjeti', 'Razvoj', ...((data || []).map((x) => x.category))].filter(Boolean))];
    $('#catList').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
  }

  async function editPost(p) {
    current = p ? { ...p } : null;
    if (p) {
      // učitaj puni sadržaj
      const { data } = await sb.from('posts').select('*').eq('id', p.id).single();
      if (data) current = data;
    }
    const d = current || {};
    f.title.value = d.title || '';
    f.excerpt.value = d.excerpt || '';
    f.content.value = d.content || '';
    f.published.checked = !!d.published;
    f.date.value = toLocalInput(d.published_at);
    f.category.value = d.category || 'Vijesti';
    f.author.value = d.author || 'Zcore';
    f.slug.value = d.slug || '';
    slugTouched = !!d.slug;
    coverUrl = d.cover_url || null;
    $('#editorTitle').textContent = current ? 'Uredi objavu' : 'Nova objava';
    $('#deletePost').hidden = !current;
    const view = $('#viewPost');
    view.hidden = !current;
    if (current) view.href = C.postUrl(current.slug);
    $('#postMsg').textContent = '';
    setMode('write');
    updateCounts();
    refreshCover();
    fillCategories();
    $('#tabPosts').hidden = true;
    $('#tabEditor').hidden = false;
    window.scrollTo(0, 0);
    dirty = false;
    f.title.focus();
  }

  function updateCounts() {
    $('#excerptCount').textContent = `${f.excerpt.value.length}/220`;
    $('#slugHint').textContent = f.slug.value ? `zcoreba.vercel.app/blog/${f.slug.value}` : 'Popuni se sam iz naslova.';
  }

  $('#postForm').addEventListener('input', (e) => {
    dirty = true;
    if (e.target === f.title && !slugTouched) f.slug.value = C.slugify(f.title.value);
    if (e.target === f.slug) { slugTouched = true; f.slug.value = C.slugify(f.slug.value).slice(0, 80) || ''; }
    if (e.target === f.title || e.target === f.slug || e.target === f.category) refreshCover();
    updateCounts();
  });

  $('#editorBack').addEventListener('click', () => {
    if (dirty && !confirm('Imate nesačuvane izmjene. Napustiti uređivanje?')) return;
    dirty = false;
    openTab('posts');
  });
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // Naslovna slika
  $('#pCover').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    $('#coverHint').textContent = 'Učitavam sliku…';
    const url = await upload(file, 'posts');
    if (url) { coverUrl = url; dirty = true; }
    refreshCover();
  });
  $('#removeCover').addEventListener('click', () => { coverUrl = null; dirty = true; refreshCover(); });

  // Pisanje / pregled
  function setMode(mode) {
    $$('.adm-seg [data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    const prev = mode === 'preview';
    $('#mdPreview').hidden = !prev;
    f.content.hidden = prev;
    $('#mdToolbar').style.visibility = prev ? 'hidden' : '';
    if (prev) $('#mdPreview').innerHTML = C.renderMarkdown(f.content.value) || '<p class="muted">Još nema sadržaja.</p>';
  }
  $$('.adm-seg [data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  // Alatna traka za Markdown
  function wrapSel(before, after = before, placeholder = 'tekst') {
    const ta = f.content;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || placeholder;
    ta.setRangeText(before + sel + after, s, e, 'end');
    ta.focus();
    ta.setSelectionRange(s + before.length, s + before.length + sel.length);
    dirty = true;
  }
  function prefixLines(prefix, numbered = false) {
    const ta = f.content;
    let s = ta.selectionStart, e = ta.selectionEnd;
    s = ta.value.lastIndexOf('\n', s - 1) + 1;
    const block = ta.value.slice(s, e) || 'stavka';
    const out = block.split('\n').map((l, i) => (numbered ? `${i + 1}. ` : prefix) + l.replace(/^(#{1,6} |> |- |\d+\. )/, '')).join('\n');
    ta.setRangeText(out, s, e, 'end');
    ta.focus();
    dirty = true;
  }
  function insertBlock(text) {
    const ta = f.content;
    const s = ta.selectionStart;
    const pre = s > 0 && ta.value[s - 1] !== '\n' ? '\n\n' : '';
    ta.setRangeText(`${pre}${text}\n\n`, s, ta.selectionEnd, 'end');
    ta.focus();
    dirty = true;
  }
  $('#mdToolbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-md]');
    if (!b) return;
    const k = b.dataset.md;
    if (k === 'h2') prefixLines('## ');
    if (k === 'h3') prefixLines('### ');
    if (k === 'bold') wrapSel('**');
    if (k === 'italic') wrapSel('*');
    if (k === 'ul') prefixLines('- ');
    if (k === 'ol') prefixLines('', true);
    if (k === 'quote') prefixLines('> ');
    if (k === 'hr') insertBlock('---');
    if (k === 'link') {
      const url = prompt('Adresa linka (https://…)', 'https://');
      if (url && url !== 'https://') wrapSel('[', `](${url})`, 'tekst linka');
    }
  });
  $('#mdImage').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    toast('Učitavam sliku…');
    const url = await upload(file, 'posts');
    if (url) { insertBlock(`![${(file.name || 'slika').replace(/\.[^.]+$/, '').replace(/[[\]]/g, '')}](${url})`); toast('Slika je ubačena.'); }
  });

  // Snimanje
  $('#postForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#postMsg');
    msg.classList.remove('is-err');
    const title = f.title.value.trim();
    const slug = C.slugify(f.slug.value || title);
    if (!title) { msg.classList.add('is-err'); msg.textContent = 'Upišite naslov.'; f.title.focus(); return; }
    if (!slug) { msg.classList.add('is-err'); msg.textContent = 'Adresa (slug) ne može biti prazna.'; f.slug.focus(); return; }
    const row = {
      title, slug,
      excerpt: f.excerpt.value.trim() || null,
      content: f.content.value,
      category: f.category.value.trim() || 'Vijesti',
      author: f.author.value.trim() || 'Zcore',
      published: f.published.checked,
      published_at: f.date.value ? new Date(f.date.value).toISOString() : new Date().toISOString(),
      cover_url: coverUrl,
    };
    const btn = $('#savePost');
    btn.disabled = true;
    msg.textContent = 'Spremam…';
    const res = current
      ? await sb.from('posts').update(row).eq('id', current.id).select().single()
      : await sb.from('posts').insert(row).select().single();
    btn.disabled = false;
    if (res.error) {
      msg.classList.add('is-err');
      msg.textContent = /duplicate|unique/i.test(res.error.message) ? 'Objava s tom adresom (slug) već postoji. Promijenite adresu.' : 'Greška: ' + res.error.message;
      return;
    }
    current = res.data;
    f.slug.value = current.slug;
    slugTouched = true;
    dirty = false;
    $('#editorTitle').textContent = 'Uredi objavu';
    $('#deletePost').hidden = false;
    $('#viewPost').hidden = false;
    $('#viewPost').href = C.postUrl(current.slug);
    const [st] = statusOf(current);
    msg.textContent = `Sačuvano · ${st}${st === 'Nacrt' ? ' (ne vidi se na stranici dok ne uključite „Objavljeno”)' : ''}`;
    toast('Sačuvano.');
  });

  $('#deletePost').addEventListener('click', async () => {
    if (!current || !confirm(`Trajno obrisati objavu „${current.title}”?`)) return;
    const { error } = await sb.from('posts').delete().eq('id', current.id);
    if (error) { toast('Brisanje nije uspjelo: ' + error.message, true); return; }
    dirty = false;
    toast('Objava je obrisana.');
    openTab('posts');
  });

  /* ======================================================================
     Klijenti
     ====================================================================== */
  let clients = [];
  let editingClient = null;
  let clientLogo = null;

  async function loadClients() {
    const box = $('#clientsList');
    const { data, error } = await sb.from('clients').select('*').order('sort', { ascending: true }).order('created_at', { ascending: true });
    if (error) { box.innerHTML = `<div class="adm-empty">Greška: ${esc(error.message)}</div>`; return; }
    clients = data || [];
    if (!clients.length) {
      box.innerHTML = '<div class="adm-empty" style="grid-column:1/-1"><strong style="color:var(--ink);font-size:18px">Još nema klijenata.</strong><span>Dodajte prvog iznad. Sekcija „Vjeruju nam” se na stranici pojavi tek kad postoji bar jedan.</span></div>';
      return;
    }
    box.innerHTML = clients.map((c, i) => `
      <div class="adm-client${c.visible ? '' : ' is-hidden-client'}" data-id="${c.id}">
        <div class="adm-client__logo">${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="${esc(c.name)}">` : `<span>${esc(c.name)}</span>`}</div>
        <div><div class="adm-client__name">${esc(c.name)}</div><div class="adm-client__web">${esc(c.website || 'Bez web stranice')}</div></div>
        <div class="adm-client__actions">
          <button type="button" class="adm-icon" data-move="-1" aria-label="Pomjeri lijevo" ${i === 0 ? 'disabled' : ''}>←</button>
          <button type="button" class="adm-icon" data-move="1" aria-label="Pomjeri desno" ${i === clients.length - 1 ? 'disabled' : ''}>→</button>
          <label class="adm-switch" title="Prikaži na stranici"><input type="checkbox" data-visible ${c.visible ? 'checked' : ''}><span></span></label>
          <span style="flex:1"></span>
          <button type="button" class="adm-link" data-cedit>Uredi</button>
          <button type="button" class="adm-link" data-cdel style="color:#B00020">Obriši</button>
        </div>
      </div>`).join('');
  }

  function resetClientForm() {
    editingClient = null;
    clientLogo = null;
    $('#cName').value = '';
    $('#cWeb').value = '';
    $('#cVisible').checked = true;
    $('#cLogoPrev').innerHTML = 'Bez logotipa';
    $('#clientFormTitle').textContent = 'Novi klijent';
    $('#cSave').textContent = 'Dodaj klijenta';
    $('#cCancel').hidden = true;
    $('#clientMsg').textContent = '';
  }

  $('#cLogo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    $('#cLogoPrev').textContent = 'Učitavam…';
    const url = await upload(file, 'clients');
    if (url) clientLogo = url;
    $('#cLogoPrev').innerHTML = clientLogo ? `<img src="${esc(clientLogo)}" alt="">` : 'Bez logotipa';
  });

  $('#cCancel').addEventListener('click', resetClientForm);

  $('#clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#clientMsg');
    msg.classList.remove('is-err');
    const name = $('#cName').value.trim();
    let web = $('#cWeb').value.trim();
    if (!name) { msg.classList.add('is-err'); msg.textContent = 'Upišite naziv firme.'; $('#cName').focus(); return; }
    if (web && !/^https?:\/\//i.test(web)) web = 'https://' + web;
    const row = { name, website: web || null, logo_url: clientLogo, visible: $('#cVisible').checked };
    let res;
    if (editingClient) res = await sb.from('clients').update(row).eq('id', editingClient.id);
    else res = await sb.from('clients').insert({ ...row, sort: clients.length ? Math.max(...clients.map((c) => c.sort || 0)) + 1 : 0 });
    if (res.error) { msg.classList.add('is-err'); msg.textContent = 'Greška: ' + res.error.message; return; }
    toast(editingClient ? 'Klijent je sačuvan.' : 'Klijent je dodan.');
    resetClientForm();
    loadClients();
  });

  $('#clientsList').addEventListener('click', async (e) => {
    const card = e.target.closest('.adm-client');
    if (!card) return;
    const c = clients.find((x) => x.id === card.dataset.id);
    const idx = clients.indexOf(c);

    if (e.target.closest('[data-cedit]')) {
      editingClient = c;
      clientLogo = c.logo_url;
      $('#cName').value = c.name;
      $('#cWeb').value = c.website || '';
      $('#cVisible').checked = c.visible;
      $('#cLogoPrev').innerHTML = c.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : 'Bez logotipa';
      $('#clientFormTitle').textContent = `Uredi: ${c.name}`;
      $('#cSave').textContent = 'Sačuvaj';
      $('#cCancel').hidden = false;
      $('#clientForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('#cName').focus();
    }

    if (e.target.closest('[data-cdel]')) {
      if (!confirm(`Obrisati klijenta „${c.name}”?`)) return;
      const { error } = await sb.from('clients').delete().eq('id', c.id);
      if (error) { toast('Brisanje nije uspjelo: ' + error.message, true); return; }
      toast('Klijent je obrisan.');
      loadClients();
    }

    const mv = e.target.closest('[data-move]');
    if (mv) {
      const j = idx + Number(mv.dataset.move);
      if (j < 0 || j >= clients.length) return;
      const order = clients.slice();
      [order[idx], order[j]] = [order[j], order[idx]];
      const updates = order.map((x, i) => sb.from('clients').update({ sort: i }).eq('id', x.id));
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error);
      if (err) toast('Promjena redoslijeda nije uspjela.', true);
      loadClients();
    }
  });

  $('#clientsList').addEventListener('change', async (e) => {
    const cb = e.target.closest('[data-visible]');
    if (!cb) return;
    const id = cb.closest('.adm-client').dataset.id;
    const { error } = await sb.from('clients').update({ visible: cb.checked }).eq('id', id);
    if (error) { toast('Greška: ' + error.message, true); cb.checked = !cb.checked; return; }
    toast(cb.checked ? 'Prikazuje se na stranici.' : 'Sakriven sa stranice.');
    loadClients();
  });

  /* ---------- Start ---------- */
  sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') show('login'); });
  boot();
})();
