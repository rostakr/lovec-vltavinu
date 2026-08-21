const isPlainObject = value => Boolean(value)
  && typeof value === "object"
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const isId = value => (typeof value === "string" && value.length > 0)
  || (Number.isInteger(value) && value >= 0);
const isNullableId = value => value === null || isId(value);
const isFiniteNumber = value => Number.isFinite(value);
const isNonNegative = value => isFiniteNumber(value) && value >= 0;
const isLiteralThree = value => value === 3;
const isBoolean = value => typeof value === "boolean";
const isString = value => typeof value === "string";
const isNullableString = value => value === null || isString(value);
const isObject = value => isPlainObject(value);
const isVector = value => isPlainObject(value)
  && Object.keys(value).every(key => ["x", "y", "length"].includes(key))
  && isFiniteNumber(value.x)
  && isFiniteNumber(value.y)
  && (value.length === undefined || isNonNegative(value.length));
const isAxisValue = value => isFiniteNumber(value) || isVector(value);

const shape = (required = {}, optional = {}) => Object.freeze({
  required: Object.freeze(required),
  optional: Object.freeze(optional)
});

export const EVENT_CONTRACTS = Object.freeze({
  "app:boot:start": shape({ initialScene: isString }),
  "app:boot:complete": shape({ initialScene: isString }),
  "app:dispose": shape(),

  "scene:transition:start": shape({ from: isNullableString, to: isString }),
  "scene:transition:complete": shape({ from: isNullableString, to: isString }),
  "scene:transition:error": shape({ from: isNullableString, to: isString, message: isString }),

  "input:pressed": shape({ name: isString, value: isFiniteNumber }),
  "input:released": shape({ name: isString, value: isFiniteNumber }, { reason: isString }),
  "input:axis": shape({ name: isString, value: isAxisValue }),
  "input:reset": shape({ reason: isString }),

  "asset:load:start": shape({ id: isString, type: isString }),
  "asset:load:complete": shape({ id: isString, type: isString }),
  "asset:load:error": shape({ id: isString, type: isString, message: isString }),

  "interaction:available": shape({ entity: isId, kind: isString, label: isString }),
  "interaction:cleared": shape({ entity: isId }),
  "interaction:performed": shape({ actor: isId, target: isId, kind: isString }),

  "dig:start": shape({ spot: isId, requiredHits: isLiteralThree }),
  "dig:hit": shape({ spot: isId, hit: isNonNegative, requiredHits: isLiteralThree, quality: isFiniteNumber }),
  "dig:miss": shape({ spot: isId, misses: isNonNegative }),
  "dig:complete": shape({ spot: isId, hits: isLiteralThree }, { misses: isNonNegative, clean: isBoolean }),
  "dig:clean": shape({ spot: isId }),

  "finding:collected": shape({
    findingId: isId,
    locality: isString,
    rarity: isString,
    weight: isNonNegative,
    score: isNonNegative
  }),
  "danger:changed": shape({ previous: isNonNegative, current: isNonNegative, cause: isString }),
  "danger:caught": shape({ hazard: isId, consequence: isString }),
  "objective:progress": shape({ id: isString, current: isNonNegative, required: isNonNegative }),
  "objective:complete": shape({ id: isString, levelId: isString }),
  "level:complete": shape({ levelId: isString, nextLevelId: isNullableString, score: isNonNegative }),

  "collision:enter": shape({ a: isId, b: isId, normal: isVector, depth: isNonNegative }),
  "collision:stay": shape({ a: isId, b: isId, normal: isVector, depth: isNonNegative }),
  "collision:exit": shape({ a: isId, b: isId }),

  "animation:frame": shape({ entity: isId, clip: isString, frame: isId }),
  "animation:complete": shape({ entity: isId, clip: isString }),
  "hud:model:changed": shape({ revision: isNonNegative, model: isObject }),
  "audio:state": shape({ state: isString }, { trackId: isString })
});

export const GAME_EVENT_NAMES = Object.freeze(Object.keys(EVENT_CONTRACTS));

export function validateEventPayload(type, payload, contracts = EVENT_CONTRACTS) {
  const contract = contracts[type];
  if (!contract) throw new Error(`Unknown event type: ${type}`);
  if (!isPlainObject(payload)) throw new TypeError(`Payload for ${type} must be a plain object.`);

  const allowed = new Set([
    ...Object.keys(contract.required),
    ...Object.keys(contract.optional)
  ]);
  const unexpected = Object.keys(payload).filter(key => !allowed.has(key));
  if (unexpected.length) {
    throw new TypeError(`Unexpected payload field(s) for ${type}: ${unexpected.join(", ")}`);
  }

  for (const [key, validator] of Object.entries(contract.required)) {
    if (!Object.hasOwn(payload, key)) throw new TypeError(`Missing payload field for ${type}: ${key}`);
    if (!validator(payload[key])) throw new TypeError(`Invalid payload field for ${type}: ${key}`);
  }
  for (const [key, validator] of Object.entries(contract.optional)) {
    if (Object.hasOwn(payload, key) && !validator(payload[key])) {
      throw new TypeError(`Invalid payload field for ${type}: ${key}`);
    }
  }
  return payload;
}
