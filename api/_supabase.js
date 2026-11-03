// Zajedničko za Vercel funkcije: čitanje javnih podataka iz Supabase baze.
// Javni (anon) ključ – isti kao u assets/js/config.js; pravila u bazi (RLS)
// dozvoljavaju samo čitanje objavljenih objava.
const SUPABASE_URL = 'https://dmmqqederqtcyfodjmpn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtbXFxZWRlcnF0Y3lmb2RqbXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDMzNzMsImV4cCI6MjEwOTI3OTM3M30.W-JSqFKlPr1Y36V3-_6l1UpenlzV8x_LgWhn972MSuU';

// Glavna adresa stranice (za canonical i sitemap). Kad pređete na zcore.ba,
// postavite SITE_URL u Vercel → Settings → Environment Variables.
const SITE_URL = (process.env.SITE_URL || 'https://zcoreba.vercel.app').replace(/\/$/, '');

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.json();
}

module.exports = { rest, SITE_URL };
