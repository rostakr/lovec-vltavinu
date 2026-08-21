# ART_PIPELINE.md — repository-owned V7 art

## Proč tento dokument

`docs/V7_VISUAL_CONTRACT.md` říká, **jak má level vypadat**. Tento dokument říká, **odkud se produkční obrázek bere** a jak se reprodukuje bez ručního převodu nebo externích vstupních souborů.

Platí pravidlo z `AGENTS.md` a `docs/PROJECT_CONTROL.md`: produkční autoritou je pouze asset v tomto repozitáři, zapsaný v `assets/manifests/assets.json` s ID, typem, relativní URL, rozměrem, byte budgetem, SHA-256 a `disposeOwner`.

## Slavia V7 — jediný produkční build krok

```bash
node tools/art/build-slavia-v7-art.mjs
```

Tento příkaz je autoritativní produkční pipeline. Provede celý řetězec automaticky:

1. spustí repository-owned deterministický raster generátor `tools/art/build-slavia-v7-png.mjs`;
2. vytvoří mezilehlé PNG plate/foreground;
3. automaticky je převede přes `cwebp` na produkční WebP;
4. ověří WebP signaturu, počet bytů a SHA-256 proti `assets/manifests/assets.json`;
5. produkční `.webp` přepíše pouze po úspěšném ověření;
6. mezilehlé PNG i dočasné WebP vždy odstraní.

Výsledkem jsou přesně tyto produkční soubory:

| Soubor | Typ | Rozměr | Role |
|---|---|---|---|
| `assets/textures/terrain/slavia-event-plate-v7.webp` | lossy WebP | 1440×880 | authored terrain plate celé lokality |
| `assets/sprites/foreground/slavia-event-edge-v7.webp` | lossy+alpha WebP | 1440×880 | foreground occlusion (koruny stromů, girlandy) |

### Build dependency

Pipeline vyžaduje CLI `cwebp` z balíčku WebP:

```bash
brew install webp
# nebo
apt install webp
```

`cwebp` se **nespouští ručně**. Wrapper jej volá s kanonickými parametry:

- terrain plate: `-q 92 -m 6`;
- transparentní foreground: `-q 92 -m 6 -alpha_q 95`.

Reprodukovatelnost není založená pouze na předpokladu stejné verze enkodéru: wrapper po konverzi porovná skutečný byte-size a SHA-256 s manifestem. Pokud encoder vytvoří jiný výstup, build selže a existující produkční WebP se nepřepíše.

## Interní raster generátor

`tools/art/build-slavia-v7-png.mjs` je nízkoúrovňová část pipeline. Používá vlastní softwarový rasterizér a PNG encoder v `tools/art/raster.mjs`, žádné síťové vstupy ani externí obrázky.

Tento soubor není samostatný produkční build příkaz. Jeho PNG výstup je pouze mezikrok, který autoritativní wrapper zpracuje a uklidí.

## Souřadnicový kontrakt

Plate je mapován 1:1 na `bounds` levelu z `src/data/levels.js`.

- Slavia bounds: `1800×1100` světových jednotek, plate `1440×880` px, měřítko `0.8 px / jednotka`, tedy **identický poměr stran** — plate se nikdy neroztahuje mimo osu.
- Převod: `ix = wx * 0.8`, `iy = (1100 − wy) * 0.8` (světové `+Y` míří nahoru, obrázkové `+Y` dolů).
- Kanonické cíle (dokumenty, Eva, Franta, vstup do KD) mají v generátoru vyhrazené `CLEAR_ZONES`; žádná malovaná rekvizita se do nich nesmí dostat.
- Výška rekvizit roste v obrázku **nahoru** od bodu dosedu, stejně jako sprity herců.

## Úprava Slavia assetu

1. Uprav repository-owned raster zdroj (`tools/art/build-slavia-v7-png.mjs`, `raster.mjs`, `slavia-props.mjs`).
2. Spusť `node tools/art/build-slavia-v7-art.mjs`.
3. Pokud wrapper hlásí SHA/byte mismatch, vizuální výstup se změnil záměrně — aktualizuj po review odpovídající `metrics.bytes` a `sha256` v manifestu a spusť pipeline znovu.
4. `npm test` — validátor a unit kontrakty ověřují manifest, formát, SHA-256, budget i lifecycle ownership.

Není povolen ruční workflow „vygeneruj PNG → samostatně spusť cwebp → ručně smaž PNG“. Produkční cesta je vždy jeden wrapper příkaz výše.

## Mrtvé assety

Manifest je zároveň seznam toho, co se stahuje. Validátor proto selže, pokud v něm zůstane asset, na jehož ID se produkční runtime nikdy neodkáže. Referenční snímky, provizorní plate a nepoužité rekvizity do manifestu ani do `sw.js` nepatří; jejich historie zůstává v Gitu.

## Známé omezení

Plate Slavie je **procedurálně malovaný** stylizovaný diorama-art, ne fotorealistická malba jako Chlum/Nesměň/Besednice. Kompozice, měřítko postav, hloubka a čitelnost cílů odpovídají vizuálnímu kontraktu; malířská věrnost je nižší. Výměna za ručně/externě autorovanou malbu je možná bez zásahu do runtime: stačí zachovat ID `terrain-slavia-event-plate-v7`, poměr stran `1800:1100` a aktualizovat manifest.
