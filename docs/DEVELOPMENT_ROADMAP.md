# Lovec vltavínů — produktový plán po vydání 6.0

## Aktuální produktový cíl

Lovec vltavínů je statická browser hra pro desktop i mobil, připravená pro GitHub Pages. Hráč projde čtyřmi kanonickými kapitolami: Chlum, Nesměň, Besednice a Malše/KD Slavia. Získané nálezy se počítají pouze v aktuální session a finále je vyhodnotí bez inventářové obrazovky nebo persistentního save systému.

Technický základ je jediný Three.js `WebGLRenderer` s ortografickou kamerou. 2D postavy a efekty jsou PNG/sprite sheets, rekvizity low-poly GLB a HUD zůstává v HTML/CSS nad canvasem. Podrobný závazný kontrakt obsahuje `docs/ARCHITECTURE_CONTRACT.md`.

## Neměnné principy

1. `main` je jediná zveřejnitelná větev a musí zůstat hratelná.
2. Hra má jeden renderer; nevzniká druhý canvasový nebo WebGL runtime.
3. Ovládání tvoří pohyb a jedno kontextové akční tlačítko. Dialog začíná akcí v dosahu, kopání vyžaduje tři zásahy do rytmu.
4. Nevzniká inventář, localStorage save, migrace save ani pokračování mezi relacemi.
5. Service worker slouží výhradně jako cache statických distribučních souborů.
6. Každý asset má manifestové ID, relativní URL, technický rozpočet, checksum a jasného vlastníka dispose.

## Dokončené produktové milníky

- Modulární runtime: `GameApp`, fixed-step `GameLoop`, `SceneManager`, `AssetLoader`, `InputManager`, ECS-lite a samostatné UI adaptéry.
- Kompletní hratelný průchod Chlum → Nesměň → Besednice → Malše/KD Slavia.
- Mobilní ovládání v portrait i landscape, lifecycle reset vstupu, přístupný HUD a dialogy.
- Jediný renderer, kontraktové validace assetů a distribučně omezená offline cache.
- Historický, neměnný release baseline `v6.0.0`; jeho evidence je v `docs/PROJECT_CONTROL.md`.

## Aktivní schválený balík: #154

Jediný post-release feature balík je popsán autoritativně v `docs/PROJECT_CONTROL.md`:

- Nesměň zachovává velkou mýtinu a pískové hromady, obklopené výrazně vysokými stromy v měřítku hráče a NPC.
- Besednice používá široký písčitý lom s jílovými vrstvami.
- Malše/KD Slavia má velkou hratelnou plochu; vysoká stavba KD Slavia je na okraji mapy a odpovídá reálnému neorenesančnímu motivu v Českých Budějovicích.

Rozsah #154 nesmí měnit gameplay pravidla, session kontrakt, renderer ani mobilní vstup. Nové environment textury musí být manifestované, cacheované a testované.

## Distribuční brána pro další vydání

Před sloučením feature PR do `main` musí být zelené:

- `pnpm exec node tools/validate.mjs` bez chyb a varování;
- kompletní `pnpm test:unit`;
- Playwright desktop, iPhone portrait a iPhone landscape smoke;
- vizuální kontrola nových lokalit včetně poměru vysokých stromů a KD Slavia vůči hráči;
- kontrola manifestu, byte budgetů a service-worker cache.

Sloučený feature PR je distribuční kandidát, nikoli automaticky nový GitHub Release. Nový tag nebo Release vyžaduje samostatné release issue, explicitní candidate SHA, vlastní QA gate a nové číslo verze. Historický tag `v6.0.0` se nikdy nepřepisuje.
