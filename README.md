# Lovec vltavínů 7.0.0

Mobilní browserová arkádová hra z jihočeských nalezišť vltavínů. Hráč projde čtyři kanonické kapitoly **Chlum → Nesměň → Besednice → KD Slávie**, sestaví výstavní kolekci a získá finální hodnocení poroty.

## Stav produktu

- jeden modulární ES-module runtime spuštěný z `src/bootstrap.js`;
- jeden Three.js `WebGLRenderer` s ortografickou kamerou;
- desktopové ovládání klávesnicí a dotykové ovládání pro iPhone portrait i landscape;
- in-memory herní session bez save systému, `localStorage`, IndexedDB a inventářového UI;
- hudba a zvuky odemykané uživatelským gestem s lifecycle obsluhou pro pozadí, návrat a `pagehide`;
- service worker slouží pouze jako distribuční cache statických souborů;
- plný průchod končí výsledkem poroty a čistým restartem nové výpravy.

## Herní průchod

1. **Chlum** — získání souhlasu, sběr nálezů a vyhýbání se traktoru.
2. **Nesměň** — lesní profily, rytmické kopání a obnova lokality.
3. **Besednice** — hledání stop, vzácný ježek a střet s rivalem.
4. **KD Slávie** — venkovní sběratelská akce u Malše: dokumentace původu, zastavení Franty, certifikace sbírky a finální hodnocení poroty.

Kopání používá tři úspěšné zásahy do rytmu. Veškeré interakce probíhají jedním kontextovým akčním tlačítkem.

## Ovládání

### Desktop

- pohyb: šipky nebo `WASD`;
- akce: kontextové akční tlačítko podle nápovědy ve hře;
- pauza: tlačítko v HUD.

### Mobil

- levá strana: virtuální joystick;
- pravá strana: jedno kontextové akční tlačítko;
- podporovaný je portrait i landscape režim, safe-area a reset vstupu při otočení, ztrátě fokusu nebo návratu z pozadí.

## Lokální spuštění

Projekt je statická webová aplikace. Musí běžet přes HTTP server, ne přímo z `file://`.

```bash
python3 -m http.server 8080
```

Poté otevřete `http://localhost:8080/`.

## Testy

Požadováno je Node.js 24.

```bash
npm install --no-audit --no-fund --no-package-lock
npm test
npm run test:smoke
```

Dostupné příkazy:

- `npm run validate` — statický validátor produktu a architektonických invariantů;
- `npm run validate:modules` — syntaxe všech modulů pod `src/`;
- `npm run test:unit` — unit testy modulárního runtime;
- `npm run test:smoke` — Playwright matice desktop, iPhone portrait, iPhone landscape a audio lifecycle;
- `npm test` — validátor, syntaxe modulů a unit testy.

Produkční grafika V7 Slavie se generuje deterministickým nástrojem bez závislostí:

```bash
node tools/art/build-slavia-v7-art.mjs
```

Pravidla a souřadnicový kontrakt popisuje `docs/ART_PIPELINE.md`.

CI workflow `Validate game` ukládá artefakty `static-validation-report` a `playwright-report`.

## Architektura

Normativní pravidla jsou v:

- `AGENTS.md` — pravidla práce, vlastnictví cest a Definition of Done;
- `docs/ARCHITECTURE_CONTRACT.md` — modulární, eventový, renderovací a datový kontrakt;
- `docs/PROJECT_CONTROL.md` — aktuální integrační stav a certifikační evidence;
- `docs/V7_VISUAL_CONTRACT.md` — vizuální cíl jednotlivých lokalit;
- `docs/ART_PIPELINE.md` — původ, reprodukce a metadata produkčních assetů.

Produkční strom nesmí znovu zavést `game.js`, `runtime-stability.js`, Canvas gameplay runtime, druhý renderer, save migrace ani inventář.

## GitHub Pages

Aplikace používá relativní URL a je připravená pro publikaci z kořene větve `main` přes GitHub Pages.

Po nasazení je nutné ověřit veřejnou URL na desktopu a iPhonu v portrait i landscape režimu. Ověření musí zahrnout titulní obrazovku, celý kanonický průchod, audio po gestu, návrat z pozadí, finální výsledek a čistý restart.

## Release a certifikace

Historicky certifikovaný baseline je `v6.0.0`; kanonický dokončovací balík je veden v issue #100 a formální QA evidence v issue #98. Aktuální post-release změny a jejich distribuční bránu řídí `docs/PROJECT_CONTROL.md` a příslušný feature issue (nyní #154). Nový tag ani GitHub Release se nevytváří automaticky sloučením feature PR: vyžaduje samostatné release issue, explicitní candidate SHA a úplně zelenou QA matici stejného nezměněného SHA.
