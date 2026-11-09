// Zajedničko za Vercel funkcije: čitanje javnih podataka iz Supabase baze.
// Javni (anon) ključ – isti kao u assets/js/config.js; pravila u bazi (RLS)
// dozvoljavaju samo čitanje objavljenih objava i vidljivih klijenata.
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://dmmqqederqtcyfodjmpn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtbXFxZWRlcnF0Y3lmb2RqbXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDMzNzMsImV4cCI6MjEwOTI3OTM3M30.W-JSqFKlPr1Y36V3-_6l1UpenlzV8x_LgWhn972MSuU';

// Glavna adresa stranice (za canonical i sitemap). Može se promijeniti
// varijablom SITE_URL u Vercel → Settings → Environment Variables.
const SITE_URL = (process.env.SITE_URL || 'https://zcore.ba').replace(/\/$/, '');

async function rest(p) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${p}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.json();
}

// Javni podaci za blog i početnu: lista objava (bez teksta) i klijenti
async function getPublicData() {
  const now = encodeURIComponent(new Date().toISOString());
  const [posts, clients] = await Promise.all([
    rest(`posts?select=id,slug,title,excerpt,category,author,cover_url,published_at,pinned&published=eq.true&published_at=lte.${now}&order=pinned.desc,published_at.desc&limit=100`).catch(() => []),
    rest('clients?select=id,name,logo_url,website&visible=eq.true&order=sort.asc,created_at.asc').catch(() => []),
  ]);
  return { posts, clients };
}

const cache = {};
function readFile(name) {
  if (!cache[name]) cache[name] = fs.readFileSync(path.join(process.cwd(), name), 'utf8');
  return cache[name];
}

// JSON unutar <script> ne smije sadržavati "</script"
const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

module.exports = { rest, getPublicData, readFile, safeJson, SITE_URL };
