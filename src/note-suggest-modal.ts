import { App, FuzzySuggestModal, TFile } from "obsidian";

export class NoteSuggestModal extends FuzzySuggestModal<TFile> {
  private readonly onChooseFile: (file: TFile) => void;

  constructor(app: App, onChooseFile: (file: TFile) => void) {
    super(app);
    this.onChooseFile = onChooseFile;
    this.setPlaceholder("选择要贴到桌面的 Markdown 笔记…");
    this.emptyStateText = "没有找到匹配的 Markdown 笔记";
  }

  getItems(): TFile[] {
    return this.app.vault.getMarkdownFiles();
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onChooseFile(file);
  }
}
