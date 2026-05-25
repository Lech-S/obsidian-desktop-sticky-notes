# Contributing

Thanks for your interest in improving Desktop Sticky Notes.

## Development setup

```bash
npm install
npm run dev
```

For manual testing, copy or symlink this repository into your vault:

```text
<Vault>/.obsidian/plugins/desktop-sticky-notes/
```

Reload Obsidian and enable the plugin from Settings -> Community plugins.

## Build

```bash
npm run build
```

Before opening a pull request, make sure the build succeeds and test the plugin in Obsidian desktop.

## Release checklist for maintainers

1. Update `package.json`, `manifest.json`, and `versions.json` to the same new version.
2. Run `npm install` if dependency metadata changed.
3. Run `npm run build`.
4. Commit the changes.
5. Create a Git tag that exactly matches `manifest.json` version, for example `0.1.5`.
6. Push the tag to trigger the release workflow, or create a GitHub Release manually and upload `main.js`, `manifest.json`, and `styles.css`.
