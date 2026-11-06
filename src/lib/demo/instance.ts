import { seedStore } from "./sample";
import { emptyStore, type Store } from "./store";
import { SEED_VERSION } from "./sync";

const KEY = "__yuuAiLabStore";

/**
 * The process-wide demo store, seeded with the deterministic sample data on first use.
 * A running dev server reseeds when SEED_VERSION changes instead of keeping old data.
 * Changes made after seeding are shared between servers by sync.ts.
 */
export function getStore(): Store {
  const g = globalThis as unknown as Record<string, (Store & { version?: number }) | undefined>;
  if (!g[KEY] || g[KEY]!.version !== SEED_VERSION) {
    const s = emptyStore();
    s.seeding = true;
    seedStore(s);
    s.seeding = false;
    g[KEY] = Object.assign(s, { version: SEED_VERSION });
  }
  return g[KEY]!;
}

/** Test helper: start again from freshly seeded sample data. */
export function resetStore(): Store {
  (globalThis as unknown as Record<string, Store | undefined>)[KEY] = undefined;
  return getStore();
}
