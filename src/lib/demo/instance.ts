import { seedStore } from "./sample";
import { emptyStore, type Store } from "./store";

const KEY = "__yuuAiLabStore";

/** The process-wide demo store, seeded with the deterministic sample data on first use. */
export function getStore(): Store {
  const g = globalThis as unknown as Record<string, Store | undefined>;
  if (!g[KEY]) {
    const s = emptyStore();
    seedStore(s);
    g[KEY] = s;
  }
  return g[KEY]!;
}

/** Test helper: start again from freshly seeded sample data. */
export function resetStore(): Store {
  (globalThis as unknown as Record<string, Store | undefined>)[KEY] = undefined;
  return getStore();
}
