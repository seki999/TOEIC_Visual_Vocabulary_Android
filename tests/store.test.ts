import { expect, it, vi } from "vitest";

it("merges first launch and older settings without resetting explicit preferences", async () => {
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  };
  vi.stubGlobal("window", { localStorage });
  const { defaults, useStore } = await import("../src/store");
  const merge = useStore.persist.getOptions().merge!;
  const current = useStore.getState();
  expect(merge(undefined, current).settings).toEqual(defaults);
  const saved = {
    settings: { enRate: 0.6, zhRate: 1.5, wake: false },
    positions: { list99: 7 },
    wordIds: { list99: "stable" },
  };
  const restored = merge(saved, current);
  expect(restored.settings.enRate).toBe(0.6);
  expect(restored.settings.zhRate).toBe(1.5);
  expect(restored.settings.wake).toBe(false);
  expect(restored.settings.page).toBe("text");
  expect(restored.positions.list99).toBe(7);
  expect(restored.wordIds.list99).toBe("stable");
  vi.unstubAllGlobals();
});
