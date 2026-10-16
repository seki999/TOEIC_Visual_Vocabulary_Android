import { describe, it, expect } from "vitest";
import { asset, fieldText, language, type List, type Word } from "../src/types";
import { safePosition } from "../src/data";
const word = {
  id: "one",
  word: "abstain",
  meaning: "戒除",
  example: { en: "He abstains.", zh: "他戒酒。" },
} as Word;
describe("reused data semantics", () => {
  it("preserves field and language mapping", () => {
    expect(fieldText(word, "example.en")).toBe("He abstains.");
    expect(language("meaning")).toBe("zh-CN");
    expect(language("word")).toBe("en-US");
  });
  it("resolves bundled paths", () =>
    expect(asset("/images/list01/a.webp", "/")).toBe("/images/list01/a.webp"));
  it("restores stable word IDs after reordering and clamps deleted entries", () => {
    const list = { items: [{ id: "two" }, word] } as List;
    expect(safePosition(list, 0, "one")).toBe(1);
    expect(safePosition(list, 99, "deleted")).toBe(1);
    expect(safePosition(list, -4)).toBe(0);
  });
});
