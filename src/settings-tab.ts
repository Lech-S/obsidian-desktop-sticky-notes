import { App, PluginSettingTab, Setting } from "obsidian";
import DesktopStickyNotesPlugin from "./main";
import { STICKY_COLORS, StickyColor, StickyMode } from "./types";

function parsePositiveInteger(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseOpacity(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0.2, parsed));
}

export class DesktopStickyNotesSettingTab extends PluginSettingTab {
  plugin: DesktopStickyNotesPlugin;

  constructor(app: App, plugin: DesktopStickyNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Desktop Sticky Notes" });
    containerEl.createEl("p", {
      text: "把 Obsidian 笔记打开为桌面便签窗口。置顶、透明度和任务栏行为依赖 Electron 桌面端能力。",
      cls: "desktop-sticky-settings-desc",
    });

    new Setting(containerEl)
      .setName("启动时恢复便签")
      .setDesc("重新打开 Obsidian 后自动恢复上次固定的便签窗口。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.restoreOnStartup)
        .onChange(async (value) => {
          this.plugin.settings.restoreOnStartup = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("新便签默认置顶")
      .setDesc("让新打开的便签窗口保持在其他应用窗口前方。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.defaultAlwaysOnTop)
        .onChange(async (value) => {
          this.plugin.settings.defaultAlwaysOnTop = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("便签不显示在任务栏")
      .setDesc("适合把便签当作桌面小组件使用；不同系统表现可能不同。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.skipTaskbar)
        .onChange(async (value) => {
          this.plugin.settings.skipTaskbar = value;
          await this.plugin.saveSettings();
          await this.plugin.applyPreferencesToOpenStickies();
        }));

    new Setting(containerEl)
      .setName("默认隐藏便签窗口标题栏")
      .setDesc("打开便签时隐藏 Obsidian 弹出窗口的标题栏，并使用便签顶部工具条作为拖动区。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.hideWindowTitlebar)
        .onChange(async (value) => {
          this.plugin.settings.hideWindowTitlebar = value;
          await this.plugin.saveSettings();
          await this.plugin.applyPreferencesToOpenStickies();
        }));

    new Setting(containerEl)
      .setName("同一笔记复用现有便签")
      .setDesc("开启后，如果某篇笔记已经被贴出，再次执行命令会打开/聚焦现有便签，而不是创建第二个。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.reuseExistingStickyForSameFile)
        .onChange(async (value) => {
          this.plugin.settings.reuseExistingStickyForSameFile = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("默认宽度")
      .setDesc("新便签窗口默认宽度，单位像素。")
      .addText((text) => text
        .setPlaceholder("360")
        .setValue(String(this.plugin.settings.defaultWidth))
        .onChange(async (value) => {
          this.plugin.settings.defaultWidth = parsePositiveInteger(value, this.plugin.settings.defaultWidth, 240, 1200);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("默认高度")
      .setDesc("新便签窗口默认高度，单位像素。")
      .addText((text) => text
        .setPlaceholder("360")
        .setValue(String(this.plugin.settings.defaultHeight))
        .onChange(async (value) => {
          this.plugin.settings.defaultHeight = parsePositiveInteger(value, this.plugin.settings.defaultHeight, 180, 1200);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("将当前默认尺寸应用到已固定便签")
      .setDesc("已有便签会记住自己的尺寸；如果旧便签尺寸不对，可用这个按钮统一重置为上方默认宽高。")
      .addButton((button) => button
        .setButtonText("应用默认尺寸")
        .onClick(async () => {
          await this.plugin.applyDefaultSizeToAllStickies();
          this.display();
        }));

    new Setting(containerEl)
      .setName("默认透明度")
      .setDesc("范围 0.2 到 1。1 表示不透明。")
      .addText((text) => text
        .setPlaceholder("1")
        .setValue(String(this.plugin.settings.defaultOpacity))
        .onChange(async (value) => {
          this.plugin.settings.defaultOpacity = parseOpacity(value, this.plugin.settings.defaultOpacity);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("默认颜色")
      .setDesc("新便签的默认背景色。")
      .addDropdown((dropdown) => {
        for (const color of STICKY_COLORS) dropdown.addOption(color, color);
        dropdown
          .setValue(this.plugin.settings.defaultColor)
          .onChange(async (value) => {
            this.plugin.settings.defaultColor = value as StickyColor;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("默认模式")
      .setDesc("新便签打开时使用预览模式还是编辑模式。")
      .addDropdown((dropdown) => dropdown
        .addOption("preview", "预览")
        .addOption("edit", "编辑")
        .setValue(this.plugin.settings.defaultMode)
        .onChange(async (value) => {
          this.plugin.settings.defaultMode = value as StickyMode;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("自动保存延迟")
      .setDesc("编辑模式下停止输入多久后保存，单位毫秒。")
      .addText((text) => text
        .setPlaceholder("700")
        .setValue(String(this.plugin.settings.autoSaveDelayMs))
        .onChange(async (value) => {
          this.plugin.settings.autoSaveDelayMs = parsePositiveInteger(value, this.plugin.settings.autoSaveDelayMs, 200, 10000);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("新建便签目录")
      .setDesc("执行“新建桌面便签”命令时，新 Markdown 文件将创建在此目录。")
      .addText((text) => text
        .setPlaceholder("Sticky Notes")
        .setValue(this.plugin.settings.newNoteFolder)
        .onChange(async (value) => {
          this.plugin.settings.newNoteFolder = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("新建便签模板")
      .setDesc("新建便签时写入文件的初始内容。支持 {{date}} 和 {{time}}。")
      .addTextArea((text) => {
        text.inputEl.rows = 5;
        text
          .setPlaceholder("例如：# {{date}}\n\n- ")
          .setValue(this.plugin.settings.newNoteTemplate)
          .onChange(async (value) => {
            this.plugin.settings.newNoteTemplate = value;
            await this.plugin.saveSettings();
          });
      });

    containerEl.createEl("h3", { text: "已固定便签" });

    const stickyStates = Object.values(this.plugin.settings.stickies)
      .sort((a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt));

    if (stickyStates.length === 0) {
      containerEl.createEl("p", { text: "还没有固定任何便签。", cls: "desktop-sticky-empty" });
      return;
    }

    for (const sticky of stickyStates) {
      new Setting(containerEl)
        .setName(sticky.filePath)
        .setDesc(`${sticky.width}x${sticky.height} · ${sticky.color} · ${sticky.alwaysOnTop ? "置顶" : "不置顶"}`)
        .addButton((button) => button
          .setButtonText("打开")
          .onClick(async () => this.plugin.openSticky(sticky.id)))
        .addButton((button) => button
          .setButtonText("移除")
          .setWarning()
          .onClick(async () => {
            await this.plugin.removeSticky(sticky.id, true);
            this.display();
          }));
    }
  }
}
