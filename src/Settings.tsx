import { useEffect, useState } from "react";
import { fields, labels, type Field, type List } from "./types";
import { useStore, type Settings } from "./store";
import { isAndroid, native, type Voice } from "./native";
// Reused Web numeric draft/commit behavior: clearing a number never writes a default mid-edit.
export function NumericInput({
  value,
  min,
  max,
  step = 1,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() {
    const n = Number(draft);
    if (!draft.trim() || !Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const v = Math.max(min, Math.min(max, n));
    setDraft(String(v));
    onCommit(v);
  }
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
export default function SettingsPanel({
  close,
  lists,
}: {
  close: () => void;
  lists: List[];
}) {
  const { settings: c, set } = useStore();
  const [voices, setVoices] = useState<Voice[]>([]);
  useEffect(() => {
    if (isAndroid)
      native
        .getVoices()
        .then((r) => setVoices(r.voices))
        .catch(() => setVoices([]));
  }, []);
  const number = (
    key: keyof Settings,
    title: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label>
      {title}
      <NumericInput
        value={c[key] as number}
        min={min}
        max={max}
        step={step}
        onCommit={(n) => set({ [key]: n })}
      />
    </label>
  );
  const check = (key: keyof Settings, title: string) => (
    <label>
      <input
        type="checkbox"
        checked={Boolean(c[key])}
        onChange={(e) => {
          const checked = e.target.checked;
          if (checked && key === "multiListLoop")
            set({ multiListLoop: true, currentOnly: false, loop: false });
          else if (checked && (key === "loop" || key === "currentOnly"))
            set({
              [key]: true,
              multiListLoop: false,
              [key === "loop" ? "currentOnly" : "loop"]: false,
            });
          else set({ [key]: checked });
        }}
      />
      {title}
    </label>
  );
  function toggle(key: "visible" | "overlay" | "order", f: Field) {
    if (key === "order" && !c.order.includes(f)) {
      // Restore a field to its default position unless the user explicitly reordered the queue.
      const canonical = c.order.every(
        (field, i) =>
          i === 0 || fields.indexOf(c.order[i - 1]) < fields.indexOf(field),
      );
      set({
        order: canonical
          ? fields.filter((field) => field === f || c.order.includes(field))
          : [...c.order, f],
      });
      return;
    }
    set({
      [key]: c[key].includes(f)
        ? c[key].filter((x) => x !== f)
        : [...c[key], f],
    });
  }
  return (
    <div className="scrim">
      <section
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label="学习设置"
      >
        <header>
          <h2>学习设置</h2>
          <button onClick={close}>完成</button>
        </header>
        <h3>循环范围</h3>
        {check("currentOnly", "当前单词循环")}
        {check("loop", "当前 List 循环")}
        {check("multiListLoop", "多个 List 循环")}
        {c.multiListLoop && (
          <fieldset className="playlist-settings">
            <legend>选择循环播放的 List</legend>
            <div className="playlist-actions">
              <button
                onClick={() => set({ loopListIds: lists.map((l) => l.id) })}
              >
                全选 List
              </button>
              <button onClick={() => set({ loopListIds: [] })}>清空选择</button>
            </div>
            {lists.map((l) => (
              <label key={l.id}>
                <input
                  type="checkbox"
                  checked={c.loopListIds.includes(l.id)}
                  onChange={(e) =>
                    set({
                      loopListIds: e.target.checked
                        ? [...c.loopListIds, l.id]
                        : c.loopListIds.filter((id) => id !== l.id),
                    })
                  }
                />
                {l.title}（{l.items.length} 词）
              </label>
            ))}
            <p className="hint">
              已选 {lists.filter((l) => c.loopListIds.includes(l.id)).length} 个
              List，按词库顺序连续播放，最后一个播完后回到第一个。当前 List
              未选中时，从第一个选中的 List 开始。播放中更改选择，从下一次切换
              List 生效。
            </p>
            {!lists.some((l) => c.loopListIds.includes(l.id)) && (
              <p role="alert">请至少选择一个 List。</p>
            )}
          </fieldset>
        )}
        <h3>显示</h3>
        {number("font", "文字大小", 14, 48)}
        {number("overlaySize", "覆盖文字大小", 14, 64)}
        {number("overlayBackground", "覆盖背景透明度", 0, 1, 0.05)}
        <label>
          覆盖文字颜色
          <input
            type="color"
            value={c.overlayColor}
            onChange={(e) => set({ overlayColor: e.target.value })}
          />
        </label>
        <label>
          覆盖位置
          <select
            value={c.overlayPosition}
            onChange={(e) =>
              set({
                overlayPosition: e.target.value as Settings["overlayPosition"],
              })
            }
          >
            <option value="top">顶部</option>
            <option value="center">中央</option>
            <option value="bottom">底部</option>
          </select>
        </label>
        {check("reveal", "看图猜词：点击图片揭示文字")}
        {check("autoScroll", "自动跟随当前单词")}
        {check("wake", "朗读时保持屏幕常亮")}
        <p className="hint">
          可按电源键主动锁屏，原生服务继续朗读。暂停或停止后恢复系统休眠。
        </p>
        <h3>可见字段 / 图片覆盖</h3>
        {check("overlayIpa", "覆盖国际音标（英式 / 美式，仅显示）")}
        {fields.map((f) => (
          <div className="field" key={f}>
            <span>{labels[f]}</span>
            <label>
              <input
                type="checkbox"
                checked={c.visible.includes(f)}
                onChange={() => toggle("visible", f)}
              />
              显示
            </label>
            <label>
              <input
                type="checkbox"
                checked={c.overlay.includes(f)}
                onChange={() => toggle("overlay", f)}
              />
              覆盖
            </label>
          </div>
        ))}
        <h3>原生朗读</h3>
        <p className="hint">
          恢复时从被中断的字段开头重读；间隔暂停后重新等待该间隔。语速等设置在下一语音边界生效。
        </p>
        {number("enRate", "英语语速", 0.1, 3, 0.1)}
        {number("zhRate", "中文语速", 0.1, 3, 0.1)}
        {number("pitch", "音调", 0.5, 2, 0.1)}
        {number("volume", "音量", 0, 1, 0.1)}
        <label>
          英语口音
          <select
            value={c.accent}
            onChange={(e) =>
              set({ accent: e.target.value as Settings["accent"], enVoice: "" })
            }
          >
            <option value="en-US">美式</option>
            <option value="en-GB">英式</option>
          </select>
        </label>
        {(["en", "zh"] as const).map((lang) => (
          <label key={lang}>
            {lang === "en" ? "英语声音" : "中文声音"}
            <select
              value={lang === "en" ? c.enVoice : c.zhVoice}
              onChange={(e) =>
                set({ [lang === "en" ? "enVoice" : "zhVoice"]: e.target.value })
              }
            >
              <option value="">系统离线声音</option>
              {voices
                .filter((v) => v.language.startsWith(lang))
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id} · {v.language}
                  </option>
                ))}
            </select>
          </label>
        ))}
        <h3>字段与顺序</h3>
        <button onClick={() => set({ order: [...fields] })}>
          恢复默认顺序
        </button>
        {fields.map((f) => (
          <label key={f}>
            <input
              type="checkbox"
              checked={c.order.includes(f)}
              onChange={() => toggle("order", f)}
            />
            {labels[f]}
          </label>
        ))}
        {c.order.map((f, i) => (
          <div className="field" key={f}>
            <span>
              {i + 1}. {labels[f]}
            </span>
            <button
              disabled={!i}
              aria-label={`上移${labels[f]}`}
              onClick={() => {
                const a = [...c.order];
                [a[i - 1], a[i]] = [a[i], a[i - 1]];
                set({ order: a });
              }}
            >
              ↑
            </button>
            <button
              disabled={i === c.order.length - 1}
              aria-label={`下移${labels[f]}`}
              onClick={() => {
                const a = [...c.order];
                [a[i + 1], a[i]] = [a[i], a[i + 1]];
                set({ order: a });
              }}
            >
              ↓
            </button>
          </div>
        ))}
        {number("fieldRepeat", "字段重复次数", 1, 20)}
        {number("repeat", "单词重复次数", 1, 20)}
        {number("gap", "字段间隔（毫秒）", 0, 60000, 100)}
        {number("itemGap", "单词间隔（毫秒）", 0, 60000, 100)}
        <p className="hint">
          缺少离线 TTS 语言包时会停止并提示。请先在 Android
          系统文字转语音设置中安装英语和中文离线声音。极端省电或强制停止可能中断播放。
        </p>
      </section>
    </div>
  );
}
