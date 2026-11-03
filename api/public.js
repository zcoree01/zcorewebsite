// /api/public – objave (bez teksta) i klijenti za početnu stranicu.
// Odgovor se čuva na Vercelovoj mreži (CDN), pa je za posjetioce trenutan.
const { getPublicData } = require('./_supabase');

module.exports = async (req, res) => {
  const data = await getPublicData();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
  res.status(200).send(JSON.stringify(data));
};
