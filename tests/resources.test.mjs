import { it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateResources } from "../scripts/validate-resources.mjs";
it("validates all actual bundled resources", () => {
  const r = validateResources();
  expect(r.errors).toEqual([]);
  expect(r.total).toBeGreaterThan(0);
});
it("discovers a future List via manifest, allows absent image, rejects broken references", () => {
  const root = mkdtempSync(join(tmpdir(), "toeic-"));
  try {
    mkdirSync(join(root, "data"));
    const w = {
      id: "future",
      word: "future",
      meaning: "未来",
      sourceKey: "x",
      notes: "",
      partOfSpeech: "n.",
      ipa: { uk: "", us: "" },
      collocation: { en: "", zh: "" },
      example: { en: "", zh: "" },
      tags: [],
      images: [],
    };
    writeFileSync(
      join(root, "data/manifest.json"),
      JSON.stringify({
        total: 1,
        lists: [{ id: "list99", count: 1, file: "data/list99.json" }],
      }),
    );
    const save = () =>
      writeFileSync(
        join(root, "data/list99.json"),
        JSON.stringify({ id: "list99", items: [w] }),
      );
    save();
    expect(validateResources(root).missing).toBe(1);
    expect(validateResources(root).errors).toEqual([]);
    w.images.push({ src: "images/list99/missing.webp" });
    save();
    expect(validateResources(root).errors.length).toBeGreaterThan(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
