# Game Mechanics Integration Guide

Quick reference for understanding and extending game mechanics in Moldavite Hunter.

## 🎮 Core Game Flow

```
Player enters level (GridScene.enter)
  ↓
Environment theme applied (EnvironmentTheme.apply)
  ↓
Game loop begins (GameLoop)
  ├─ Input handling (InputManager)
  ├─ Movement (GridScene.updateMovement)
  ├─ Interaction (GridScene.tryInteract)
  └─ Rendering (GridSceneVisuals)
  ↓
Player attempts dig → completeDig(siteIndex)
  ├─ Resolve findings (DigMechanics.resolveDig)
  ├─ Generate finding (resolveOreFinding)
  ├─ Check for danger (resolveDanger)
  └─ Update score (currentScore += score)
  ↓
Player talks to NPC → performNPCDialog(npcId)
  ├─ Get conversation (DialogueSystem.getConversation)
  ├─ Show dialog (ScreenController.showDialog)
  └─ Handle choice (DialogueSystem.handleChoice)
  ↓
Level complete → evaluateLevel
  ├─ Check objectives (evaluateObjective)
  ├─ Calculate rating (LevelEvaluation.calculateRating)
  └─ Show results (ScreenController.showLevelResult)
```

## 🎯 Using DigMechanics

### Basic Usage
```javascript
const digMechanics = new DigMechanics();
const difficulty = "normal"; // easy, normal, hard
const digSiteData = createDigSite("chlum", 0);

// Resolve a complete dig
const result = digMechanics.resolveDig(digSiteData, difficulty);

// Result structure:
{
  siteIndex: 0,
  danger: null or { type: "tractor", message: "⚠️ TRAKTOR BLÍZKO!", damage: 1 },
  finding: { findingId: "...", rarity: "A", score: 500, ... },
  score: 575, // Including perfect bonus
  perfect: true
}
```

### Difficulty Scaling
```javascript
digMechanics.getRequiredHits("hard");     // 4
digMechanics.getDangerChance("hard");     // 0.35 (35%)
digMechanics.config.dangerChanceByDifficulty;
// { easy: 0.15, normal: 0.25, hard: 0.35 }
```

## 🗣️ Using DialogueSystem

### Basic Setup
```javascript
const dialogueSystem = new DialogueSystem();

// Get NPC conversation
const dialogue = dialogueSystem.getConversation("farmer-vaclav");
// { name, title, avatar, text, options: [...] }

// Show to player, then handle their choice
const result = dialogueSystem.handleChoice("farmer-vaclav", 0); // option index
// result: { effect, nextState, npc }
```

### Available NPCs
- **farmer-vaclav** (Chlum): Permission granting, tractor warnings
- **forester-jan** (Nešmen): Permission & cleanup enforcement
- **expert-eva** (Bešednice): Advice on best dig sites
- **guide-franta** (Slavia): History & guard warnings

### Adding New NPC
```javascript
// In DialogueSystem.js, add to NPC_DIALOGUES:
"blacksmith-peter": {
  name: "Petr",
  title: "Kovář",
  location: "newlocation",
  avatar: "🔨",
  conversations: {
    first: {
      text: "Ahoj! Mohu ti pomoci.",
      options: [
        { text: "Co máš?", next: "offer" }
      ]
    },
    offer: {
      text: "Mohu vylepšit tvé nářadí.",
      options: [
        { text: "Zajímavé!", next: "default" }
      ],
      effect: { type: "unlock-upgrade" }
    }
  }
}
```

## 🎨 Using EnvironmentTheme

### Apply Theme to Scene
```javascript
const theme = new EnvironmentTheme(THREE);
theme.apply(scene, "chlum");
// Applies:
// - Lighting (ambient + directional)
// - Fog with location-specific color & density
// - Hazard colors

// Or get specific values:
theme.getColor("primary");        // #5C4033 (Chlum)
theme.getHazardColor();           // #CC0000 (Chlum tractor)
theme.getPalette();               // Full color object
```

### Theme Colors
```javascript
// Chlum (field)
{
  sky: 0x87CEEB, grass: 0x2D5016, soil: 0x5C4033,
  water: 0x4A90E2, accent: 0xCC0000
}

// Nešmen (forest)
{
  treeDark: 0x1B4D1B, treeMid: 0x2D5016, moss: 0x6B8E23,
  scientific: 0x8B7355
}

// Bešednice (quarry)
{
  clay: 0xC19A6B, terracotta: 0xE2B48F, vegetation: 0x4CAF50,
  rust: 0xA0522D
}

// Slavia (castle)
{
  stoneCastle: 0x808080, brick: 0xA0522D, gold: 0xD4AF37,
  mystery: 0x4B0082
}
```

## 📊 Using LevelEvaluation

### Evaluate Level Performance
```javascript
const evaluator = new LevelEvaluation();

const gameState = {
  findings: [...],        // Array of finding objects
  score: 750,            // Current score before bonuses
  timeSeconds: 180,      // Total time spent
  dangerCount: 1,        // Number of dangers triggered
  digSitesVisited: 3,
  objectiveComplete: true
};

const result = evaluator.evaluateLevel("chlum", gameState);
// {
//   rating: { level: "VYNIKAJÍCÍ", icon: "⭐⭐⭐", color: "#FFD700" },
//   findings: 3,
//   findingDetails: { total: 3, byRarity: { A: 1, B: 1, C: 1 }, display: "💎1 ⭐1 🔑1" },
//   score: {
//     findings: 750,
//     completion: 200,
//     speed: 250,
//     perfection: 100,
//     total: 1300
//   },
//   stats: {
//     timeDisplay: "3:00",
//     dangers: 1,
//     ...
//   },
//   progression: { nextLevel: "nesmen", message: "..." }
// }
```

### Rating Thresholds
```javascript
// Chlum: excellent 1000, good 600, pass 300
// Nešmen: excellent 1800, good 1200, pass 600
// Bešednice: excellent 2500, good 1500, pass 800
// Slavia: excellent 3500, good 2000, pass 1200

// Perfect run: Excellent + 0 dangers
// Good run: Good score + 0-1 dangers
// Okay run: Pass score
// Failed: Incomplete objectives
```

## 🎯 Using Objectives System

### Check Level Objectives
```javascript
import { evaluateObjective, isObjectiveComplete } from "./Objectives.js";

const runtime = {
  permit: true,          // Talked to NPC?
  dug: 3,               // Dig sites completed
  findings: 5,          // Items found
  // ... level-specific fields
};

const obj = evaluateObjective("nesmen", runtime);
// {
//   text: "Les je uklizený",
//   complete: true,
//   progress: 0.95,  // 0-1 scale
//   current: { permit: true, dug: 3, ... },
//   target: { permit: true, dug: 3, ... }
// }

if (isObjectiveComplete("nesmen", runtime)) {
  // Level is won!
}
```

### Level-Specific Objectives

**Chlum:**
- Get permission from Václav
- Find surface finding
- Collect minimum findings (3 target 500 pts)

**Nešmen:**
- Get permission from Jan
- Complete 3 profiles (dig sites)
- Fill/restore all sites
- Collect minimum findings (5 target 1200 pts)

**Bešednice:**
- Get advice from Eva
- Dig in dry zone (specific quadrant)
- Collect minimum findings (4 target 1500 pts)

**Slavia:**
- Talk to František
- Collect 3 documents
- Collect minimum findings (8 target 3000 pts)

## 🎮 Extending GridScene

### Add Custom Dig Site Type
```javascript
// In GridScene.js completeDig():
if (digResult.finding) {
  this.levelFindings.push(digResult.finding);
  this.currentScore += digResult.score;
  
  // Add custom handling:
  if (digResult.finding.rarity === "A") {
    this.events.emit("rare-find", digResult.finding);
    // Trigger special animation, sound, etc.
  }
}
```

### Add Custom Objective Check
```javascript
// In enter() method:
this.onObjectiveCheck = () => {
  const runtime = {
    permit: this.npcSpoken.has("farmer-vaclav"),
    findings: this.levelFindings.length,
    // ... your custom fields
  };
  
  return evaluateObjective(this.levelId, runtime);
};
```

## 🎨 Screen Display Methods

### Show Finding
```javascript
screenController.showFinding({
  finding: { rarity: "A", score: 500 },
  icon: "💎",
  score: 575,      // With bonuses
  perfect: true
});
```

### Show Danger
```javascript
screenController.showDanger(
  "⚠️ TRAKTOR BLÍZKO!",
  () => {
    // Resume gameplay
    screenController.play();
  }
);
```

### Show Level Result
```javascript
const result = levelEvaluation.generateResultScreen("chlum", gameState);

screenController.showLevelResult({
  kicker: result.kicker,        // "VYNIKAJÍCÍ"
  title: result.title,          // "Chlum - Pole po dešti"
  text: result.text,            // "Perfektní! Vyhnul jsi se..."
  score: result.score.total,    // 1300
  stats: result.stats,          // [{ label, value }, ...]
  buttonLabel: "POKRAČOVAT",
  onContinue: () => {
    app.changeScene("title");
  }
});
```

## 🔧 Common Modifications

### Change Danger Chance
```javascript
const digMechanics = new DigMechanics({
  config: {
    dangerChanceByDifficulty: {
      easy: 0.1,      // Reduced from 0.15
      normal: 0.2,    // Reduced from 0.25
      hard: 0.4       // Increased from 0.35
    }
  }
});
```

### Adjust Finding Scores
```javascript
// In DigMechanics.js, DIG_SITE_VARIANTS:
{
  index: 0,
  location: "chlum",
  variants: [
    { rarity: "C", weight: 1, score: 100 },  // Increased from 50
    { rarity: "B", weight: 0.5, score: 300 }, // Increased from 200
    { rarity: "A", weight: 0.1, score: 600 }  // Increased from 500
  ]
}
```

### Custom Scoring Formula
```javascript
// In GridScene.js completeDig():
const difficulty = this.session.state.difficulty || "normal";
const multiplier = {
  easy: 0.8,
  normal: 1.0,
  hard: 1.5
}[difficulty];

const finalScore = Math.round(digResult.score * multiplier);
this.currentScore += finalScore;
```

## 📱 Mobile Controls Integration

```javascript
// MobileController automatically handles:
// - D-Pad input → Input.axes.move
// - Action button → Input.actions.action
// - Pause button → Input.actions.pause
// - Swipe gestures → Custom event handling

// No additional code needed, works transparently with
// InputManager and GridScene update methods
```

## 🎯 Debugging Tips

### Check Current State
```javascript
console.log(gridScene.currentScore);      // Current score
console.log(gridScene.levelFindings);     // All findings
console.log(gridScene.digSitesCompleted); // Dug sites
console.log(gridScene.session.state);     // Session state
console.log(dialogueSystem.getState("farmer-vaclav")); // NPC state
```

### Trigger Events Manually
```javascript
// Force danger
gridScene.events.emit("danger:triggered", {
  type: "test",
  message: "Test danger"
});

// Force finding
gridScene.events.emit("finding:resolved", {
  rarity: "A",
  score: 500,
  findingId: "test-1"
});
```

### Test Objective
```javascript
const isComplete = isObjectiveComplete(levelId, {
  findings: 3,
  permit: true,
  // ... other required fields
});
```

## 🚀 Performance Considerations

- DigMechanics uses lightweight RNG, no significant overhead
- DialogueSystem stores state in Map, O(1) lookup
- LevelEvaluation calculations are instant
- EnvironmentTheme applies once per level
- GridSceneVisuals caches highlight meshes
- Service Worker caches all game files

All systems are optimized for mobile 60fps gameplay.
