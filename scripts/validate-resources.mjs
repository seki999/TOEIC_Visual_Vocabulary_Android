import { readFileSync, existsSync, realpathSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
export function validateResources(root = resolve("public")) {
  const errors = [],
    warnings = [];
  const ids = new Set();
  let total = 0,
    images = 0,
    missing = 0;
  const inside = (path, prefix) => {
    if (
      typeof path !== "string" ||
      !path.startsWith(prefix) ||
      path.includes("\\") ||
      path.includes("..") ||
      /[?#:]/.test(path)
    )
      throw Error(`非法资源路径 ${path}`);
    const full = resolve(root, path),
      r = relative(realpathSync(root), realpathSync(full));
    if (r.startsWith("..") || isAbsolute(r)) throw Error(`资源越界 ${path}`);
    return full;
  };
  const read = (p) =>
    JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
  const manifest = read(resolve(root, "data/manifest.json"));
  if (!Array.isArray(manifest.lists) || !manifest.lists.length)
    throw Error("manifest 没有 List");
  const listIds = new Set();
  for (const entry of manifest.lists) {
    try {
      if (listIds.has(entry.id)) throw Error(`重复 List ID ${entry.id}`);
      listIds.add(entry.id);
      const list = read(inside(entry.file, "data/"));
      if (
        list.id !== entry.id ||
        !Array.isArray(list.items) ||
        list.items.length !== entry.count ||
        !list.items.length
      )
        throw Error(`${entry.id} ID/数量不匹配或空 List`);
      for (const w of list.items) {
        if (!w.id || ids.has(w.id)) throw Error(`无效或重复词汇 ID ${w.id}`);
        ids.add(w.id);
        for (const key of [
          "word",
          "meaning",
          "partOfSpeech",
          "sourceKey",
          "notes",
        ])
          if (typeof w[key] !== "string") throw Error(`${w.id} 缺少 ${key}`);
        for (const [key, keys] of [
          ["ipa", ["uk", "us"]],
          ["collocation", ["en", "zh"]],
          ["example", ["en", "zh"]],
        ])
          for (const k of keys)
            if (typeof w[key]?.[k] !== "string")
              throw Error(`${w.id} 缺少 ${key}.${k}`);
        if (!Array.isArray(w.images) || !Array.isArray(w.tags))
          throw Error(`${w.id} 图片/标签非数组`);
        if (!w.images.length) {
          missing++;
          warnings.push(`${entry.id}/${w.id} 无图片，允许`);
        }
        for (const picture of w.images) {
          if (!existsSync(resolve(root, picture.src)))
            throw Error(`${w.id} 引用图片不存在：${picture.src}`);
          inside(picture.src, `images/${entry.id}/`);
          images++;
        }
      }
      total += list.items.length;
    } catch (e) {
      errors.push(e.message);
    }
  }
  if (total !== manifest.total)
    errors.push(`manifest.total=${manifest.total}，实际 ${total}`);
  return {
    errors,
    warnings,
    total,
    lists: manifest.lists.length,
    images,
    missing,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const r = validateResources();
    r.warnings.forEach((w) => console.warn(w));
    console.log(JSON.stringify({ ...r, warnings: r.warnings.length }, null, 2));
    if (r.errors.length) process.exitCode = 1;
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
}
