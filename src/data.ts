import { asset, type List, type Manifest } from "./types";
export async function loadLibrary(): Promise<List[]> {
  const read = async (file: string) => {
    const r = await fetch(asset(file));
    if (!r.ok) throw Error(`无法读取内置资源：${file}`);
    return r.json();
  };
  const manifest: Manifest = await read("data/manifest.json");
  return Promise.all(manifest.lists.map((m) => read(m.file) as Promise<List>));
}
export function safePosition(list: List, index: number, wordId?: string) {
  const found = wordId ? list.items.findIndex((w) => w.id === wordId) : -1;
  return found >= 0
    ? found
    : Math.max(
        0,
        Math.min(list.items.length - 1, Number.isFinite(index) ? index : 0),
      );
}
