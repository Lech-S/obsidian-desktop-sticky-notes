# Desktop Sticky Notes

Pin Obsidian Markdown notes as Windows-style desktop sticky notes.

![PixPin_2026-05-27_17-10-56.png](https://obsidian-picgo-sunbo.oss-cn-shenzhen.aliyuncs.com/obsidian-picgo/202605271713281.png)

[中文说明](README.zh-CN.md) | [Publishing guide in Chinese](docs/PUBLISHING_GUIDE.zh-CN.md)

## Features

- Pin the current note or any Markdown file as a desktop sticky note.
- Windows Sticky Notes inspired surface with warm note colors, a left-aligned title strip, theme-colored title-bar icons, and a large reading/writing area.
- Auto-hide the title/action strip 3 seconds after the pointer leaves the sticky note.
- Hide the right-side scrollbar while the title/action strip is hidden, while keeping mouse-wheel scrolling available.
- Always-on-top, opacity, taskbar hiding, remembered position, and remembered size.
- Preview/edit toggle with debounced auto-save back to the source Markdown file.
- Restore pinned sticky notes on Obsidian startup.
- Create a new sticky note from the command palette.
- File-menu command: `贴到桌面便签`.

## Installation

### Manual installation

Download these files from the latest GitHub Release:

```text
main.js
manifest.json
styles.css
```

Copy them into:

```text
<Vault>/.obsidian/plugins/desktop-sticky-notes/
```

Then enable the plugin from Obsidian Settings -> Community plugins.

## Usage

Open the command palette and run one of the commands below:

- Pin current note to desktop
- Pick a note and pin to desktop
- Create new desktop sticky note
- Restore all desktop sticky notes
- Close all desktop sticky note windows
- Toggle always-on-top for open sticky notes

You can also right-click a Markdown file in the file explorer and choose `贴到桌面便签`.

## Development

```bash
npm install
npm run dev
npm run build
```

For local testing, copy or symlink this repository into:

```text
<Vault>/.obsidian/plugins/desktop-sticky-notes/
```

Reload Obsidian and enable the plugin.

## Releasing

For first-time GitHub publishing and Obsidian community plugin submission, see:

```text
docs/PUBLISHING_GUIDE.zh-CN.md
```

Before publishing, replace the placeholders listed in:

```text
TODO_BEFORE_PUBLISHING.md
```

## Important notes

This plugin is desktop-only. It uses Obsidian pop-out windows plus Electron APIs for always-on-top, opacity, taskbar, sizing, and titlebar behavior. Obsidian creates the actual Electron window, so native title-bar behavior can still differ by Obsidian version and operating system.

## License

MIT
