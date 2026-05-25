# Desktop Sticky Notes 发布�?GitHub �?Obsidian 社区插件目录指南

这份指南面向第一次发�?GitHub 项目的作者。你可以先只发布到自己的 GitHub 仓库，确认没问题后再申请进入 Obsidian 社区插件目录�?
## 0. 你要发布的内容是什�?
这个仓库包含两类内容�?
- 源码：`src/`、`package.json`、`tsconfig.json`、`esbuild.config.mjs` 等�?- Obsidian 安装/发布文件：`main.js`、`manifest.json`、`styles.css`�?
Obsidian 社区插件安装时会�?GitHub Release 下载 `main.js`、`manifest.json`、`styles.css`。因此不能只上传源码，也不能只上传一�?ZIP 包�?
## 1. 发布前必须修改的个人信息

先打开 `TODO_BEFORE_PUBLISHING.md`，按里面的说明修改：

- `manifest.json` 里的 `author` �?`authorUrl`�?- `package.json` 里的 `author`，以及可选的 `repository`、`bugs`、`homepage`�?- `LICENSE` 里的版权姓名�?- `docs/community-plugins-entry.example.json` 里的 `author` �?`repo`�?
建议仓库名使用：

```text
obsidian-desktop-sticky-notes
```

插件 ID 保持�?
```text
desktop-sticky-notes
```

## 2. 本地构建检�?
在项目根目录打开终端，运行：

```bash
npm install
npm run build
```

成功后，确认根目录有�?3 个文件：

```text
main.js
manifest.json
styles.css
```

并确�?`manifest.json` 中版本号是：

```json
"version": "0.1.4"
```

## 3. 创建 GitHub 仓库

1. 登录 GitHub�?2. 点击右上�?`+`�?3. 选择 `New repository`�?4. Repository name 填：`obsidian-desktop-sticky-notes`�?5. Visibility 选择 `Public`�?6. 不要勾�?`Add a README file`、`.gitignore`、`license`，因为这些文件本项目已经准备好了�?7. 点击 `Create repository`�?
## 4. 把本地项目上传到 GitHub

### 方式 A：命令行，推�?
把下面命令中�?`YOUR_GITHUB_USERNAME` 改成你的 GitHub 用户名：

```bash
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/obsidian-desktop-sticky-notes.git
git push -u origin main
```

第一次推送时，GitHub 可能要求登录。按提示在浏览器中授权即可�?
### 方式 B：GitHub Desktop

1. 安装 GitHub Desktop�?2. 选择 `File -> Add local repository`�?3. 选择本项目文件夹�?4. 如果提示不是 Git 仓库，选择创建仓库�?5. 写提交信息：`Initial release`�?6. 点击 `Commit to main`�?7. 点击 `Publish repository`，并确认�?Public�?
## 5. 创建第一�?GitHub Release

发布 Obsidian 插件时，Release �?tag 必须�?`manifest.json` 里的 `version` 完全一致�?
当前版本是：

```text
0.1.4
```

注意不要写成�?
```text
v0.1.4
```

手动创建 Release 的步骤：

1. 打开你的 GitHub 仓库页面�?2. 点击右侧或顶部的 `Releases`�?3. 点击 `Draft a new release`�?4. `Choose a tag` 输入 `0.1.4`，然后选择创建�?tag�?5. Release title 填：`0.1.4`�?6. Release notes 可以复制 `docs/release/RELEASE_NOTES_0.1.4.md` 的内容�?7. 上传下面 3 个文件作为附件：
   - `main.js`
   - `manifest.json`
   - `styles.css`
8. 点击 `Publish release`�?
本仓库也内置�?`.github/workflows/release.yml`。之后你推送形�?`0.1.5` �?tag 时，它会自动构建并创�?Release�?
## 6. 验证 Release 是否正确

打开 GitHub Release 页面，确认附件区域能看到�?
```text
main.js
manifest.json
styles.css
```

不要只看到：

```text
Source code (zip)
Source code (tar.gz)
```

Obsidian 需要你手动上传或自动工作流上传�?3 个插件文件�?
## 7. 先做公开 beta 测试

在正式申请社区插件目录之前，建议先让几个朋友手动安装测试�?
1. 下载 Release 里的 `main.js`、`manifest.json`、`styles.css`�?2. 在测�?Vault 中创建目录：

```text
<Vault>/.obsidian/plugins/desktop-sticky-notes/
```

3. �?3 个文件放进去�?4. �?Obsidian 中启用第三方插件，并启用 Desktop Sticky Notes�?5. 测试：新建便签、贴到桌面、置顶、编辑自动保存、重启恢复、隐藏标题栏、窗口尺寸记忆�?
## 8. 申请进入 Obsidian 社区插件目录

确认 GitHub Release 没问题后，再提交到官方社区插件目录：

1. 打开 `obsidianmd/obsidian-releases` 仓库�?2. 点击 `Fork`，复制一份到你的账号�?3. 在你 fork 出来的仓库里编辑 `community-plugins.json`�?4. 按已有格式添加一项。可以参考本项目�?`docs/community-plugins-entry.example.json`�?5. `repo` 字段必须�?`你的用户�?你的仓库名`，例如：

```json
{
  "id": "desktop-sticky-notes",
  "name": "Desktop Sticky Notes",
  "author": "your-github-name",
  "description": "Pin Obsidian notes as Windows-style desktop sticky notes with auto-hiding toolbar, always-on-top, remembered size, and auto-save.",
  "repo": "your-github-name/obsidian-desktop-sticky-notes"
}
```

6. 保存提交后，GitHub 会提示你创建 Pull Request�?7. Pull Request 标题可以写：

```text
Add Desktop Sticky Notes plugin
```

8. 按模板勾选检查项，然后提交�?9. 等待审核。如果审核者提出修改意见，按意见修改你的插件仓库或 PR 即可�?
## 9. 后续更新版本

例如�?`0.1.4` 更新�?`0.1.5`�?
```bash
npm version patch
npm run build
git add .
git commit -m "Release 0.1.5"
git push
git tag 0.1.5
git push origin 0.1.5
```

如果使用了内�?Release workflow，推�?tag �?GitHub Actions 会自动创�?Release 并上�?`main.js`、`manifest.json`、`styles.css`�?
如果手动发布，则重复�?5 步，tag �?`0.1.5`，并上传新的 3 个文件�?
## 10. 常见错误

- Release tag 写成 `v0.1.4`：Obsidian 要求 tag �?`manifest.json` 的版本完全一致，应写 `0.1.4`�?- Release 只上传了 ZIP：Obsidian 需�?`main.js`、`manifest.json`、`styles.css` 作为单独附件�?- `manifest.json` 根目录有，Release 附件没有：两边都需要�?- 忘记�?`author`：发布前一定要�?`Your Name` 换掉�?- 插件 ID 与别人重复：提交前搜�?`community-plugins.json`，确�?`desktop-sticky-notes` 没被占用�?- 没有 README �?LICENSE：社区目录通常会要求仓库根目录包含 README �?LICENSE�?- 只在一个系统测试：这个插件用了桌面弹窗�?Electron 窗口能力，建议至少在 Windows 上完整测试�?