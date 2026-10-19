import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loadLibrary, safePosition } from "./data";
import { asset, fieldText, labels, type List, type Word } from "./types";
import { useStore } from "./store";
import { isAndroid, native, stopped, type PlaybackState } from "./native";
import SettingsPanel from "./Settings";

function OverlayRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const row = useRef<HTMLParagraphElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const fit = () => {
      if (!row.current || !text.current) return;
      text.current.style.fontSize = "1em";
      const width = text.current.getBoundingClientRect().width;
      if (width > 0)
        text.current.style.fontSize = `${Math.min(1, row.current.clientWidth / width)}em`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (row.current) observer.observe(row.current);
    return () => observer.disconnect();
  }, [children]);
  return (
    <p ref={row} className={`overlay-row ${className}`}>
      <span ref={text}>{children}</span>
    </p>
  );
}

function PictureView({ word }: { word: Word }) {
  const c = useStore((s) => s.settings);
  const [revealed, reveal] = useState(false);
  const [full, setFull] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(true);
  useEffect(() => {
    reveal(false);
  }, [word.id]);
  useEffect(() => {
    if (!isAndroid) return;
    void native.command({ action: "fullscreen", fullscreen: full });
    return () => {
      void native.command({ action: "fullscreen", fullscreen: false });
    };
  }, [full]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
  return (
    <section
      className={`picture ${full ? "fullscreen" : ""}`}
      aria-label="词汇图片"
    >
      {(!full || toolsVisible) && (
        <div className="image-tools">
          <button
            onClick={() => {
              setToolsVisible(true);
              setFull(!full);
            }}
          >
            {full ? "退出全屏" : "全屏"}
          </button>
          {full && (
            <button onClick={() => setToolsVisible(false)}>隐藏按钮</button>
          )}
        </div>
      )}
      <div
        className="image-scroll"
        onClick={() => {
          if (full) setToolsVisible(!toolsVisible);
          else reveal(!revealed);
        }}
      >
        {word.images.length ? (
          word.images.map((p) => (
            <img
              key={p.id}
              src={asset(p.src)}
              alt={p.alt || word.word}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: p.objectPosition,
                transform: `rotate(${p.rotation || 0}deg)`,
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.parentElement?.setAttribute(
                  "data-missing",
                  "图片无法读取，仍可朗读",
                );
              }}
            />
          ))
        ) : (
          <p className="empty">此词暂无图片 · 仍可正常朗读</p>
        )}
      </div>
      {(!c.reveal || revealed) && (
        <div
          className={`overlay ${c.overlayPosition}`}
          style={{
            color: c.overlayColor,
            fontSize: c.overlaySize,
            background: `rgba(0,0,0,${c.overlayBackground})`,
          }}
        >
          {c.overlay.map((f, index) => {
            if (f.startsWith("collocation.")) {
              if (
                c.overlay
                  .slice(0, index)
                  .some((field) => field.startsWith("collocation."))
              )
                return null;
              return (
                <OverlayRow key="collocation" className="overlay-collocation">
                  {c.overlay.includes("collocation.en") &&
                    fieldText(word, "collocation.en")}
                  {c.overlay.includes("collocation.en") &&
                    c.overlay.includes("collocation.zh") &&
                    " · "}
                  {c.overlay.includes("collocation.zh") &&
                    fieldText(word, "collocation.zh")}
                </OverlayRow>
              );
            }
            const Row = f === "word" ? OverlayRow : "p";
            return (
              <Row key={f}>
                {fieldText(word, f)}
                {f === "word" && c.overlayIpa && (
                  <span className="overlay-ipa">
                    {" "}
                    · 英式 {word.ipa.uk} · 美式 {word.ipa.us}
                  </span>
                )}
              </Row>
            );
          })}
          {c.overlayIpa && !c.overlay.includes("word") && (
            <p className="overlay-ipa">
              英式 {word.ipa.uk} · 美式 {word.ipa.us}
            </p>
          )}
        </div>
      )}
      {c.reveal && !revealed && (
        <button className="reveal" onClick={() => reveal(true)}>
          显示答案
        </button>
      )}
    </section>
  );
}
export default function App() {
  const {
    settings: c,
    set,
    listId,
    setList,
    positions,
    wordIds,
    setPosition,
  } = useStore();
  const [lists, setLists] = useState<List[]>([]),
    [state, setState] = useState<PlaybackState>(stopped),
    [error, setError] = useState("");
  const [drawer, setDrawer] = useState(false),
    [settings, setSettings] = useState(false),
    [follow, setFollow] = useState(true);
  const [query, setQuery] = useState("");
  const revision = useRef(-1),
    touch = useRef({ x: 0, y: 0 });
  const nav = useRef<HTMLDivElement>(null);
  const list = lists.find((l) => l.id === listId) || lists[0];
  const index = list
    ? safePosition(list, positions[list.id] || 0, wordIds[list.id])
    : 0;
  const word = list?.items[index];
  useEffect(() => {
    loadLibrary()
      .then(setLists)
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    if (list && list.id !== listId) setList(list.id);
  }, [list, listId, setList]);
  useEffect(() => {
    if (!isAndroid) return;
    let disposed = false;
    let remove: (() => void) | undefined;
    const apply = (s: PlaybackState) => {
      if (disposed || s.revision < revision.current) return;
      revision.current = s.revision;
      setState(s);
      if (s.listId) {
        useStore.getState().setList(s.listId);
        useStore.getState().setPosition(s.listId, s.index, s.wordId);
      }
      if (s.error) setError(s.error);
    };
    native.addListener("state", apply).then((h) => {
      if (disposed) void h.remove();
      else remove = () => void h.remove();
    });
    const sync = () => {
      native
        .getState()
        .then(apply)
        .catch((e) => setError(String(e)));
    };
    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      disposed = true;
      remove?.();
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  useEffect(() => {
    if (isAndroid)
      native
        .command({ action: "settings", settings: c })
        .catch((e) => setError(String(e)));
  }, [c]);
  useEffect(() => {
    if (follow && c.autoScroll)
      nav.current
        ?.querySelector('[aria-current="true"]')
        ?.scrollIntoView({ block: "nearest" });
  }, [index, follow, c.autoScroll]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(false);
        setSettings(false);
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
  async function command(action: string, n = index, id = list?.id) {
    if (!isAndroid) {
      setError("浏览器仅供只读界面预览。请安装 Android APK 使用原生朗读。");
      return;
    }
    try {
      if (action === "play") await native.requestNotifications();
      await native.command({
        action,
        index: n,
        listId: id,
        wordId: lists.find((l) => l.id === id)?.items[n]?.id,
        settings: useStore.getState().settings,
      });
    } catch (e) {
      setError(String(e));
    }
  }
  function select(n: number) {
    if (!list) return;
    setPosition(list.id, n, list.items[n]?.id);
    if (isAndroid)
      void command(state.status !== "stopped" ? "seek" : "select", n);
  }
  function choose(
    l: List,
    n = safePosition(l, positions[l.id] || 0, wordIds[l.id]),
  ) {
    setList(l.id);
    setPosition(l.id, n, l.items[n]?.id);
    if (isAndroid) void command("select", n, l.id);
    setDrawer(false);
    setFollow(true);
  }
  return (
    <div className="app">
      <header className="top">
        <button aria-label="选择 List" onClick={() => setDrawer(true)}>
          ☰
        </button>
        <div>
          <strong>{list?.title || "TOEIC"}</strong>
          <small>
            {index + 1} / {list?.items.length || 0} ·{" "}
            {state.status === "playing"
              ? "朗读中"
              : state.status === "paused"
                ? "已暂停"
                : "准备学习"}
          </small>
        </div>
        <button onClick={() => setSettings(true)}>设置</button>
      </header>
      <div className="mode" role="group" aria-label="显示模式">
        {(["both", "text", "image"] as const).map((m, i) => (
          <button
            key={m}
            aria-pressed={c.mode === m}
            onClick={() => set({ mode: m })}
          >
            {["图文", "仅文字", "仅图片"][i]}
          </button>
        ))}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError("")}>关闭</button>
        </div>
      )}
      {c.mode === "both" && (
        <div className="tabs" role="tablist">
          {(["text", "image"] as const).map((p) => (
            <button
              role="tab"
              aria-selected={c.page === p}
              key={p}
              onClick={() => set({ page: p })}
            >
              {p === "text" ? "单词内容" : "词汇图片"}
            </button>
          ))}
        </div>
      )}
      <main
        style={{ fontSize: c.font }}
        onTouchStart={(e) => {
          touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          const target = e.target as HTMLElement;
          const imageArea = target.closest(".image-scroll");
          if (
            target.closest("input, button, .fullscreen") ||
            (imageArea && imageArea.scrollWidth > imageArea.clientWidth * 1.05)
          )
            return;
          const dx = e.changedTouches[0].clientX - touch.current.x,
            dy = e.changedTouches[0].clientY - touch.current.y;
          if (c.mode === "both" && Math.abs(dx) > 90 && Math.abs(dy) < 45)
            set({ page: dx < 0 ? "image" : "text" });
        }}
      >
        {word ? (
          c.mode === "image" || (c.mode === "both" && c.page === "image") ? (
            <PictureView word={word} />
          ) : (
            <article className="word" key={word.id}>
              {c.visible.includes("word") && (
                <>
                  <h1>{word.word}</h1>
                  <p className="ipa">
                    {word.partOfSpeech} · US {word.ipa.us} · UK {word.ipa.uk}
                  </p>
                </>
              )}
              {c.visible
                .filter((f) => f !== "word")
                .map((f) => (
                  <section key={f}>
                    <small>{labels[f]}</small>
                    <p>{fieldText(word, f) || "—"}</p>
                  </section>
                ))}
            </article>
          )
        ) : (
          <p>正在读取内置词库…</p>
        )}
      </main>
      <div
        className="word-strip"
        ref={nav}
        onTouchMove={() => setFollow(false)}
        onWheel={() => setFollow(false)}
      >
        {list?.items.map((w, i) => (
          <button
            key={w.id}
            aria-current={i === index ? "true" : undefined}
            onClick={() => select(i)}
          >
            {i + 1}. {w.word}
          </button>
        ))}
      </div>
      {!follow && (
        <button className="follow" onClick={() => setFollow(true)}>
          恢复跟随
        </button>
      )}
      <footer>
        <button
          aria-label="回到首词"
          title="回到第一个单词"
          disabled={!word || index === 0}
          onClick={() => {
            setFollow(true);
            select(0);
          }}
        >
          首词
        </button>
        <button
          aria-label="上一词"
          disabled={!word}
          onClick={() =>
            state.status === "stopped"
              ? select(Math.max(0, index - 1))
              : void command("previous")
          }
        >
          |◀
        </button>
        <button
          onClick={() =>
            void command(
              state.status === "playing"
                ? "pause"
                : state.status === "paused"
                  ? "resume"
                  : "play",
            )
          }
        >
          {state.status === "playing"
            ? "暂停"
            : state.status === "paused"
              ? "恢复"
              : "播放"}
        </button>
        <button onClick={() => void command("stop")}>停止</button>
        <button
          aria-label="下一词"
          disabled={!word}
          onClick={() =>
            state.status === "stopped"
              ? select(Math.min((list?.items.length || 1) - 1, index + 1))
              : void command("next")
          }
        >
          ▶|
        </button>
      </footer>
      {drawer && (
        <div className="scrim" onClick={() => setDrawer(false)}>
          <aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="List 选择"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h2>内置词库</h2>
              <button onClick={() => setDrawer(false)}>关闭</button>
            </header>
            <input
              aria-label="搜索词汇"
              placeholder="搜索所有 List"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {lists.map((l) => (
              <section key={l.id}>
                <button onClick={() => choose(l)}>
                  {l.title} · {l.items.length} 词
                </button>
                {query &&
                  l.items
                    .map((w, i) => ({ w, i }))
                    .filter(({ w }) =>
                      (w.word + w.meaning)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map(({ w, i }) => (
                      <button key={w.id} onClick={() => choose(l, i)}>
                        {w.word} · {w.meaning}
                      </button>
                    ))}
              </section>
            ))}
          </aside>
        </div>
      )}
      {settings && (
        <SettingsPanel close={() => setSettings(false)} lists={lists} />
      )}
    </div>
  );
}
