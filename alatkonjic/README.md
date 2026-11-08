# Alat d.o.o. Konjic – web stranica

Nova, statička web stranica za **Alat d.o.o. Konjic** (alatkonjic.com). Svi podaci i fotografije preuzeti su sa postojeće stranice alatkonjic.com i svih njenih podstranica.

## Stranice
| Putanja | Sadržaj |
|---|---|
| `/` | Početna: hero video, brojke, usluge, tehnologija, prednosti saradnje, ISO 9001 |
| `/usluge/` | 9 ključnih sposobnosti, industrije, česta pitanja (`#faq`) |
| `/tehnologija/` | Procesi, mašinski park (22 mašine) s filterom glodanje/tokarenje |
| `/o-nama/` | Historija 1952 – danas (animirani timeline), tim, Konjic, karijera |
| `/kontakt/` | Kontakt podaci, forma za upit, Google mapa (učitava se na klik) |
| `/404.html` | Stranica za grešku |

## Tehnički detalji
- Čisti HTML + CSS + JavaScript, bez frameworka i build koraka → vrlo brzo učitavanje.
- Potpuno responzivno (mobitel, tablet, desktop).
- Animacije: reveal na skrol, brojači, timeline progres, parallax, marquee, prelazi između stranica. Poštuje `prefers-reduced-motion`.
- SEO: meta opisi, Open Graph, `LocalBusiness` schema.org podaci, `sitemap.xml`, `robots.txt`.
- Slike u WebP formatu, lazy loading.

## Kontakt forma
- Na hostingu s PHP-om forma šalje poruku preko `api/contact.php` na `info@alatkonjic.com`.
- Ako PHP nije dostupan (npr. GitHub Pages), forma automatski otvara email klijent s pripremljenom porukom.

## Lokalno pokretanje
Otvorite folder i pokrenite jednostavan server (preporučeno, zbog relativnih putanja):

```bash
python -m http.server 8000
```

Zatim otvorite http://localhost:8000
