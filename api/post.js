// /blog/<slug> – šablon objave s naslovom, opisom, slikom i podacima za Google
// već upisanim na serveru (Google, Facebook, LinkedIn i WhatsApp ih vide odmah).
const fs = require('fs');
const path = require('path');
const { rest, SITE_URL } = require('./_supabase');

let TEMPLATE = null;
function template() {
  if (!TEMPLATE) TEMPLATE = fs.readFileSync(path.join(process.cwd(), 'objava.html'), 'utf8');
  return TEMPLATE;
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON unutar <script> ne smije sadržavati "</script"
const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

function setTag(html, re, tag) {
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `${tag}\n</head>`);
}

module.exports = async (req, res) => {
  const slug = String((req.query && req.query.slug) || '').toLowerCase();
  let html = template();
  let post = null;

  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    try {
      const now = new Date().toISOString();
      const rows = await rest(`posts?select=id,slug,title,excerpt,content,category,author,cover_url,published,published_at,updated_at&slug=eq.${slug}&published=eq.true&published_at=lte.${encodeURIComponent(now)}&limit=1`);
      post = rows[0] || null;
    } catch (e) { post = null; }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!post) {
    // Nema javne objave: šablon i dalje radi u pregledniku (admin vidi svoj nacrt)
    html = html.replace('<meta name="description"', '<meta name="robots" content="noindex">\n<meta name="description"');
    res.setHeader('Cache-Control', 'no-store');
    res.status(404).send(html);
    return;
  }

  const url = `${SITE_URL}/blog/${post.slug}`;
  const title = `${post.title} – Zcore`;
  const desc = post.excerpt || `${post.title}. Blog Zcore Productiona o vođenju proizvodnje.`;
  const image = post.cover_url || `${SITE_URL}/assets/img/og-image.png`;

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = setTag(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}">`);
  html = setTag(html, /<meta property="og:type"[^>]*>/, '<meta property="og:type" content="article">');
  html = setTag(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(post.title)}">`);
  html = setTag(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}">`);
  html = setTag(html, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url)}">`);
  html = setTag(html, /<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(image)}">`);
  html = setTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}">`);
  html = setTag(html, /<meta name="twitter:card"[^>]*>/, '<meta name="twitter:card" content="summary_large_image">');
  html = setTag(html, /<meta property="article:published_time"[^>]*>/, `<meta property="article:published_time" content="${esc(new Date(post.published_at).toISOString())}">`);

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: desc,
    image: [image],
    datePublished: new Date(post.published_at).toISOString(),
    dateModified: new Date(post.updated_at || post.published_at).toISOString(),
    author: { '@type': 'Organization', name: post.author || 'Zcore' },
    publisher: { '@type': 'Organization', name: 'Zcore', logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/img/apple-touch-icon.png` } },
    mainEntityOfPage: url,
    articleSection: post.category || 'Vijesti',
    inLanguage: 'bs',
  };
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zcore', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  };

  // Naslov i opis odmah u HTML-u (vidljivo i bez JavaScripta)
  html = html.replace(/(<h1 class="post-title" data-f="title">)[\s\S]*?(<\/h1>)/, `$1${esc(post.title)}$2`);
  html = html.replace(/(<p class="post-lead" data-f="excerpt">)[\s\S]*?(<\/p>)/, `$1${esc(post.excerpt || '')}$2`);
  html = html.replace(/(<span data-f="category">)[\s\S]*?(<\/span>)/, `$1${esc(post.category || 'Vijesti')}$2`);

  html = html.replace('</head>',
    `<script type="application/ld+json">${safeJson(ld)}</script>\n` +
    `<script type="application/ld+json">${safeJson(crumbs)}</script>\n</head>`);
  // Podaci za preglednik, da ne čeka drugi upit prema bazi
  html = html.replace('</body>', `<script type="application/json" id="post-data">${safeJson(post)}</script>\n</body>`);

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  res.status(200).send(html);
};
