# PROJECT_CONTROL.md — dokončovací plán a integrační stav

Revize: **2.1 · 23. 7. 2026**  
Repozitář: **`rajekroman/lovec-vltavinu`**

Tento dokument je jediný autoritativní stavový registr projektu. Technické invarianty jsou v `docs/ARCHITECTURE_CONTRACT.md`; pracovní pravidla v `AGENTS.md`.

## 1. Aktuální ověřená realita

- Publikovatelný základ je `main@e137fe389bfd04b9402298b371df13e24fd38104`, vzniklý merge PR #55.
- Produkční `index.html` spouští jediný modulární `src/bootstrap.js`.
- Aktivní runtime používá Three.js, jeden `WebGLRenderer`, jednu ortografickou kameru, jeden fixed-step loop a jednu `GameSession`.
- Kanonické levely jsou `chlum`, `nesmen`, `besednice`, `slavia`.
- Chlum, Nesměň a Besednice jsou sloučené a regresně chráněné.
- HUD, safe-area, input lifecycle, mobilní E2E a GLTF asset runtime byly sloučeny v předchozích integračních krocích.
- Besednice issue #51 / PR #55 je sloučena jako `main@e137fe389bfd04b9402298b371df13e24fd38104`; finální feature head byl `3ae2cceb0b57ac61b628c2ef45d9f09c26360bb9`.
- Workflow `Validate game` #691 na feature headu prošlo úspěšně a doložilo produkční průchod Chlum → Nesměň → Besednice.
- Slavia / KD Slavia vertical slice je rezervována jako issue #61 s povinnou větví `agent/slavia-vertical-slice` a base SHA `e137fe389bfd04b9402298b371df13e24fd38104`; implementace se aktivuje po merge governance issue #60.
- Starý draft PR #20 je nekanonický kompletní snapshot. Nesmí být sloučen ani použit jako nový základ; A0 jej má po ověření unikátních použitelných částí uzavřít jako superseded.

## 2. Neměnná rozhodnutí

| Oblast | Závazné rozhodnutí |
|---|---|
| Repozitář | pouze `rajekroman/lovec-vltavinu` |
| Produkční větev | pouze `main` |
| Runtime | ES moduly + Three.js, jeden renderer/kamera/loop/session |
| Produkční vstup | pouze `src/bootstrap.js` |
| Simulace | fixed step 60 Hz, max delta 100 ms, max 5 substepů |
| Vizuál | 2D transparentní sprity + low-poly GLB |
| UI | HTML/CSS overlay mimo ECS data |
| Ovládání | směrový vstup + jedno tlačítko `AKCE` |
| Kopání | přesně tři úspěšné zásahy |
| Levely | Chlum → Nesměň → Besednice → Slavia |
| Nálezy | stabilní `findingId`, session score, bez inventáře |
| Persistence | žádný nový save systém ani localStorage gameplay stav |
| Assety | manifest-driven preload, lokální GLTFLoader r185 |
| Nasazení | relativní cesty, GitHub Pages, release pouze z `main` |

## 3. Stav pracovních proudů

| Role / balík | Stav | Přijímaný výstup | Integrační brána |
|---|---|---|---|
| A0 koordinace #60 | **ACTIVE** | governance PR a aktivace issue #61 | diff pouze v `docs/PROJECT_CONTROL.md` |
| A1 architektura | **STANDBY** | pouze regresní fix nebo pozdější legacy cleanup | žádná změna architektury během Slavia slice |
| A2 Besednice #51 / PR #55 | **MERGED** | pouze regresní opravy | produkční tok Chlum → Nesměň → Besednice musí zůstat zelený |
| A3 Besednice assety | **INTEGRATED V #55** | pouze regresní opravy | manifest, budget, SHA-256, dispose |
| A4 UI/mobil | **STANDBY** | nezbytný Slavia adaptér až v issue #61 | portrait/landscape, pause/resume, input release |
| A5 audio/výkon | **BLOCKED** | žádný samostatný redesign | aktivovat až po Slavia vertical slice |
| A6 QA | **STANDBY / SUPPORT #61** | testovací kontrakty pro Slavii po aktivaci | unit, validátor, desktop a mobilní smoke |
| A7 release | **BLOCKED** | žádný release | až po Slavii, legacy cleanup a finálním QA |
| Slavia vertical slice #61 | **RESERVED** | `agent/slavia-vertical-slice` po merge #60 | base `e137fe389bfd04b9402298b371df13e24fd38104` |
| Legacy cleanup | **BLOCKED** | odstranění starého runtime | až po zeleném kompletním průchodu čtyř levelů |
| PR #20 snapshot | **SUPERSEDED / TO CLOSE** | pouze audit unikátních souborů | nesloučit jako celek |

## 4. Integrační fronta do dokončení projektu

### Brána 0 — koordinační review Besednice — dokončeno

**Vlastník:** A0, podpora A6.  
**Aktuální PR:** #55 — sloučeno jako `e137fe389bfd04b9402298b371df13e24fd38104`.  
**Ověřený feature head:** `3ae2cceb0b57ac61b628c2ef45d9f09c26360bb9`.  
**Workflow:** `Validate game` #691 — success.

Ověřený tok:

```text
dokončená Nesměň
→ briefing Besednice
→ tři jednorázové stopy
→ odemčený ježkový profil
→ tři rytmické zásahy
→ finding
→ Karel
→ recovery
→ level:complete(nextLevelId: "slavia")
```

### Brána 1 — Slavia / KD Slavia vertical slice

**Aktivace:** po merge governance issue #60.  
**Vlastník:** A2, assety A3, nezbytný UI adaptér A4, QA A6.  
**Issue:** #61.  
**Větev:** `agent/slavia-vertical-slice`.  
**Base SHA:** `e137fe389bfd04b9402298b371df13e24fd38104`.

**Kanonický průchod:**

```text
dokončená Besednice
→ briefing Malše / KD Slavia
→ příchod k rozpoznatelné budově
→ registrace sbírky
→ interakce se znalcem / porotou
→ vyhodnocení findingů a score
→ finální výsledek akce „Na Zelené Vlně“
→ možnost zahájit novou čistou session
```

**Acceptance criteria:**

1. produkční přechod z Besednice bez debug URL;
2. 3D nebo hybridní rozpoznatelná budova KD Slavia načtená z manifestu;
3. výsledek vychází pouze z aktuální `GameSession` a `findingId` z předchozích levelů;
4. žádný inventář, ukládání nebo import/export;
5. finální obrazovka je čitelná v portrait, landscape i desktopu;
6. restart vytvoří čistou session a vrátí hráče na titulní obrazovku;
7. jeden draft PR s kompletním HANDOFFem a mobilním důkazem.

### Brána 2 — celoproduktový obsahový a vizuální polish

**Vlastník:** A3, s úzkými opravami A2/A4.  
**Cíl:** odstranit produkční placeholdery a sjednotit čitelnost bez změny questového rozsahu.

**Povinné kontroly:**

- unikátní siluety hráče, klíčových NPC, traktoru a Karla;
- animace pohybu ve všech levelech;
- konzistentní měřítko stromů, traktoru, profilů/děr a budovy;
- manifest bez 404, duplicitních ID a překročených rozpočtů;
- žádné nepoužité assety načítané produkčním preloaderem;
- portrait a landscape screenshot každého levelu.

### Brána 3 — audio a výkonový hardening

**Vlastník:** A5, podpora A1/A6.  
**Větev:** přidělí A0 z aktuálního `main` po Bráně 2.

**Povinné výstupy:**

- audio se odemkne pouze uživatelským gestem;
- pause/background/resume nevytváří duplicitní track;
- hudba a ambient nejsou agresivně krátká smyčka;
- jednotné hlasitostní skupiny a mute;
- měření FPS, frame time, paměti a load time;
- adaptivní DPR nejvýše 2 a interní render plocha v kontraktu;
- rozumné velikosti audio a obrazových souborů.

### Brána 4 — odstranění legacy runtime

**Vlastník:** A1, nezávislé ověření A6.  
**Podmínka:** kompletní čtyřlevelový průchod je zelený na aktuálním `main`.

**Odstranit nebo definitivně odpojit:**

- `game.js`;
- `runtime-stability.js`;
- Canvas monolit a opravné vrstvy;
- legacy save/import/export kód;
- zastaralé testy a dokumentaci, které odkazují na pět levelů nebo starý runtime.

**Brána:** build a E2E musí prokázat, že produkční HTML importuje pouze kanonický bootstrap a žádný legacy modul.

### Brána 5 — finální QA

**Vlastník:** A6.  
**Povinná matice:**

- desktop Chromium;
- iPhone portrait;
- iPhone landscape;
- titulní obrazovka a opakované PLAY;
- kompletní průchod všech čtyř levelů;
- přesně tři zásahy každého kopání;
- přechody scén;
- dialog open/close;
- pause/resume;
- background/foreground;
- otočení zařízení;
- ztráta focusu;
- rychlé opakované vstupy;
- neúspěšný asset load;
- restart čisté session;
- dvě po sobě jdoucí zelená spuštění stejného headu.

Žádný blocker nebo critical defect nesmí zůstat otevřený.

### Brána 6 — produkční release

**Vlastník:** A7, schvaluje A0.  
**Výstup:** jeden release z `main`.

**Povinné kroky:**

1. zelené CI na release headu;
2. produkční build z čistého checkoutu;
3. GitHub Pages deploy;
4. smoke test skutečné produkční URL na desktopu a mobilu;
5. kontrola PWA metadat, ikon, relativních cest a service worker cache;
6. licence a původ assetů;
7. velikostní report;
8. release notes a známá omezení;
9. distribuční artefakt a SHA-256 manifest;
10. tag/verze podle rozhodnutí A0.

## 5. Aktivní integrační pořadí

```text
1. Review a merge PR #55 Besednice — dokončeno (`e137fe389bfd04b9402298b371df13e24fd38104`)
2. Governance update issue #60 na nový main SHA — aktivní
3. Slavia vertical slice issue #61 — rezervováno
4. Vizuální/content polish
5. Audio a výkonový hardening
6. Legacy runtime cleanup
7. Finální QA — dvě zelená spuštění
8. Produkční GitHub Pages release
```

Žádný krok nesmí přeskočit přímou závislost.

## 6. Pravidla aktivace odborného chatu

A0 do zadání vždy uvede:

```text
Issue:
Role:
Base SHA:
Větev:
Povolené cesty:
Zakázané cesty:
Závislosti:
Acceptance criteria:
Povinné testy:
Integrační pořadí:
```

Bez těchto údajů se odborný chat neaktivuje.

## 7. Formát stavového hlášení

```text
Identifikátor úkolu:
Role:
Větev:
Issue / PR:
Base SHA / head SHA:
Změněné soubory:
Změněné kontrakty:
Testy a výsledky:
Mobilní důkaz:
Známé problémy:
Blokace:
Doporučený další krok:
```

## 8. Kritéria dokončení celého projektu

Projekt lze označit za dokončený pouze tehdy, když:

- všechny čtyři levely tvoří jeden produkční průchod;
- finále vyhodnotí session sbírku a umožní čistý restart;
- neexistuje druhý runtime ani produkční import legacy save kódu;
- desktop, iPhone portrait a landscape E2E jsou zelené;
- stejný release head projde dvakrát po sobě;
- GitHub Pages URL projde smoke testem;
- nejsou otevřené blocker/critical chyby;
- dokumentace odpovídá skutečnému `main`;
- release vznikl z `main`, nikoli ze ZIPu, sandboxu nebo starého draft PR.
