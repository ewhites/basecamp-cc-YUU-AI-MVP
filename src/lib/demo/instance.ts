import { seedStore } from "./sample";
import { emptyStore, type Store } from "./store";

const KEY = "__yuuAiLabStore";
/** Bump when the schema or seed changes, so a running dev server reseeds instead of keeping old data. */
const VERSION = 3;

/** The process-wide demo store, seeded with the deterministic sample data on first use. */
export function getStore(): Store {
  const g = globalThis as unknown as Record<string, (Store & { version?: number }) | undefined>;
  if (!g[KEY] || g[KEY]!.version !== VERSION) {
    const s = emptyStore();
    seedStore(s);
    g[KEY] = Object.assign(s, { version: VERSION });
  }
  return g[KEY]!;
}

/** Test helper: start again from freshly seeded sample data. */
export function resetStore(): Store {
  (globalThis as unknown as Record<string, Store | undefined>)[KEY] = undefined;
  return getStore();
}
