import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fields, type Field } from "./types";
export interface Settings {
  mode: "both" | "text" | "image";
  font: number;
  ratio: number;
  visible: Field[];
  overlay: Field[];
  overlayIpa: boolean;
  overlayPosition: "top" | "center" | "bottom";
  overlayColor: string;
  overlaySize: number;
  overlayBackground: number;
  reveal: boolean;
  order: Field[];
  enRate: number;
  zhRate: number;
  pitch: number;
  volume: number;
  enVoice: string;
  zhVoice: string;
  accent: "en-US" | "en-GB";
  repeat: number;
  fieldRepeat: number;
  gap: number;
  itemGap: number;
  loop: boolean;
  multiListLoop: boolean;
  loopListIds: string[];
  currentOnly: boolean;
  autoScroll: boolean;
  scrollPosition: ScrollLogicalPosition;
  pauseFollow: boolean;
  wake: boolean;
  page: "text" | "image";
}
export const defaults: Settings = {
  mode: "both",
  font: 18,
  ratio: 55,
  visible: [
    "word",
    "meaning",
    "collocation.en",
    "collocation.zh",
    "example.en",
    "example.zh",
  ],
  overlay: ["word"],
  overlayIpa: false,
  overlayPosition: "bottom",
  overlayColor: "#ffffff",
  overlaySize: 24,
  overlayBackground: 0,
  reveal: false,
  order: [...fields],
  enRate: 0.8,
  zhRate: 1.2,
  pitch: 1,
  volume: 1,
  enVoice: "",
  zhVoice: "",
  accent: "en-US",
  repeat: 1,
  fieldRepeat: 1,
  gap: 300,
  itemGap: 500,
  loop: false,
  multiListLoop: false,
  loopListIds: [],
  currentOnly: false,
  autoScroll: true,
  scrollPosition: "center",
  pauseFollow: true,
  wake: true,
  page: "text",
};
export const useStore = create<{
  listId: string;
  wordIds: Record<string, string>;
  positions: Record<string, number>;
  settings: Settings;
  setList: (id: string) => void;
  setPosition: (id: string, n: number, wordId?: string) => void;
  set: (s: Partial<Settings>) => void;
}>()(
  persist(
    (set) => ({
      listId: "",
      positions: {},
      wordIds: {},
      settings: defaults,
      setList: (listId) => set({ listId }),
      setPosition: (id, n, wordId) =>
        set((s) => ({
          positions: { ...s.positions, [id]: n },
          wordIds: { ...s.wordIds, [id]: wordId ?? "" },
        })),
      set: (settings) =>
        set((s) => ({ settings: { ...s.settings, ...settings } })),
    }),
    {
      name: "toeic-android-settings-v1",
      version: 3,
      // Preserve explicit preferences across APK upgrades, including rates and wake=false.
      migrate: (persisted, version) => {
        const state = persisted as { settings?: Partial<Settings> };
        const oldOrder = state.settings?.order;
        const wasOldDefault =
          version < 2 &&
          oldOrder?.length === 2 &&
          oldOrder[0] === "word" &&
          oldOrder[1] === "example.en";
        return {
          ...state,
          settings: {
            ...defaults,
            ...state.settings,
            ...(wasOldDefault ? { order: [...fields] } : {}),
            ...(version < 3 && state.settings?.overlayBackground === 0.65
              ? { overlayBackground: 0 }
              : {}),
          },
        };
      },
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<typeof current>;
        return {
          ...current,
          ...saved,
          settings: { ...defaults, ...saved.settings },
          positions: saved.positions ?? {},
          wordIds: saved.wordIds ?? {},
        };
      },
    },
  ),
);
