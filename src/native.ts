import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import type { Settings } from "./store";
export interface PlaybackState {
  status: "stopped" | "playing" | "paused";
  listId: string;
  index: number;
  wordId: string;
  revision: number;
  error: string;
}
export interface Voice {
  id: string;
  language: string;
}
interface NativeTTS {
  command(options: {
    action: string;
    fullscreen?: boolean;
    listId?: string;
    index?: number;
    wordId?: string;
    settings?: Settings;
  }): Promise<void>;
  getState(): Promise<PlaybackState>;
  getVoices(): Promise<{ voices: Voice[] }>;
  requestNotifications(): Promise<void>;
  addListener(
    event: "state",
    callback: (state: PlaybackState) => void,
  ): Promise<PluginListenerHandle>;
}
export const native = registerPlugin<NativeTTS>("VocabularyTTS");
export const isAndroid = Capacitor.getPlatform() === "android";
export const stopped: PlaybackState = {
  status: "stopped",
  listId: "",
  index: 0,
  wordId: "",
  revision: 0,
  error: "",
};
