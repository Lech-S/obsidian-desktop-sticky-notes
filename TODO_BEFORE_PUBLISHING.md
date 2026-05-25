# Must edit before publishing

Replace the placeholders below before you create the GitHub release or submit to the Obsidian community plugin directory.

## 1. `manifest.json`

```json
"author": "Lech-S",
"authorUrl": ""
```

Change them to your display name and GitHub/profile URL. Example:

```json
"author": "your-github-name",
"authorUrl": "https://github.com/your-github-name"
```

## 2. `package.json`

Change:

```json
"author": "Lech-S"
```

Optionally add repository metadata after you create the GitHub repository:

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/Lech-S/obsidian-desktop-sticky-notes.git"
},
"bugs": {
  "url": "https://github.com/Lech-S/obsidian-desktop-sticky-notes/issues"
},
"homepage": "https://github.com/Lech-S/obsidian-desktop-sticky-notes#readme"
```

## 3. `LICENSE`

Replace:

```text
Copyright (c) 2026 Lech-S
```

with your real name, display name, or organization name.

## 4. Obsidian community plugin entry

After you create the GitHub repository, update `docs/community-plugins-entry.example.json`:

```json
"author": "Lech-S",
"repo": "Lech-S/obsidian-desktop-sticky-notes"
```
