# Changelog

## 7.0.0 — V7: vizuální přestavba všech lokalit

Každá lokalita dostává authored terrain plate, samostatnou foreground occlusion vrstvu a bounds-safe kameru sledující hráče. Gameplay, quest pravidla ani architektura runtime se přitom nemění.

- **Chlum** (#207 / PR #208) — pole po dešti, integrovaný traktor, action frames hledače.
- **Nesměň** (#213 / PR #214) — vrstevnatý les, rytmické kopání, průhledná foreground occlusion.
- **Besednice** (#217 / PR #218) — jílový lom, ježková vrstva, landscape-safe frustum.
- **KD Slavia** — venkovní sběratelská akce u Malše: nový plate `terrain-slavia-event-plate-v7`,
  foreground vrstva `foreground-slavia-event-edge-v7`, `resolveSlaviaV7CameraZoom` a reprodukovatelný
  generátor grafiky `tools/art/build-slavia-v7-art.mjs`.

### Úklid preloadu

Z manifestu, offline cache i stromu zmizelo 7 assetů (4,26 MB), které po V7 přestavbě už žádná scéna
nevykresluje — mimo jiné 3MB referenční snímek Nesměně a provizorní plate Besednice a Slavie.
`tools/validate.mjs` nově selže, pokud manifest obsahuje asset, na který se runtime neodkazuje.

### Odstranění legacy runtime a save kódu

Dokončen integrační krok 6: z repozitáře zmizely `audio.js`, `data.js`, distribuční ZIP,
`BUILD_REPORT.txt` a celá zmrazená save vrstva (`LegacySaveAdapter`, `LegacyDataAdapter`, `GameState`,
`docs/save-schema.md`). Validátor jejich návrat i jakoukoli persistenci v `src/` nově odmítá.

## 6.x

Modulární ES-module runtime s jedním Three.js `WebGLRenderer`, ortografickou kamerou, in-memory session
bez save systému a inventáře, dotykovým ovládáním pro iPhone portrait i landscape a service workerem
pouze jako distribuční cache.

## 5.1 — Reálnější lokality (historické)

- Chlum: otevřené zvlněné pole, vzdálený les, hluboké výkopy, haldy hlíny a strniště.
- Ločenice: řídký borový les, světlé písčité podloží, valy, jámy a popadané kmeny.
- Besednice: rozrytá těžební plocha, pásové stopy, zemní valy, hlubší jámy a bagry.
- Slávie: historická fasáda s trojúhelníkovým štítem spojená s moderní bílou přístavbou a proskleným parterem.

Ločenice není v cílové V7 verzi samostatný level; kanonické lokality jsou Chlum, Nesměň, Besednice a KD Slavia.
