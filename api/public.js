// /api/public – objave (bez teksta) i klijenti za početnu stranicu.
// Odgovor se čuva na Vercelovoj mreži najviše 10 s, pa izmjene iz admina
// (brisanje objave ili klijenta) brzo stignu na stranicu.
const { getPublicData } = require('./_supabase');

module.exports = async (req, res) => {
  const data = await getPublicData();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=10');
  res.status(200).send(JSON.stringify(data));
};
