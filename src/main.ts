import {
  Menu,
  moment,
  normalizePath,
  Notice,
  Platform,
  Plugin,
  TAbstractFile,
  TFile,
  TFolder,
  WorkspaceLeaf,
} from "obsidian";
import { applyWindowBounds, applyWindowPreferences, captureWindowBounds, getBrowserWindowForLeaf } from "./electron";
import { NoteSuggestModal } from "./note-suggest-modal";
import { DesktopStickyNotesSettingTab } from "./settings-tab";
import { StickyNoteView } from "./sticky-view";
import {
  DEFAULT_SETTINGS,
  DesktopStickyNotesSettings,
  StickyNoteState,
  VIEW_TYPE_STICKY_NOTE,
} from "./types";

function cloneDefaultSettings(): DesktopStickyNotesSettings {
  return {
    ...DEFAULT_SETTINGS,
    stickies: {},
  };
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function debounce<T extends (...args: never[]) => void>(fn: T, delayMs: number): T {
  let timer: number | null = null;
  return ((...args: Parameters<T>) => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      fn(...args as never[]);
    }, delayMs);
  }) as T;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function clampOpacity(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0.2, parsed));
}

type StickyPopoutWindowInit = {
  x?: number;
  y?: number;
  size?: { width: number; height: number };
  frame?: boolean;
  titleBarStyle?: "default" | "hidden" | "hiddenInset" | "customButtonsOnHover";
  titleBarOverlay?: boolean | { color?: string; symbolColor?: string; height?: number };
  autoHideMenuBar?: boolean;
  backgroundColor?: string;
};

function createPopoutWindowInit(sticky: StickyNoteState, hideWindowTitlebar: boolean): StickyPopoutWindowInit {
  const init: StickyPopoutWindowInit = {
    x: sticky.x,
    y: sticky.y,
    size: {
      width: sticky.width,
      height: sticky.height,
    },
  };

  if (hideWindowTitlebar) {
    Object.assign(init, {
      frame: false,
      titleBarStyle: "hidden",
      titleBarOverlay: false,
      autoHideMenuBar: true,
      backgroundColor: "#00000000",
    });
  }

  return init;
}

export default class DesktopStickyNotesPlugin extends Plugin {
  settings: DesktopStickyNotesSettings = cloneDefaultSettings();

  private readonly openLeavesBySticky = new Map<string, Set<WorkspaceLeaf>>();
  private readonly cleanupByLeaf = new Map<WorkspaceLeaf, () => void>();

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_STICKY_NOTE, (leaf) => new StickyNoteView(leaf, this));
    this.addSettingTab(new DesktopStickyNotesSettingTab(this.app, this));

    this.addRibbonIcon("sticky-note", "将当前笔记贴到桌面", () => {
      void this.pinCurrentNote();
    });

    this.addCommand({
      id: "pin-current-note-as-desktop-sticky",
      name: "将当前笔记贴到桌面",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const canRun = Boolean(file && file.extension === "md");
        if (!canRun) return false;
        if (!checking && file) void this.pinFile(file);
        return true;
      },
    });

    this.addCommand({
      id: "pin-note-as-desktop-sticky",
      name: "选择笔记并贴到桌面",
      callback: () => {
        new NoteSuggestModal(this.app, (file) => {
          void this.pinFile(file);
        }).open();
      },
    });

    this.addCommand({
      id: "create-new-desktop-sticky-note",
      name: "新建桌面便签",
      callback: () => {
        void this.createNewStickyNote();
      },
    });

    this.addCommand({
      id: "restore-desktop-sticky-notes",
      name: "恢复所有桌面便签",
      callback: () => {
        void this.restoreStickies();
      },
    });

    this.addCommand({
      id: "close-all-desktop-sticky-notes",
      name: "关闭所有桌面便签窗口",
      callback: () => {
        void this.closeAllStickyWindows();
      },
    });

    this.addCommand({
      id: "toggle-always-on-top-for-open-sticky-notes",
      name: "切换所有已打开便签的置顶状态",
      callback: () => {
        void this.toggleAlwaysOnTopForOpenStickies();
      },
    });

    this.registerEvent(this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      menu.addItem((item) => item
        .setTitle("贴到桌面便签")
        .setIcon("sticky-note")
        .onClick(() => {
          void this.pinFile(file);
        }));
    }));

    this.registerEvent(this.app.vault.on("delete", async (file) => {
      if (!(file instanceof TFile)) return;
      const matchingIds = Object.values(this.settings.stickies)
        .filter((sticky) => sticky.filePath === file.path)
        .map((sticky) => sticky.id);
      for (const id of matchingIds) await this.removeSticky(id, true);
    }));

    this.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
      if (!(file instanceof TFile)) return;
      let changed = false;
      for (const sticky of Object.values(this.settings.stickies)) {
        if (sticky.filePath === oldPath) {
          sticky.filePath = file.path;
          sticky.updatedAt = Date.now();
          changed = true;
        }
      }
      if (changed) await this.saveSettings();
    }));

    this.app.workspace.onLayoutReady(() => {
      if (this.settings.restoreOnStartup) void this.restoreStickies();
    });
  }

  async onunload(): Promise<void> {
    await this.closeAllStickyWindows();
    for (const cleanup of this.cleanupByLeaf.values()) cleanup();
    this.cleanupByLeaf.clear();
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData() as Partial<DesktopStickyNotesSettings> | null;
    this.settings = {
      ...cloneDefaultSettings(),
      ...loaded,
      stickies: loaded?.stickies ?? {},
    };

    this.settings.defaultWidth = clampNumber(this.settings.defaultWidth, DEFAULT_SETTINGS.defaultWidth, 240, 1600);
    this.settings.defaultHeight = clampNumber(this.settings.defaultHeight, DEFAULT_SETTINGS.defaultHeight, 180, 1600);
    this.settings.defaultOpacity = clampOpacity(this.settings.defaultOpacity, DEFAULT_SETTINGS.defaultOpacity);
    this.settings.autoSaveDelayMs = clampNumber(this.settings.autoSaveDelayMs, DEFAULT_SETTINGS.autoSaveDelayMs, 200, 10000);

    for (const sticky of Object.values(this.settings.stickies)) {
      sticky.width = clampNumber(sticky.width, this.settings.defaultWidth, 240, 1600);
      sticky.height = clampNumber(sticky.height, this.settings.defaultHeight, 180, 1600);
      sticky.opacity = clampOpacity(sticky.opacity, this.settings.defaultOpacity);
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  getFile(path: string): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile && file.extension === "md" ? file : null;
  }

  async pinCurrentNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("当前没有可贴到桌面的 Markdown 笔记。", 4000);
      return;
    }
    await this.pinFile(file);
  }

  async pinFile(file: TFile): Promise<void> {
    if (!Platform.isDesktopApp) {
      new Notice("Desktop Sticky Notes 只能在 Obsidian 桌面端使用。", 5000);
      return;
    }

    if (this.settings.reuseExistingStickyForSameFile) {
      const existing = Object.values(this.settings.stickies).find((sticky) => sticky.filePath === file.path);
      if (existing) {
        await this.openSticky(existing.id);
        return;
      }
    }

    const sticky = this.createStickyState(file.path);
    this.settings.stickies[sticky.id] = sticky;
    await this.saveSettings();
    await this.openSticky(sticky.id);
  }

  async openSticky(stickyId: string): Promise<void> {
    const sticky = this.settings.stickies[stickyId];
    if (!sticky) {
      new Notice("找不到这个便签的状态。", 4000);
      return;
    }

    const file = this.getFile(sticky.filePath);
    if (!file) {
      new Notice(`找不到笔记：${sticky.filePath}`, 6000);
      return;
    }

    const existingLeaf = this.firstOpenLeaf(stickyId);
    if (existingLeaf) {
      this.focusLeaf(existingLeaf);
      return;
    }

    try {
      const leaf = this.app.workspace.openPopoutLeaf(
        createPopoutWindowInit(sticky, this.settings.hideWindowTitlebar) as unknown as Parameters<typeof this.app.workspace.openPopoutLeaf>[0],
      );
      applyWindowBounds(leaf, sticky);

      await leaf.setViewState({
        type: VIEW_TYPE_STICKY_NOTE,
        state: { stickyId },
        active: true,
      });

      this.markStickyOpened(stickyId, leaf);
      await this.touchSticky(stickyId, { lastOpenedAt: Date.now() });
      const currentSticky = this.settings.stickies[stickyId];
      applyWindowPreferences(leaf, currentSticky, {
        skipTaskbar: this.settings.skipTaskbar,
        hideWindowTitlebar: this.settings.hideWindowTitlebar,
        showNotice: true,
      });
      applyWindowBounds(leaf, currentSticky);
      this.setupWindowPersistence(stickyId, leaf);
      this.scheduleInitialWindowSync(stickyId, leaf);

      if (this.settings.focusNewSticky) this.focusLeaf(leaf);
    } catch (error) {
      console.error("Desktop Sticky Notes: failed to open sticky window", error);
      new Notice("无法打开桌面便签窗口。请确认当前是 Obsidian 桌面端。", 6000);
    }
  }

  async restoreStickies(): Promise<void> {
    const stickies = Object.values(this.settings.stickies)
      .sort((a, b) => (a.lastOpenedAt ?? a.createdAt) - (b.lastOpenedAt ?? b.createdAt));

    for (const sticky of stickies) {
      if (this.getFile(sticky.filePath)) await this.openSticky(sticky.id);
    }
  }

  async closeAllStickyWindows(): Promise<void> {
    const leaves = new Set<WorkspaceLeaf>();
    for (const leafSet of this.openLeavesBySticky.values()) {
      for (const leaf of leafSet) leaves.add(leaf);
    }

    for (const leaf of leaves) {
      try {
        leaf.detach();
      } catch (_error) {
        // Already closed.
      }
      this.cleanupLeaf(leaf);
    }

    this.openLeavesBySticky.clear();
  }

  async toggleAlwaysOnTopForOpenStickies(): Promise<void> {
    const openStickyIds = [...this.openLeavesBySticky.keys()];
    if (openStickyIds.length === 0) {
      new Notice("当前没有打开的桌面便签。", 3000);
      return;
    }

    const shouldEnable = openStickyIds.some((id) => !this.settings.stickies[id]?.alwaysOnTop);
    for (const id of openStickyIds) {
      const sticky = this.settings.stickies[id];
      if (!sticky) continue;
      sticky.alwaysOnTop = shouldEnable;
      sticky.updatedAt = Date.now();
    }
    await this.saveSettings();
    await this.applyPreferencesToOpenStickies();
    new Notice(shouldEnable ? "已将所有便签设为置顶。" : "已取消所有便签置顶。", 3000);
  }

  async applyPreferencesToOpenStickies(): Promise<void> {
    for (const [stickyId, leaves] of this.openLeavesBySticky.entries()) {
      const sticky = this.settings.stickies[stickyId];
      if (!sticky) continue;
      for (const leaf of leaves) {
        applyWindowPreferences(leaf, sticky, {
          skipTaskbar: this.settings.skipTaskbar,
          hideWindowTitlebar: this.settings.hideWindowTitlebar,
          showNotice: false,
        });
      }
    }
  }

  async applyDefaultSizeToAllStickies(): Promise<void> {
    const width = this.settings.defaultWidth;
    const height = this.settings.defaultHeight;
    let changed = 0;

    for (const sticky of Object.values(this.settings.stickies)) {
      if (sticky.width === width && sticky.height === height) continue;
      sticky.width = width;
      sticky.height = height;
      sticky.updatedAt = Date.now();
      changed += 1;
    }

    await this.saveSettings();

    for (const [stickyId, leaves] of this.openLeavesBySticky.entries()) {
      const sticky = this.settings.stickies[stickyId];
      if (!sticky) continue;
      for (const leaf of leaves) applyWindowBounds(leaf, sticky);
    }

    new Notice(changed > 0 ? `已将 ${changed} 个便签调整为当前默认尺寸。` : "所有便签已经是当前默认尺寸。", 3000);
  }


  async updateSticky(stickyId: string, patch: Partial<StickyNoteState>, persist = true): Promise<void> {
    const sticky = this.settings.stickies[stickyId];
    if (!sticky) return;
    this.settings.stickies[stickyId] = {
      ...sticky,
      ...patch,
      updatedAt: Date.now(),
    };
    if (persist) await this.saveSettings();
  }

  async touchSticky(stickyId: string, patch: Partial<StickyNoteState> = {}): Promise<void> {
    await this.updateSticky(stickyId, patch, true);
  }

  async removeSticky(stickyId: string, closeOpenWindows: boolean): Promise<void> {
    if (closeOpenWindows) {
      const leaves = [...(this.openLeavesBySticky.get(stickyId) ?? [])];
      for (const leaf of leaves) {
        try {
          leaf.detach();
        } catch (_error) {
          // Already closed.
        }
        this.cleanupLeaf(leaf);
      }
    }

    this.openLeavesBySticky.delete(stickyId);
    delete this.settings.stickies[stickyId];
    await this.saveSettings();
  }

  markStickyClosed(stickyId: string, leaf: WorkspaceLeaf): void {
    const leaves = this.openLeavesBySticky.get(stickyId);
    if (leaves) {
      leaves.delete(leaf);
      if (leaves.size === 0) this.openLeavesBySticky.delete(stickyId);
    }
    this.cleanupLeaf(leaf);
  }

  async createNewStickyNote(): Promise<void> {
    if (!Platform.isDesktopApp) {
      new Notice("Desktop Sticky Notes 只能在 Obsidian 桌面端使用。", 5000);
      return;
    }

    try {
      const folderPath = normalizePath(this.settings.newNoteFolder.trim());
      await this.ensureFolder(folderPath);
      const now = moment();
      const baseName = `Sticky ${now.format("YYYY-MM-DD HHmmss")}`;
      const path = this.getAvailableMarkdownPath(folderPath, baseName);
      const template = this.settings.newNoteTemplate
        .replace(/{{date}}/g, now.format("YYYY-MM-DD"))
        .replace(/{{time}}/g, now.format("HH:mm"));
      const content = template.length > 0 ? template : `# ${now.format("YYYY-MM-DD HH:mm")}\n\n`;
      const file = await this.app.vault.create(path, content);
      await this.pinFile(file);
    } catch (error) {
      console.error("Desktop Sticky Notes: failed to create note", error);
      new Notice("新建桌面便签失败，请检查目录设置。", 6000);
    }
  }

  private createStickyState(filePath: string): StickyNoteState {
    const count = Object.keys(this.settings.stickies).length;
    const offset = (count % 8) * 28;
    const screenInfo = window.screen as Screen & { availLeft?: number; availTop?: number };
    const screenLeft = Math.max(40, (screenInfo.availLeft ?? 0) + 80 + offset);
    const screenTop = Math.max(40, (screenInfo.availTop ?? 0) + 80 + offset);
    const now = Date.now();

    return {
      id: makeId(),
      filePath,
      x: screenLeft,
      y: screenTop,
      width: this.settings.defaultWidth,
      height: this.settings.defaultHeight,
      mode: this.settings.defaultMode,
      color: this.settings.defaultColor,
      alwaysOnTop: this.settings.defaultAlwaysOnTop,
      opacity: this.settings.defaultOpacity,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    };
  }

  private firstOpenLeaf(stickyId: string): WorkspaceLeaf | null {
    const leaves = this.openLeavesBySticky.get(stickyId);
    if (!leaves) return null;
    for (const leaf of leaves) return leaf;
    return null;
  }

  private focusLeaf(leaf: WorkspaceLeaf): void {
    try {
      getBrowserWindowForLeaf(leaf)?.focus?.();
    } catch (_error) {
      // Focus best effort only.
    }
    try {
      this.app.workspace.setActiveLeaf(leaf, { focus: true });
    } catch (_error) {
      // Leaf may have been closed.
    }
  }

  private markStickyOpened(stickyId: string, leaf: WorkspaceLeaf): void {
    const leaves = this.openLeavesBySticky.get(stickyId) ?? new Set<WorkspaceLeaf>();
    leaves.add(leaf);
    this.openLeavesBySticky.set(stickyId, leaves);
  }

  private scheduleInitialWindowSync(stickyId: string, leaf: WorkspaceLeaf): void {
    for (const delayMs of [50, 150, 350, 750, 1500, 3000]) {
      const timer = window.setTimeout(() => {
        if (!this.openLeavesBySticky.get(stickyId)?.has(leaf)) return;
        const sticky = this.settings.stickies[stickyId];
        if (!sticky) return;

        applyWindowPreferences(leaf, sticky, {
          skipTaskbar: this.settings.skipTaskbar,
          hideWindowTitlebar: this.settings.hideWindowTitlebar,
          showNotice: false,
        });
        applyWindowBounds(leaf, sticky);
      }, delayMs);

      this.register(() => window.clearTimeout(timer));
    }
  }

  private setupWindowPersistence(stickyId: string, leaf: WorkspaceLeaf): void {
    const browserWindow = getBrowserWindowForLeaf(leaf);
    if (!browserWindow) return;

    const persistBounds = debounce(() => {
      if (browserWindow.isDestroyed?.()) return;
      const patch = captureWindowBounds(browserWindow);
      if (!patch) return;
      void this.updateSticky(stickyId, patch, true);
    }, 300);

    const cleanup = () => {
      try {
        browserWindow.removeListener?.("move", persistBounds);
        browserWindow.removeListener?.("resize", persistBounds);
        browserWindow.removeListener?.("closed", cleanup);
      } catch (_error) {
        // Already disposed.
      }
      this.cleanupByLeaf.delete(leaf);
    };

    try {
      browserWindow.on?.("move", persistBounds);
      browserWindow.on?.("resize", persistBounds);
      browserWindow.on?.("closed", cleanup);
      this.cleanupByLeaf.set(leaf, cleanup);
    } catch (_error) {
      // Window event binding is best effort.
    }
  }

  private cleanupLeaf(leaf: WorkspaceLeaf): void {
    const cleanup = this.cleanupByLeaf.get(leaf);
    if (cleanup) cleanup();
  }

  private async ensureFolder(folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath).replace(/^\/+|\/+$/g, "");
    if (!normalized) return;

    const parts = normalized.split("/").filter(Boolean);
    let current = "";

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing instanceof TFolder) continue;
      if (existing) throw new Error(`Path exists but is not a folder: ${current}`);
      await this.app.vault.createFolder(current);
    }
  }

  private getAvailableMarkdownPath(folderPath: string, baseName: string): string {
    const folder = normalizePath(folderPath).replace(/^\/+|\/+$/g, "");
    const prefix = folder ? `${folder}/` : "";
    let candidate = normalizePath(`${prefix}${baseName}.md`);
    let index = 2;

    while (this.app.vault.getAbstractFileByPath(candidate)) {
      candidate = normalizePath(`${prefix}${baseName} ${index}.md`);
      index += 1;
    }

    return candidate;
  }
}
