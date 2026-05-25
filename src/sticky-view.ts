import {
  ItemView,
  MarkdownRenderer,
  Menu,
  Notice,
  setIcon,
  setTooltip,
  TFile,
  ViewStateResult,
  WorkspaceLeaf,
} from "obsidian";
import DesktopStickyNotesPlugin from "./main";
import { applyStickyWindowChrome, applyWindowPreferences, releaseStickyWindowChrome } from "./electron";
import { STICKY_COLORS, StickyNoteState, StickyViewState, VIEW_TYPE_STICKY_NOTE } from "./types";

function isStickyViewState(state: unknown): state is StickyViewState {
  return typeof state === "object" && state !== null && typeof (state as StickyViewState).stickyId === "string";
}

function fileNameWithoutExtension(file: TFile): string {
  return file.basename || file.name.replace(/\.md$/i, "");
}

export class StickyNoteView extends ItemView {
  private readonly plugin: DesktopStickyNotesPlugin;
  private stickyId: string | null = null;
  private file: TFile | null = null;
  private content = "";
  private lastSavedContent = "";
  private saveTimer: number | null = null;
  private headerHideTimer: number | null = null;
  private isSaving = false;
  private rootEl: HTMLDivElement | null = null;
  private bodyEl: HTMLDivElement | null = null;
  private statusEl: HTMLSpanElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: DesktopStickyNotesPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.navigation = false;
    this.icon = "sticky-note";
  }

  getViewType(): string {
    return VIEW_TYPE_STICKY_NOTE;
  }

  getDisplayText(): string {
    const sticky = this.currentSticky();
    if (!sticky) return "Desktop sticky note";
    const file = this.plugin.getFile(sticky.filePath);
    return file ? fileNameWithoutExtension(file) : sticky.filePath;
  }

  getState(): Record<string, unknown> {
    return {
      ...super.getState(),
      stickyId: this.stickyId,
    };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    if (isStickyViewState(state)) {
      this.stickyId = state.stickyId;
      await this.loadAndRender();
    }
  }

  protected async onOpen(): Promise<void> {
    this.contentEl.addClass("desktop-sticky-note-host");
    applyStickyWindowChrome(this.leaf, this.plugin.settings.hideWindowTitlebar);

    this.registerEvent(this.app.vault.on("modify", async (file) => {
      if (!(file instanceof TFile)) return;
      if (!this.file || file.path !== this.file.path) return;
      if (this.isSaving) return;
      await this.reloadFileFromDisk({ preserveEditText: false });
    }));

    this.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
      if (!(file instanceof TFile)) return;
      const sticky = this.currentSticky();
      if (!sticky || sticky.filePath !== oldPath) return;
      await this.plugin.updateSticky(sticky.id, { filePath: file.path });
      await this.loadAndRender();
    }));
  }

  protected async onClose(): Promise<void> {
    this.clearHeaderHideTimer();
    await this.flushSave();
    if (this.stickyId) this.plugin.markStickyClosed(this.stickyId, this.leaf);
    releaseStickyWindowChrome(this.leaf);
  }

  onPaneMenu(menu: Menu): void {
    const sticky = this.currentSticky();
    if (!sticky) return;

    menu.addItem((item) => item
      .setTitle(sticky.mode === "edit" ? "切换到预览" : "切换到编辑")
      .setIcon(sticky.mode === "edit" ? "eye" : "pencil")
      .onClick(async () => this.toggleMode()));

    menu.addItem((item) => item
      .setTitle(sticky.alwaysOnTop ? "取消置顶" : "窗口置顶")
      .setIcon("pin")
      .onClick(async () => this.toggleAlwaysOnTop()));

    menu.addItem((item) => item
      .setTitle("切换便签颜色")
      .setIcon("palette")
      .onClick(async () => this.cycleColor()));

    menu.addItem((item) => item
      .setTitle("在 Obsidian 中打开原笔记")
      .setIcon("file-text")
      .onClick(async () => this.openSourceNote()));

    menu.addSeparator();

    menu.addItem((item) => item
      .setTitle("取消固定这个便签")
      .setIcon("trash")
      .setWarning(true)
      .onClick(async () => {
        if (this.stickyId) await this.plugin.removeSticky(this.stickyId, true);
      }));
  }

  private currentSticky(): StickyNoteState | null {
    if (!this.stickyId) return null;
    return this.plugin.settings.stickies[this.stickyId] ?? null;
  }

  private async loadAndRender(): Promise<void> {
    const sticky = this.currentSticky();
    if (!sticky) {
      this.renderMissing("便签状态不存在。它可能已经被移除。 ");
      return;
    }

    const file = this.plugin.getFile(sticky.filePath);
    if (!file) {
      this.renderMissing(`找不到笔记：${sticky.filePath}`);
      return;
    }

    this.file = file;
    this.content = await this.app.vault.read(file);
    this.lastSavedContent = this.content;
    this.renderSticky(sticky, file);
    applyWindowPreferences(this.leaf, sticky, {
      skipTaskbar: this.plugin.settings.skipTaskbar,
      hideWindowTitlebar: this.plugin.settings.hideWindowTitlebar,
      showNotice: false,
    });
  }

  private renderMissing(message: string): void {
    this.contentEl.empty();
    const wrapper = this.contentEl.createDiv({ cls: "desktop-sticky-note desktop-sticky-note-missing" });
    wrapper.createEl("strong", { text: "Desktop Sticky Notes" });
    wrapper.createEl("p", { text: message });
    const closeButton = wrapper.createEl("button", { text: "关闭" });
    closeButton.addEventListener("click", () => this.leaf.detach());
  }

  private renderSticky(sticky: StickyNoteState, file: TFile): void {
    this.clearHeaderHideTimer();
    this.statusEl = null;
    this.contentEl.empty();
    this.rootEl = this.contentEl.createDiv({
      cls: `desktop-sticky-note desktop-sticky-note-${sticky.color} desktop-sticky-note-${sticky.mode}${sticky.alwaysOnTop ? " is-pinned" : ""}`,
    });

    const header = this.rootEl.createDiv({ cls: "desktop-sticky-header" });

    const title = header.createDiv({ cls: "desktop-sticky-title" });
    const titleText = title.createSpan({ text: fileNameWithoutExtension(file), cls: "desktop-sticky-title-text" });
    titleText.setAttribute("title", file.path);

    const actions = header.createDiv({ cls: "desktop-sticky-actions" });
    this.addIconButton(actions, sticky.alwaysOnTop ? "pin-off" : "pin", sticky.alwaysOnTop ? "取消置顶" : "窗口置顶", () => this.toggleAlwaysOnTop(), "is-pin");
    this.addIconButton(actions, sticky.mode === "edit" ? "eye" : "pencil", sticky.mode === "edit" ? "切换到预览" : "切换到编辑", () => this.toggleMode(), "is-mode");
    this.addIconButton(actions, "palette", "切换便签颜色", () => this.cycleColor(), "is-color");
    this.addIconButton(actions, "external-link", "在 Obsidian 中打开原笔记", () => this.openSourceNote(), "is-source");
    this.addIconButton(actions, "trash", "取消固定这个便签", async () => {
      if (this.stickyId) await this.plugin.removeSticky(this.stickyId, true);
    }, "is-remove");
    this.addIconButton(actions, "x", "关闭便签", async () => {
      await this.flushSave();
      this.leaf.detach();
    }, "is-close");

    this.bodyEl = this.rootEl.createDiv({ cls: "desktop-sticky-body" });
    this.installHeaderAutoHide(this.rootEl);

    if (sticky.mode === "edit") {
      this.renderEditor();
    } else {
      void this.renderPreview();
    }
  }

  private installHeaderAutoHide(root: HTMLDivElement): void {
    const showHeader = () => {
      this.clearHeaderHideTimer();
      root.classList.remove("is-header-hidden");
    };

    const scheduleHide = () => {
      this.clearHeaderHideTimer();
      this.headerHideTimer = window.setTimeout(() => {
        this.headerHideTimer = null;
        if (!root.isConnected) return;
        if (root.matches(":hover")) return;
        root.classList.add("is-header-hidden");
      }, 3000);
    };

    root.addEventListener("mouseenter", showHeader);
    root.addEventListener("mousemove", showHeader);
    root.addEventListener("focusin", showHeader);
    root.addEventListener("mouseleave", scheduleHide);
    root.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (!root.contains(root.ownerDocument.activeElement)) scheduleHide();
      }, 0);
    });
  }

  private clearHeaderHideTimer(): void {
    if (this.headerHideTimer === null) return;
    window.clearTimeout(this.headerHideTimer);
    this.headerHideTimer = null;
  }

  private addIconButton(container: HTMLElement, icon: string, tooltip: string, callback: (event: MouseEvent) => void | Promise<void>, extraClass?: string): HTMLButtonElement {
    const button = container.createEl("button", { cls: "desktop-sticky-icon-button", attr: { "aria-label": tooltip, type: "button" } });
    if (extraClass) button.addClass(extraClass);
    setIcon(button, icon);
    setTooltip(button, tooltip);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void callback(event);
    });
    return button;
  }

  private renderEditor(): void {
    if (!this.bodyEl) return;
    this.bodyEl.empty();
    const textarea = this.bodyEl.createEl("textarea", {
      cls: "desktop-sticky-editor",
      attr: { spellcheck: "true" },
    });
    textarea.value = this.content;
    textarea.addEventListener("input", () => {
      this.content = textarea.value;
      this.setStatus("正在输入…");
      this.scheduleSave();
    });
    textarea.addEventListener("blur", () => void this.flushSave());
    window.setTimeout(() => textarea.focus(), 30);
  }

  private async renderPreview(): Promise<void> {
    if (!this.bodyEl || !this.file) return;
    this.bodyEl.empty();
    const previewEl = this.bodyEl.createDiv({ cls: "desktop-sticky-preview markdown-preview-view markdown-rendered" });
    await MarkdownRenderer.render(this.app, this.content, previewEl, this.file.path, this);
    this.setStatus(this.content.trim() ? "预览" : "空白便签");
  }

  private async toggleMode(): Promise<void> {
    await this.flushSave();
    const sticky = this.currentSticky();
    if (!sticky) return;
    const nextMode = sticky.mode === "edit" ? "preview" : "edit";
    await this.plugin.updateSticky(sticky.id, { mode: nextMode });
    const latest = this.currentSticky();
    if (latest && this.file) this.renderSticky(latest, this.file);
  }

  private async toggleAlwaysOnTop(): Promise<void> {
    const sticky = this.currentSticky();
    if (!sticky) return;
    await this.plugin.updateSticky(sticky.id, { alwaysOnTop: !sticky.alwaysOnTop });
    const latest = this.currentSticky();
    if (!latest) return;
    applyWindowPreferences(this.leaf, latest, {
      skipTaskbar: this.plugin.settings.skipTaskbar,
      hideWindowTitlebar: this.plugin.settings.hideWindowTitlebar,
      showNotice: true,
    });
    if (this.file) this.renderSticky(latest, this.file);
  }

  private async cycleColor(): Promise<void> {
    const sticky = this.currentSticky();
    if (!sticky || !this.file) return;
    const index = STICKY_COLORS.indexOf(sticky.color);
    const nextColor = STICKY_COLORS[(index + 1) % STICKY_COLORS.length];
    await this.plugin.updateSticky(sticky.id, { color: nextColor });
    const latest = this.currentSticky();
    if (latest) this.renderSticky(latest, this.file);
  }

  private async openSourceNote(): Promise<void> {
    if (!this.file) return;
    await this.app.workspace.getLeaf("tab").openFile(this.file);
    new Notice(`已在 Obsidian 中打开：${this.file.path}`, 2500);
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.flushSave();
    }, this.plugin.settings.autoSaveDelayMs);
  }

  private async flushSave(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    if (!this.file) return;
    if (this.content === this.lastSavedContent) return;

    const contentToSave = this.content;
    this.isSaving = true;
    this.setStatus("保存中…");

    try {
      await this.app.vault.process(this.file, () => contentToSave);
      this.lastSavedContent = contentToSave;
      this.setStatus("已保存");
      if (this.stickyId) await this.plugin.touchSticky(this.stickyId);
    } catch (error) {
      console.error("Desktop Sticky Notes: failed to save note", error);
      new Notice("便签保存失败，请查看开发者控制台。", 6000);
      this.setStatus("保存失败");
    } finally {
      this.isSaving = false;
    }
  }

  private async reloadFileFromDisk(options: { preserveEditText: boolean }): Promise<void> {
    if (!this.file) return;
    const sticky = this.currentSticky();
    if (!sticky) return;

    const diskContent = await this.app.vault.read(this.file);
    this.lastSavedContent = diskContent;

    if (sticky.mode === "edit" && options.preserveEditText && this.content !== this.lastSavedContent) {
      return;
    }

    this.content = diskContent;
    if (this.file) this.renderSticky(sticky, this.file);
  }

  private setStatus(message: string): void {
    if (this.statusEl) this.statusEl.setText(message);
  }
}
