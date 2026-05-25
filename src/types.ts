export const VIEW_TYPE_STICKY_NOTE = "desktop-sticky-note";

export type StickyMode = "preview" | "edit";
export type StickyColor = "yellow" | "blue" | "green" | "pink" | "purple" | "gray";

export interface StickyWindowState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StickyNoteState extends StickyWindowState {
  id: string;
  filePath: string;
  mode: StickyMode;
  color: StickyColor;
  alwaysOnTop: boolean;
  opacity: number;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
}

export interface StickyViewState {
  stickyId: string;
}

export interface DesktopStickyNotesSettings {
  stickies: Record<string, StickyNoteState>;
  restoreOnStartup: boolean;
  defaultAlwaysOnTop: boolean;
  skipTaskbar: boolean;
  hideWindowTitlebar: boolean;
  defaultWidth: number;
  defaultHeight: number;
  defaultOpacity: number;
  defaultColor: StickyColor;
  defaultMode: StickyMode;
  autoSaveDelayMs: number;
  newNoteFolder: string;
  newNoteTemplate: string;
  focusNewSticky: boolean;
  reuseExistingStickyForSameFile: boolean;
}

export const DEFAULT_SETTINGS: DesktopStickyNotesSettings = {
  stickies: {},
  restoreOnStartup: true,
  defaultAlwaysOnTop: true,
  skipTaskbar: false,
  hideWindowTitlebar: true,
  defaultWidth: 360,
  defaultHeight: 360,
  defaultOpacity: 1,
  defaultColor: "yellow",
  defaultMode: "preview",
  autoSaveDelayMs: 700,
  newNoteFolder: "Sticky Notes",
  newNoteTemplate: "",
  focusNewSticky: true,
  reuseExistingStickyForSameFile: true,
};

export const STICKY_COLORS: StickyColor[] = ["yellow", "blue", "green", "pink", "purple", "gray"];
