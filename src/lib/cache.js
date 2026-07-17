// Simple in-memory cache with TTL (default 30 seconds)
const store = new Map();
const DEFAULT_TTL = 30_000;

export const cache = {
    get(key) {
        const entry = store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            store.delete(key);
            return null;
        }
        return entry.data;
    },

    set(key, data, ttl = DEFAULT_TTL) {
        store.set(key, { data, expiresAt: Date.now() + ttl });
    },

    invalidate(...keys) {
        keys.forEach(k => store.delete(k));
    },

    invalidateAll() {
        store.clear();
    },
};
