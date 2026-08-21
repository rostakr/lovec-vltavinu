const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
};

export const DIG_REQUIRED_HITS = 3;
export const CONTEXT_ACTION = "action";

const target = (id, kind, positions) => ({
  id,
  kind,
  reachable: true,
  positions,
  interaction: { action: CONTEXT_ACTION, enabled: true }
});

const objective = (id, type, targetId, required, options = {}) => ({
  id,
  type,
  target: targetId,
  required,
  action: CONTEXT_ACTION,
  ...options
});

const definitions = [
  {
    order: 0,
    id: "chlum",
    name: "Chlum",
    title: "Pole po dešti",
    scene: "level",
    theme: "field",
    music: "field",
    text: "Déšť omyl tmavou ornici. Nejdříve je nutné získat souhlas hospodáře a teprve potom hledat mimo dráhu traktoru.",
    goal: "Získej povolení, prohledej povrch pole a najdi první vltavín.",
    briefing: {
      context: "Majitel pole Václav je přímo na místě a traktor už znovu vyráží do brázd.",
      goal: "Promluv s Václavem, prohledej označené místo a odnes povrchový nález."
    },
    spawn: { x: 120, y: 380 },
    bounds: { x: 0, y: 0, width: 1600, height: 1200 },
    walkable: { x: 40, y: 40, width: 1520, height: 1120 },
    objective: { id: "chlum-permission-and-find", type: "chlum-permission-and-find", required: 1 },
    objectives: [
      objective("permission", "dialog", "farmer-vaclav", 1),
      objective("search-surface", "discover", "chlum-search-site", 1),
      objective("record-finding", "collect", "chlum-search-site", 1)
    ],
    targets: [
      target("farmer-vaclav", "npc", [{ x: 560, y: 410 }]),
      target("chlum-search-site", "surface-search", [{ x: 1020, y: 720 }])
    ],
    hazards: ["tractor"],
    assetGroups: ["common", "level:chlum"],
    next: "nesmen"
  },
  {
    order: 1,
    id: "nesmen",
    name: "Nesměň",
    title: "Lesní profily",
    scene: "level",
    theme: "forest",
    music: "forest",
    text: "V lese lze pracovat jen na vyznačených místech. Každá odkrytá díra musí být bezprostředně zasypaná.",
    goal: "Získej souhlas lesníka, vykopej a zasyp 3 profily.",
    briefing: {
      context: "Lesník povolí průzkum pouze tehdy, když po výpravě nezůstane žádná otevřená díra.",
      goal: "Promluv s lesníkem, dokonči tři profily a všechny vrať do původního stavu."
    },
    spawn: { x: 180, y: 980 },
    bounds: { x: 0, y: 0, width: 1500, height: 1200 },
    walkable: { x: 120, y: 140, width: 1260, height: 940 },
    objective: { id: "nesmen-dig-and-restore", type: "nesmen-dig-and-restore", required: 3 },
    objectives: [
      objective("permission", "dialog", "forester", 1),
      objective("dig-profiles", "dig", "forest-profile", 3, { requiredHits: DIG_REQUIRED_HITS }),
      objective("fill-holes", "restore", "forest-profile", 3)
    ],
    targets: [
      target("forester", "npc", [{ x: 280, y: 240 }]),
      target("forest-profile", "dig-site", [
        { x: 610, y: 430 },
        { x: 930, y: 690 },
        { x: 1210, y: 360 }
      ])
    ],
    hazards: ["forester", "noise-alert"],
    assetGroups: ["common", "level:nesmen"],
    next: "besednice"
  },
  {
    order: 2,
    id: "besednice",
    name: "Besednice",
    title: "Ježková vrstva",
    scene: "level",
    theme: "quarry",
    music: "quarry",
    text: "Tři stopy vedou k ježkové vrstvě. Konkurenční hledač čeká, až nález vytáhne někdo jiný.",
    goal: "Promluv s místním znalcem, najdi 3 stopy, vykopej ježek a získej jej zpět od Karla.",
    briefing: {
      context: "Na starém nalezišti čeká místní znalec. Nejdřív vysvětlí, jak číst tři stopy vedoucí k ježkové vrstvě; rival Karel mezitím sleduje každý kvalitní nález.",
      goal: "Promluv se znalcem, prozkoumej všechny stopy, zvládni kopání a nenech Karla s nálezem utéct."
    },
    spawn: { x: 140, y: 1040 },
    bounds: { x: 0, y: 0, width: 1680, height: 1280 },
    walkable: { x: 100, y: 180, width: 1480, height: 980 },
    objective: { id: "besednice-hedgehog-recovery", type: "besednice-hedgehog-recovery", required: 1 },
    objectives: [
      objective("local-briefing", "dialog", "besednice-guide", 1),
      objective("find-traces", "discover", "besednice-trace", 3),
      objective("dig-hedgehog", "dig", "besednice-hedgehog", 1, { requiredHits: DIG_REQUIRED_HITS }),
      objective("recover-hedgehog", "boss", "crystal-karel", 1)
    ],
    targets: [
      target("besednice-guide", "npc", [{ x: 260, y: 980 }]),
      target("besednice-trace", "clue", [
        { x: 470, y: 890 },
        { x: 880, y: 620 },
        { x: 1240, y: 420 }
      ]),
      target("besednice-hedgehog", "dig-site", [{ x: 1430, y: 260 }]),
      target("crystal-karel", "boss", [{ x: 1510, y: 900 }])
    ],
    hazards: ["crystal-karel", "quarry-edge"],
    assetGroups: ["common", "level:besednice"],
    next: "slavia"
  },
  {
    order: 3,
    id: "slavia",
    name: "KD Slavia",
    title: "Na Zelené Vlně",
    scene: "finale",
    theme: "city",
    music: "finale",
    text: "Před KD Slavia čeká znalkyně i zloděj Franta. Sbírka se na akci dostane až po certifikaci.",
    goal: "Dolož původ sbírky, zastav Frantu, získej certifikát a vstup na akci.",
    briefing: {
      context: "Expertka čeká na dokumentaci nálezů, zatímco Franta se pokouší získat nejlepší kámen.",
      goal: "Seber tři složky, promluv se znalkyní, zastav Frantu a nech sbírku certifikovat."
    },
    spawn: { x: 380, y: 860 },
    bounds: { x: 0, y: 0, width: 1800, height: 1100 },
    walkable: { x: 340, y: 120, width: 1360, height: 860 },
    objective: { id: "slavia-certification", type: "slavia-certification", required: 1 },
    objectives: [
      objective("collect-documents", "collect", "documentation-folder", 3),
      objective("consult-expert", "dialog", "expert-eva", 1),
      objective("recover-best-finding", "boss", "thief-franta", 1),
      objective("receive-certificate", "dialog", "expert-eva", 1),
      objective("enter-event", "destination", "kd-slavia", 1)
    ],
    targets: [
      target("documentation-folder", "document", [
        { x: 410, y: 760 },
        { x: 790, y: 460 },
        { x: 1130, y: 780 }
      ]),
      target("expert-eva", "npc", [{ x: 1450, y: 430 }]),
      target("thief-franta", "boss", [{ x: 1020, y: 260 }]),
      target("kd-slavia", "destination", [{ x: 1630, y: 520 }])
    ],
    hazards: ["thief-franta", "traffic"],
    assetGroups: ["common", "level:slavia"],
    next: null,
    final: true
  }
];

export const LEVEL_DEFINITIONS = deepFreeze(definitions);
export const LEVEL_ORDER = Object.freeze(LEVEL_DEFINITIONS.map(level => level.id));
const levelById = new Map(LEVEL_DEFINITIONS.map(level => [level.id, level]));

export function getLevelDefinition(id) {
  return levelById.get(id) ?? null;
}

export function getNextLevelId(id) {
  return getLevelDefinition(id)?.next ?? null;
}

export function getLevelTarget(levelId, targetId) {
  const level = getLevelDefinition(levelId);
  return level?.targets.find(entry => entry.id === targetId) ?? null;
}

export function isLevelTargetReachable(levelId, targetId, required = 1) {
  const level = getLevelDefinition(levelId);
  const entry = getLevelTarget(levelId, targetId);
  if (!level || !entry || entry.reachable !== true || entry.interaction?.enabled !== true) return false;
  if (entry.interaction.action !== CONTEXT_ACTION || entry.positions.length < required) return false;

  const { x, y, width, height } = level.walkable ?? level.bounds;
  return entry.positions.every(position => (
    position.x >= x && position.x <= x + width &&
    position.y >= y && position.y <= y + height
  ));
}
