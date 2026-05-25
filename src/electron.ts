import { Notice, WorkspaceLeaf } from "obsidian";
import type { StickyNoteState } from "./types";

export interface BrowserWindowLike {
  isDestroyed?: () => boolean;
  isAlwaysOnTop?: () => boolean;
  setAlwaysOnTop?: (flag: boolean, level?: string, relativeLevel?: number) => void;
  setOpacity?: (opacity: number) => void;
  getOpacity?: () => number;
  setSkipTaskbar?: (skip: boolean) => void;
  setMenuBarVisibility?: (visible: boolean) => void;
  setAutoHideMenuBar?: (hide: boolean) => void;
  setWindowButtonVisibility?: (visible: boolean) => void;
  setTitleBarOverlay?: (options: boolean | { color?: string; symbolColor?: string; height?: number }) => void;
  setBackgroundColor?: (backgroundColor: string) => void;
  setTitle?: (title: string) => void;
  getBounds?: () => { x: number; y: number; width: number; height: number };
  setBounds?: (bounds: Partial<{ x: number; y: number; width: number; height: number }>, animate?: boolean) => void;
  setSize?: (width: number, height: number, animate?: boolean) => void;
  focus?: () => void;
  close?: () => void;
  on?: (event: string, listener: () => void) => BrowserWindowLike;
  removeListener?: (event: string, listener: () => void) => BrowserWindowLike;
}

type RemoteModule = {
  getCurrentWindow?: () => BrowserWindowLike;
};

type WindowWithRequire = Window & {
  require?: (id: string) => RemoteModule;
};

type ChromeObserverState = { observer: MutationObserver; hideWindowTitlebar: boolean; applying: boolean };

const STICKY_WINDOW_CLASS = "desktop-sticky-popout-window";
const HIDDEN_TITLEBAR_CLASS = "desktop-sticky-titlebar-hidden";
const CHROME_STYLE_ID = "desktop-sticky-window-chrome-style";

const chromeObservers = new WeakMap<Document, ChromeObserverState>();

const chromeHideSelectors = [
  ".titlebar",
  ".app-title-bar",
  ".workspace-tab-header-container",
  ".workspace-ribbon",
  ".status-bar",
  ".sidebar-toggle-button",
  ".workspace-sidedock-vault-profile",
  ".workspace-tab-container-before",
  ".workspace-tab-container-after",
];

function getRemoteFromWindow(win: Window): RemoteModule | null {
  const candidate = win as WindowWithRequire;
  if (typeof candidate.require === "function") {
    try {
      return candidate.require("@electron/remote");
    } catch (_error) {
      // Fall through to other strategies.
    }
  }

  const globalCandidate = window as WindowWithRequire;
  if (typeof globalCandidate.require === "function") {
    try {
      return globalCandidate.require("@electron/remote");
    } catch (_error) {
      // Electron remote might be unavailable in restricted environments.
    }
  }

  return null;
}

function getDocumentForLeaf(leaf: WorkspaceLeaf): Document | null {
  try {
    return leaf.getContainer().win.document;
  } catch (_error) {
    return null;
  }
}

function ensureChromeStyle(doc: Document): void {
  if (doc.getElementById(CHROME_STYLE_ID)) return;

  const styleEl = doc.createElement("style");
  styleEl.id = CHROME_STYLE_ID;
  styleEl.textContent = `
html.${STICKY_WINDOW_CLASS},
body.${STICKY_WINDOW_CLASS} {
  background: transparent !important;
  overflow: hidden !important;
}
body.${STICKY_WINDOW_CLASS} .workspace-leaf-content[data-type="desktop-sticky-note"] .view-header {
  display: none !important;
}
body.${HIDDEN_TITLEBAR_CLASS} .titlebar,
body.${HIDDEN_TITLEBAR_CLASS} .app-title-bar,
body.${HIDDEN_TITLEBAR_CLASS} .workspace-tab-header-container,
body.${HIDDEN_TITLEBAR_CLASS} .workspace-ribbon,
body.${HIDDEN_TITLEBAR_CLASS} .status-bar,
body.${HIDDEN_TITLEBAR_CLASS} .sidebar-toggle-button,
body.${HIDDEN_TITLEBAR_CLASS} .workspace-sidedock-vault-profile,
body.${HIDDEN_TITLEBAR_CLASS} .workspace-tab-container-before,
body.${HIDDEN_TITLEBAR_CLASS} .workspace-tab-container-after {
  display: none !important;
}
body.${STICKY_WINDOW_CLASS} .app-container,
body.${STICKY_WINDOW_CLASS} .horizontal-main-container,
body.${STICKY_WINDOW_CLASS} .workspace,
body.${STICKY_WINDOW_CLASS} .workspace-split,
body.${STICKY_WINDOW_CLASS} .workspace-tabs,
body.${STICKY_WINDOW_CLASS} .workspace-leaf,
body.${STICKY_WINDOW_CLASS} .workspace-leaf-content,
body.${STICKY_WINDOW_CLASS} .view-content {
  width: 100vw !important;
  height: 100vh !important;
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  box-shadow: none !important;
  overflow: hidden !important;
  background: transparent !important;
}
body.${STICKY_WINDOW_CLASS} .workspace-split.mod-root,
body.${STICKY_WINDOW_CLASS} .workspace-tabs.mod-top,
body.${STICKY_WINDOW_CLASS} .workspace-tab-container,
body.${STICKY_WINDOW_CLASS} .workspace-tab-container-inner,
body.${STICKY_WINDOW_CLASS} .workspace-tab-container-inner > .workspace-leaf {
  width: 100vw !important;
  height: 100vh !important;
  margin: 0 !important;
  padding: 0 !important;
}
`;
  (doc.head ?? doc.documentElement).appendChild(styleEl);
}

function applyInlineChromeVisibility(doc: Document, hideWindowTitlebar: boolean): void {
  for (const selector of chromeHideSelectors) {
    const elements = Array.from(doc.querySelectorAll<HTMLElement>(selector));
    for (const element of elements) {
      if (hideWindowTitlebar) {
        element.dataset.desktopStickyHidden = "true";
        element.style.setProperty("display", "none", "important");
      } else if (element.dataset.desktopStickyHidden === "true") {
        delete element.dataset.desktopStickyHidden;
        element.style.removeProperty("display");
      }
    }
  }
}

function enforceStickyChrome(doc: Document, hideWindowTitlebar: boolean): void {
  if (!doc.body || !doc.documentElement) return;
  ensureChromeStyle(doc);
  doc.body.classList.add(STICKY_WINDOW_CLASS);
  doc.documentElement.classList.add(STICKY_WINDOW_CLASS);
  doc.body.classList.toggle(HIDDEN_TITLEBAR_CLASS, hideWindowTitlebar);
  doc.documentElement.classList.toggle(HIDDEN_TITLEBAR_CLASS, hideWindowTitlebar);
  applyInlineChromeVisibility(doc, hideWindowTitlebar);
}

function installChromeObserver(doc: Document, hideWindowTitlebar: boolean): void {
  const existing = chromeObservers.get(doc);
  if (existing) {
    existing.hideWindowTitlebar = hideWindowTitlebar;
    return;
  }
  if (!doc.body) return;

  const win = doc.defaultView ?? window;
  const state: ChromeObserverState = {
    hideWindowTitlebar,
    applying: false,
    observer: new MutationObserver(() => {
      if (state.applying) return;
      state.applying = true;
      try {
        enforceStickyChrome(doc, state.hideWindowTitlebar);
      } finally {
        win.setTimeout(() => {
          state.applying = false;
        }, 0);
      }
    }),
  };
  state.observer.observe(doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });
  chromeObservers.set(doc, state);
}

function uninstallChromeObserver(doc: Document): void {
  const state = chromeObservers.get(doc);
  if (!state) return;
  state.observer.disconnect();
  chromeObservers.delete(doc);
}

export function applyStickyWindowChrome(leaf: WorkspaceLeaf, hideWindowTitlebar: boolean): void {
  const doc = getDocumentForLeaf(leaf);
  if (!doc?.body || !doc.documentElement) return;

  enforceStickyChrome(doc, hideWindowTitlebar);
  installChromeObserver(doc, hideWindowTitlebar);
}

export function releaseStickyWindowChrome(leaf: WorkspaceLeaf): void {
  const doc = getDocumentForLeaf(leaf);
  if (!doc?.body || !doc.documentElement) return;

  const win = doc.defaultView ?? window;
  win.setTimeout(() => {
    if (doc.querySelector('.workspace-leaf-content[data-type="desktop-sticky-note"]')) return;

    uninstallChromeObserver(doc);
    applyInlineChromeVisibility(doc, false);
    doc.body.classList.remove(STICKY_WINDOW_CLASS, HIDDEN_TITLEBAR_CLASS);
    doc.documentElement.classList.remove(STICKY_WINDOW_CLASS, HIDDEN_TITLEBAR_CLASS);
    doc.getElementById(CHROME_STYLE_ID)?.remove();
  }, 0);
}

export function getBrowserWindowForWindow(win: Window): BrowserWindowLike | null {
  const remote = getRemoteFromWindow(win);
  if (!remote?.getCurrentWindow) return null;

  try {
    return remote.getCurrentWindow();
  } catch (_error) {
    return null;
  }
}

export function getBrowserWindowForLeaf(leaf: WorkspaceLeaf): BrowserWindowLike | null {
  try {
    const container = leaf.getContainer();
    return getBrowserWindowForWindow(container.win);
  } catch (_error) {
    return null;
  }
}

export function applyWindowBounds(leaf: WorkspaceLeaf, sticky: StickyNoteState): BrowserWindowLike | null {
  const browserWindow = getBrowserWindowForLeaf(leaf);
  if (!browserWindow || browserWindow.isDestroyed?.()) return browserWindow;

  const bounds = {
    x: Math.round(sticky.x),
    y: Math.round(sticky.y),
    width: Math.max(240, Math.round(sticky.width)),
    height: Math.max(180, Math.round(sticky.height)),
  };

  try {
    browserWindow.setBounds?.(bounds, false);
  } catch (_error) {
    // Some window managers reject full bounds updates; try size-only as a fallback.
    try {
      browserWindow.setSize?.(bounds.width, bounds.height, false);
    } catch (__error) {
      // Best effort only.
    }
  }

  return browserWindow;
}

export function applyWindowPreferences(
  leaf: WorkspaceLeaf,
  sticky: StickyNoteState,
  options: { skipTaskbar: boolean; hideWindowTitlebar: boolean; showNotice?: boolean },
): BrowserWindowLike | null {
  applyStickyWindowChrome(leaf, options.hideWindowTitlebar);
  const browserWindow = getBrowserWindowForLeaf(leaf);

  if (!browserWindow) {
    if (options.showNotice) {
      new Notice("无法访问 Electron 窗口 API：便签仍会打开，但置顶/透明度/标题栏控制可能不可用。", 6000);
    }
    return null;
  }

  try {
    browserWindow.setAlwaysOnTop?.(sticky.alwaysOnTop, "floating");
  } catch (_error) {
    if (options.showNotice) new Notice("当前系统不支持设置便签窗口置顶。", 5000);
  }

  try {
    browserWindow.setOpacity?.(sticky.opacity);
  } catch (_error) {
    // Opacity support varies by operating system/window manager.
  }

  try {
    browserWindow.setSkipTaskbar?.(options.skipTaskbar);
  } catch (_error) {
    // Not all platforms expose this consistently.
  }

  try {
    browserWindow.setBackgroundColor?.("#00000000");
  } catch (_error) {
    // Transparent background support varies by platform and Obsidian version.
  }

  if (options.hideWindowTitlebar) {
    try {
      browserWindow.setAutoHideMenuBar?.(true);
      browserWindow.setMenuBarVisibility?.(false);
    } catch (_error) {
      // Menu bar APIs are best effort for Obsidian pop-out windows.
    }

    try {
      browserWindow.setTitle?.(" ");
    } catch (_error) {
      // Title text is cosmetic only.
    }

    try {
      browserWindow.setWindowButtonVisibility?.(false);
    } catch (_error) {
      // macOS only; Windows/Linux native buttons are usually controlled at creation time.
    }

    try {
      browserWindow.setTitleBarOverlay?.({ color: "#00000000", symbolColor: "#00000000", height: 0 });
    } catch (_error) {
      // Title bar overlay must be enabled at BrowserWindow creation time in many Electron builds.
    }
  } else {
    try {
      browserWindow.setAutoHideMenuBar?.(false);
      browserWindow.setMenuBarVisibility?.(true);
      browserWindow.setWindowButtonVisibility?.(true);
      browserWindow.setTitle?.("Desktop Sticky Notes");
    } catch (_error) {
      // Best effort only.
    }
  }

  return browserWindow;
}

export function captureWindowBounds(browserWindow: BrowserWindowLike): Partial<StickyNoteState> | null {
  try {
    const bounds = browserWindow.getBounds?.();
    if (!bounds) return null;
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  } catch (_error) {
    return null;
  }
}
