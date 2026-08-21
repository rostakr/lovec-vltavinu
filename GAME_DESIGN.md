# Game Design Document: Moldavite Hunter v8.0

## 📖 Core Game Concept

**Moldavite Hunter** je vzdělávací adventure hra o hledání vzácných českých vltavínů (moldavites) na čtyřech autentických lokalitách v České republice. Hráč se pohybuje po terénu, kopá na vyznačených místech, sbírá naleziště a splňuje cíle každé úrovně.

---

## 🎮 Základní Herní Mechaniky

### 1. Pohyb a Interakce
- **Řízení**: Šipky/WASD pro 8 směrů (diagonály zahrnuty)
- **Rychlost**: 1 tile/stisk = okamžitý pohyb (bez animace)
- **Interakce**: SPACE/CLICK na Adjacent tile = akce (kopání, dialog, sbírání)
- **Kamera**: Isometrická 3/4 perspektiva, sleduje hráče

### 2. Systém Kopání
**Fáze kopání:**
1. Hráč se přibližuje ke zvýrazněnému místu (dig site)
2. Stiskne SPACE → otevře se dialog s počtem úderů
3. Hráč klikne 3x na „KOP" → dig animace se přehraje
4. Systém určí náhodně nalezení a/nebo nebezpečí
5. Výsledek: Nález (vzácný/běžný/standart) nebo selhání

**Nalezení kategorie:**
- **A-Rarity (5%)**: Velkrystalický, tmavě zelený - +500 bodů
- **B-Rarity (25%)**: Normální tvar - +200 bodů  
- **C-Rarity (70%)**: Drobný/oblá forma - +50 bodů

### 3. Nebezpečí (Danger System)
Každé kopání má 20-35% šanci na nebezpečí:
- **Chlum**: Traktor blízko → "TRAKTOR BLÍZKO!" warning
- **Nešmen**: Lesník se blíží → "Lesník kontroluje!" warning
- **Bešednice**: Srpen → "Sucho! Zemina se zbortila!" warning
- **Slavia**: Ostraha → "Podezřelá osoba!" warning

Hráč ztrácí 1 life za nebezpečí. Při 3 neúspěších → Game Over.

### 4. NPC Systém
**Postava Václav (Chlum - farmář):**
- "Vítej na poli! Podívej se na to místo vedle plotu."
- Dává povolení na kopání
- Hlasitě si všímá traktoru

**Postava Jan (Nešmen - lesník):**
- "Může se jen na vyznačených místech. Po sobě zasyp!"
- Kontroluje, zda jsou všechna místa zasypaná
- Důsledný - nesnese neporádek

**Postava Eva (Bešednice - expert):**
- "Krásné naleziště! Toto je vzácné!"
- Dává tipy na nejlepší místa
- Komentuje kvalitu nálezů

**Postava František (Slavia - průvodce):**
- "Mezi ruinami se dají najít dokumenty..."
- Vysvětluje historii lokality
- Upozorňuje na nebezpečí ostrahy

### 5. Objective Systém (Cíle)
Každá úroveň má specifické cíle:

**Chlum (Úroveň 1 - Tutoriál):**
- Cíl: Získej povolení od Václava
- Cíl: Najdi povrchové naleziště vedle plotu
- Cíl: Sbírej naleziště (min. 3, cíl 500 bodů)

**Nešmen (Úroveň 2 - Strategie):**
- Cíl: Promluv si s lesníkem
- Cíl: Vykopej 3 profily (zásypaná místa)
- Cíl: Všechna místa zasyp (restore mechanic)
- Cíl: Sbírej naleziště (min. 5, cíl 1200 bodů)

**Bešednice (Úroveň 3 - Puzzle):**
- Cíl: Poradí ti Eva (expert)
- Cíl: Vykopej v quadrantu se suchým pískem
- Cíl: Sbírej naleziště (min. 4, cíl 1500 bodů)
- Cíl: Vyhni se borongům (ježci - decorative)

**Slavia (Úroveň 4 - Challenge):**
- Cíl: Promluv s františkem
- Cíl: Najdi 3 dokumenty mezi ruinami
- Cíl: Sbírej naleziště (min. 8, cíl 3000 bodů)
- Cíl: Vyhni se ostraze (hazard)

### 6. Scoring System
```
Score = (Finding Value × Rarity Bonus) + Completion Bonus + Speed Bonus

Finding Value:
- A-Rarity: +500
- B-Rarity: +200
- C-Rarity: +50

Bonuses:
- Completion (splnit cíl): +100-500
- Speed (< 50% času): +100-250
- Perfect (bez chyb): +200
```

---

## 🎨 Vizuální Design Prostředí

### Paleta barev a atmosféra pro každou lokalitu:

### Chlum - Pole po dešti
**Tema:** Zemědělství, čerstvá ornice, přírodní realismus

**Barvy:**
- Půda: #5C4033 (tmavě hnědá)
- Tráva: #2D5016 (tmavě zelená)
- Voda: #4A90E2 (kalné modré)
- Nebe: #87CEEB (jasně modré)
- Traktor: #CC0000 (červený akcent - nebezpečí)

**Vizuální prvky:**
- Brazdovité hnědé ornice (grid texture)
- Kaluže vody po dešti (random puddles)
- Izolované keře a tráva
- Plot na okraji
- Traktor na dálce (animovaný hazard)
- Sluníčko + mraky

**Mood:** Obnova, příroda, bezpečí
**Hudba:** Lehká, klidná, venkovská

---

### Nešmen - Lesní profily
**Tema:** Les, vědeckost, ochrana přírody

**Barvy:**
- Půda: #3E2B20 (velmi tmavá hnědá - humus)
- Stromy: #1B4D1B (tmavě zelená)
- Bylinky: #556B2F (olivově zelená)
- Mech: #6B8E23 (khaki zelená)
- Profesionální fixace: #8B7355 (béžová - vědecky věcné)

**Vizuální prvky:**
- Vysoké jehličnany a listnáče
- Husté vegetace v pozadí
- Vědecké značky/fixace dig sites (drátěné značky)
- Profesionální obnažené profily (cross-section view)
- Mechnatí kameny
- Lesníkův dům na dálce

**Mood:** Věda, péče, příroda
**Hudba:** Mírně mysteriózní, les - zvuky ptáků

---

### Bešednice - Lom
**Tema:** Těžba, geologie, industriální historie

**Barvy:**
- Jíl: #C19A6B (křídový okr, béžová)
- Hlína: #8B6914 (tmavá okrová)
- Terracotta: #E2B48F (světlejší oker)
- Skála: #696969 (tmavý šedý granit)
- Vegetace: #4CAF50 (svěží zelená - obnova)

**Vizuální prvky:**
- Exponované stěny lomu (různé vrstvy)
- Staré těžební stroje (rezavé - decorative)
- Nové vegetace zarůstající do lomu
- Stohy hlíny a štěrku
- Stopy těžby (terasy)
- Ježci v trní (decorative, ne hazard)

**Mood:** Průmysl vs. Příroda, ekologická восстановление
**Hudba:** Industriální prvky + přírodní zvuky

---

### Slavia - Hrad
**Tema:** Historie, architektura, tajemství

**Barvy:**
- Kamenná přístavba: #808080 (středně šedá)
- Historické zdivo: #A9A9A9 (světlá šedá)
- Mecích a rozpadlých míst: #6B8E23 (khaki-zelená)
- Červené cihly: #A0522D (sienna)
- Zlaté detaily: #D4AF37 (Gold accents - dokumenty)

**Vizuální prvky:**
- Romantické zříceniny hradu
- Exponované základy a zdivo
- Historické artefakty (kosy, nástroje)
- Mechnaté zdi s zvětralaným kamenem
- Archivní dokumenty na zemi (collectibles)
- Ostraha v tajemné uniformě

**Mood:** Mystery, příběh, minulost
**Hudba:** Historická, orchestrální, dramatická

---

## 🧩 Level Layout Design

### Chlum Field Layout (50×37 grid)
```
     Tractor hazard path →
     [==============]
    
[Václav NPC] ← Povolení        ← Hráč start
                              [Dig Site #1] ← Cíl
[Traktor routes on path]

[Pozemek] - Poля, Plot, Kaluže
```

### Nešmen Forest Layout (47×37 grid)
```
    [Lesník NPC]
         ↓
  [Dig Site 1] [DS 2]
  
  [DS 3]
  
  [Dense Forest - nehod cestou]
```

### Bešednice Quarry Layout (50×40 grid)
```
[Eva - Expert]        [Dry zone]
                      [DS 1-3] ← Cíl kopání
[Těžební stroje]      
                      [Vegetace]
                      [DS 4-6]
```

### Slavia Castle Layout (56×45 grid)
```
[František - průvodce]    [Zříceniny hradu]
                         [Dokumenty 1-3]
[Ostraha routes]          [Dig Sites 1-10]

[Historické artefakty]    [Mystery]
```

---

## ⚙️ Game Loop - Co se dělá v každém kroku

1. **Input Phase**: Čtení klávesnice/Touch
2. **Movement Phase**: Validace pohybu, update pozice hráče
3. **Interaction Check**: Jsou blízko NPC/Dig/Document?
4. **Hazard Check**: Je nebezpečí aktivní? Zvýšit danger meter
5. **Rendering**: Vykreslit hráče, prostředí, HUD
6. **Audio**: Přehrát zvuky (kroky, digání, dialog)
7. **Victory Check**: Jsou splněny všechny cíle?

---

## 📊 Progression & Difficulty Curve

**Chlum**: Tutorial - Učení základů (kopání, sbírání)
**Nešmen**: Strategie - Zavádění omezení (restore, čistota)
**Bešednice**: Puzzle - Kombinace cílů a environmentálních výzev
**Slavia**: Challenge - Všechny mechaniky dohromady + Maximum nebezpečí

---

## 🎯 Player Agency & Choices

Hráč se rozhoduje:
1. Který dig site vybeřu k kopání? (Riziko vs. Potenciál bodů)
2. Kdy se mám schovat před traktorem? (Strategie vs. Speed)
3. Zda kopat více pro perfekci či postoupit dál? (Completionism vs. Progression)
4. Jaké obtížnosti jsem schopen? (Difficulty selection)

---

## 🎪 Visual Polish & Feel

- **Screen Shake**: Při nebezpečí (toggle v settings)
- **Particle Effects**: Prach při kopání, sprej vody
- **Sound Design**: Kroky na písku/hlíně, zvuk kopání, varování
- **Color Feedback**: Dig sites blikají, NPCs zvýrazněny
- **Animation**: Hráč se otočí k cíli před akcí

