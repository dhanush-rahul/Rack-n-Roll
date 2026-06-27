// In-process TTL cache for read-heavy endpoints.
//
// Intentionally backend-agnostic: every call site goes through this thin module
// so the Map store can later be swapped for Redis (see roadmap in
// .cursor/plans/backend_read_caching_a8cc4041.plan.md) without touching services.

const DEFAULT_TTLS = {
  leaderboard: 30 * 1000,
  standings: 30 * 1000,
  scoresheet: 15 * 1000,
  discover: 120 * 1000,
};

const SWEEP_INTERVAL_MS = 60 * 1000;

const store = new Map();

let config = {
  enabled: resolveDefaultEnabled(),
  ttls: { ...DEFAULT_TTLS },
};

function resolveDefaultEnabled() {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  if (process.env.CACHE_ENABLED === undefined) {
    return true;
  }

  return String(process.env.CACHE_ENABLED).toLowerCase() === 'true';
}

// Allow app startup to override runtime config from validated env.
const configure = (overrides = {}) => {
  if (typeof overrides.enabled === 'boolean') {
    config.enabled = overrides.enabled;
  }

  if (overrides.ttls && typeof overrides.ttls === 'object') {
    config.ttls = { ...config.ttls, ...overrides.ttls };
  }
};

const isEnabled = () => config.enabled;

const ttls = () => config.ttls;

// Deterministic key fragment for objects so identical queries map to one entry.
const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const get = (key) => {
  const hit = store.get(key);
  if (!hit) {
    return undefined;
  }

  if (hit.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }

  return hit.value;
};

const set = (key, value, ttlMs) => {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
};

const del = (key) => {
  store.delete(key);
};

const delByPrefix = (prefix) => {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
};

const clear = () => {
  store.clear();
};

const getOrSet = async (key, ttlMs, loader) => {
  if (!config.enabled) {
    return loader();
  }

  const cached = get(key);
  if (cached !== undefined) {
    return cached;
  }

  const value = await loader();
  set(key, value, ttlMs);
  return value;
};

// Lazy expiry handles correctness; this sweep just keeps dead keys from leaking
// memory. unref() so it never holds the process open during shutdown.
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}, SWEEP_INTERVAL_MS);

if (typeof sweepTimer.unref === 'function') {
  sweepTimer.unref();
}

module.exports = {
  DEFAULT_TTLS,
  configure,
  isEnabled,
  ttls,
  stableStringify,
  get,
  set,
  del,
  delByPrefix,
  clear,
  getOrSet,
};
