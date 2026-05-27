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

Download the desktop-sticky-notes folder in the Release, which contains three files:

```text
main.js
manifest.json
styles.css
```

Copy them into:

```text
<Vault>/.obsidian/plugins/
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
The plug-in is developed with the help of AI tools, and the test is only completed on the windows client side. If you encounter any problems during use, please give feedback.
