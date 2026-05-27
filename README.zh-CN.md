# Desktop Sticky Notes

把 Obsidian Markdown 笔记像 Windows 便签一样贴在桌面上。

![PixPin_2026-05-27_17-10-56.png](https://obsidian-picgo-sunbo.oss-cn-shenzhen.aliyuncs.com/obsidian-picgo/202605271713281.png)

## 功能

- 将当前笔记或任意 Markdown 文件贴到桌面。
- 接近 Windows 便签的外观：暖色便签纸、左对齐标题栏、主题色按钮、自动隐藏顶部栏。
- 鼠标离开便签 3 秒后自动隐藏顶部标题/操作栏，并隐藏右侧滚动条。
- 置顶、透明度、隐藏任务栏图标、记忆窗口位置与尺寸。
- 预览/编辑切换，编辑内容会自动保存回原 Markdown 文件。
- Obsidian 启动时自动恢复固定便签。
- 命令面板中新建便签、恢复便签、关闭全部便签。
- 文件右键菜单：`贴到桌面便签`。

## 安装

### 手动安装

下载 Release 中的 3 个文件：

```text
main.js
manifest.json
styles.css
```

放到你的库目录：

```text
<Vault>/.obsidian/plugins/desktop-sticky-notes/
```

然后在 Obsidian 中进入 `设置 -> 第三方插件`，启用 Desktop Sticky Notes。

## 使用

命令面板中提供：

- 将当前笔记贴到桌面
- 选择笔记并贴到桌面
- 新建桌面便签
- 恢复所有桌面便签
- 关闭所有桌面便签窗口
- 切换所有已打开便签的置顶状态

也可以在文件列表中右键 Markdown 文件，选择 `贴到桌面便签`。

## 开发

```bash
npm install
npm run dev
npm run build
```

## 发布指南

第一次发布到 GitHub 或 Obsidian 社区插件目录，请看：

```text
docs/PUBLISHING_GUIDE.zh-CN.md
```

发布前还需要检查：

```text
TODO_BEFORE_PUBLISHING.md
```
