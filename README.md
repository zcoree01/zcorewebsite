# Zcore Production – web stranica

Statična web stranica (HTML, CSS, JS bez build koraka) za Zcore Production, prema dizajnu iz Zcore brend priručnika. Blog i logotipi klijenata čitaju se iz Supabase baze, a uređuju u admin panelu.

Objavljeno na **https://zcore.ba** (Vercel; svaki push na granu se sam objavi). `zcore.ba` i `zcoreba.vercel.app` trajno preusmjeravaju na `zcore.ba`.

## Stranice

| Adresa | Fajl | Sadržaj |
| --- | --- | --- |
| `/` | `index.html` | Početna: loader, animirani hero, „Vjeruju nam”, moduli, uloge, sigurnost, najnovije vijesti, kontakt |
| `/blog` | `blog-sablon.html` + `api/blog.js` | Sve objave, najnovija istaknuta, filter po kategoriji |
| `/blog/<slug>` | `objava.html` | Jedinstveni šablon za svaku objavu (rewrite u `vercel.json`) |
| `/admin` | `admin.html` | Admin panel: objave i klijenti |
| `/privatnost`, `/uslovi`, `/kolacici` | | Pravne stranice |

## Blog i „Vjeruju nam”

- **Baza**: Supabase. Šema (tabele, pravila pristupa, bucket za slike) je u `supabase/schema.sql`.
- **Povezivanje**: u `assets/js/config.js` upisati `supabaseUrl` i javni (publishable) ključ. To smije biti u kodu: čitati se može samo objavljeno, a pisati samo admin.
- **Admini**: e-pošte u tabeli `admin_emails`. Nalog se pravi u Supabaseu: *Authentication → Users → Add user* (e-pošta + lozinka, „Auto Confirm User”).
- **Objave**: pišu se u Markdownu (alatna traka u adminu). Bez naslovne slike stranica sama napravi jedinstvenu crno-bijelu grafiku iz naslova. Nacrti i zakazane objave se ne vide javno.
- **Klijenti**: logo (PNG/SVG), naziv, web, redoslijed, prikaži/sakrij. Sekcija na početnoj se sama sakrije dok nema vidljivih klijenata; od 5 logotipa naviše postaje pokretna traka.
- Bez povezane baze stranica normalno radi: blog prikaže „Prve objave stižu uskoro”, a sekcije na početnoj su skrivene.

## Brzina

- Funkcije rade u Frankfurtu (`regions: fra1`), pored baze.
- `/blog` i `/blog/<slug>` dolaze s podacima već ugrađenim u HTML; odgovori se keširaju na Vercelovoj mreži najviše 10 s, pa izmjene iz admina brzo stignu na stranicu.
- Početna čita objave i klijente iz keširanog `/api/public`.
- Biblioteka za bazu (`assets/vendor/supabase.js`) učitava se samo u adminu i pri slanju obrasca.
- Fontovi su na našem serveru (`assets/fonts`), bez Google Fonts.

## SEO

- Naslov, opis, canonical, Open Graph slika (`assets/img/og-image.png`) i Twitter kartica na svim stranicama.
- Strukturirani podaci (JSON-LD): Organization, WebSite, SoftwareApplication, FAQPage (sekcija „Česta pitanja”), a za objave BlogPosting i BreadcrumbList.
- `/sitemap.xml` pravi Vercel funkcija `api/sitemap.js` (sve stranice + objavljene objave, automatski).
- `/blog/<slug>` služi funkcija `api/post.js`: naslov, opis, sliku i podatke za Google upisuje na serveru.
- `robots.txt`: indeksira sve osim `/admin` i `/api/`.
- Glavna adresa je `https://zcore.ba` (HTML, `robots.txt`, `sitemap.xml`, `api/_supabase.js`); može se promijeniti i varijablom `SITE_URL` u Vercelu.

## Animacije

- **Loader**: Zcore znak se sklapa, traka napretka, izlaz dijagonalnim brisanjem (samo `transform`, glatko i na starijim računarima).
- **Hero** (jednom, ne ponavlja se): kuca se *Gdje je nalog?*, briše se, „reels” tekst *Šef zove.* → *15 minuta* / *za jednu informaciju.*, kraj *Zcore* / *Proizvodnja na jednom mjestu*.
- Pregled proizvodnje i telefon se „učitavaju” kad dođu na ekran; otkrivanje sekcija pri skrolanju.
- Animacije su iste za sve uređaje. Na slabijim (klasa `.lite`) gase se samo efekti koji prate miš.

## Kontakt obrazac

U `assets/js/main.js` (`CONFIG`): `contactEmail` je postavljen na `kontakt@zcore.ba`; `formEndpoint` je prazan, pa obrazac otvara e-poštu posjetioca s popunjenom porukom. Planirano: slanje preko vlastitog mail servera (Vercel funkcija + SMTP) kad domena bude kupljena.

## Lokalno pokretanje

```bash
python3 -m http.server 8000
# http://localhost:8000  (objave lokalno: /objava.html?slug=<slug>)
```
