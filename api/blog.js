// /blog – stranica bloga s objavama već ugrađenim u HTML (bez čekanja na bazu u pregledniku)
const { getPublicData, readFile, safeJson } = require('./_supabase');

module.exports = async (req, res) => {
  let html = readFile('blog-sablon.html');
  let data = null;
  try { data = await getPublicData(); } catch (e) { data = null; }
  if (data) html = html.replace('</body>', `<script type="application/json" id="public-data">${safeJson(data)}</script>\n</body>`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', data ? 'public, s-maxage=60, stale-while-revalidate=86400' : 'no-store');
  res.status(200).send(html);
};
