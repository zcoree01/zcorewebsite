// /sitemap-blog.xml – sve objavljene objave na blogu (automatski).
// Glavne stranice su u statičnom /sitemap.xml.
const { rest, SITE_URL } = require('./_supabase');

const STATIC = [{ loc: '/blog', priority: '0.8', changefreq: 'daily' }];

const xmlEsc = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

module.exports = async (req, res) => {
  let posts = [];
  try {
    const now = new Date().toISOString();
    posts = await rest(`posts?select=slug,updated_at,published_at&published=eq.true&published_at=lte.${encodeURIComponent(now)}&order=published_at.desc&limit=1000`);
  } catch (e) { /* sitemap i bez objava */ }

  const urls = STATIC.map((u) => `  <url><loc>${SITE_URL}${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`);
  posts.forEach((p) => {
    urls.push(`  <url><loc>${SITE_URL}/blog/${xmlEsc(encodeURIComponent(p.slug))}</loc><lastmod>${new Date(p.updated_at || p.published_at).toISOString()}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
  });

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
};
