# Zcore Production – web stranica

Statična web stranica (HTML, CSS, JS bez build koraka) za Zcore Production, prema dizajnu iz Zcore brend priručnika.

## Stranice

| Fajl | Sadržaj |
| --- | --- |
| `index.html` | Početna: loader, animirani hero, moduli, uloge, sigurnost, kontakt obrazac |
| `privatnost.html` | Politika privatnosti |
| `uslovi.html` | Uslovi korištenja |
| `kolacici.html` | Politika kolačića |
| `404.html` | Stranica za grešku |

## Animacije

- **Loader**: Zcore znak se sklapa (dva ugla + dijagonala), traka napretka, izlaz dijagonalnim brisanjem. Pri ponovnom otvaranju u istoj sesiji kraći je.
- **Hero** (pokreće se jednom, ne ponavlja se):
  1. kuca se *Gdje je nalog?*
  2. tekst se briše
  3. "reels" tekst: *Šef zove.* → *15 minuta* / *za jednu informaciju.*
  4. kraj: *Zcore.* / *Proizvodnja na jednom mjestu.* i stop
- Živi pregled proizvodnje (tajmer zastoja, nalog napreduje), probni telefon s tasterima, otkrivanje sekcija pri skrolanju, filter modula, traka napretka skrolanja.
- Poštuje postavku *smanji kretanje* (prefers-reduced-motion): odmah prikazuje završno stanje.

## Prije objave

1. U `assets/js/main.js`, na vrhu, popunite `CONFIG`:
   - `contactEmail` – e-pošta za kontakt (prikazuje se na stranici).
   - `formEndpoint` – adresa servisa za obrasce, npr. besplatni [Formspree](https://formspree.io) (`https://formspree.io/f/xxxx`). Bez njega obrazac otvara e-poštu posjetioca s popunjenom porukom (ako je `contactEmail` upisan).
2. Zamijenite oznake u uglastim zagradama: `[PUNI NAZIV FIRME]`, `[ADRESA]`, `[ID / PIB BROJ]`, `[DATUM]`, `[E-MAIL ZA PRIVATNOST]` i ostale u pravnim stranicama (`grep -n "\[" *.html`).
3. Pravne tekstove provjerite s pravnikom (označeno s `[POTVRDITI S PRAVNIKOM]`).

## Lokalno pokretanje

```bash
python3 -m http.server 8000
# otvorite http://localhost:8000
```

## Objava

Stranica nema build korak, pa radi na bilo kojem statičnom hostingu:

- **GitHub Pages**: Settings → Pages → Deploy from a branch → `main` / root.
- **Vercel / Netlify**: uvezite repozitorij, bez build komande, izlazni folder je root.
