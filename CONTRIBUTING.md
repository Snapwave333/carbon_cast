# Contributing to CarbonCast IPTV

Thank you for your interest in contributing! CarbonCast is an open-source, independent fork of [IPTVnator](https://github.com/4gray/iptvnator) — all contributions that improve the player, UI, or developer experience are welcome.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (LTS recommended)
- **pnpm** via Corepack: `corepack enable`

### Setup
```bash
git clone https://github.com/Snapwave333/carbon_cast.git
cd carbon_cast
pnpm install --frozen-lockfile
pnpm run serve:backend     # Electron + Angular dev server
```

---

## 🏗️ Project Structure

This is an **Nx monorepo**. Use the table of contents to navigate:

| Path | Purpose |
| :--- | :--- |
| `apps/electron-backend/` | Electron main process (IPC, SQLite, MPV) |
| `apps/web/` | Angular renderer (UI, NgRx, players) |
| `apps/website/` | Astro marketing site |
| `libs/ui/playback/` | Video/audio player components |
| `libs/ui/epg/` | EPG timeline & multi-channel grid |
| `libs/playlist/` | M3U, Xtream, Stalker parsing & import |
| `libs/workspace/shell/` | App shell: navigation, search, playback bar |

See [`TABLE_OF_CONTENTS.md`](./TABLE_OF_CONTENTS.md) for the full map.

---

## 🔄 Development Workflow

1. **Fork** the repo and create a feature branch: `git checkout -b feat/your-feature`
2. Make your changes — keep commits focused and atomic.
3. **Test** your changes:
   ```bash
   pnpm nx test <affected-project>
   pnpm nx lint web
   ```
4. **Add a release note** if your change is user-visible (see below).
5. **Open a PR** against `main` using the PR template.

---

## 📝 Release Notes

Any user-visible change (new feature, bug fix, behavior change) needs a release note:

1. Create `.changes/<area>-<short-slug>.md`
2. Follow the format in [`.changes/README.md`](.changes/README.md)
3. Validate: `node tools/release/build-release-notes.mjs --validate`

Skip the note for: test-only, docs, CI/workflow, pure refactors with no behavior change.

---

## 🎨 Code Style

- **TypeScript** everywhere — no `any` without a comment explaining why.
- **Angular 18+** — use `@if`/`@for` control flow (not `*ngIf`/`*ngFor`).
- **SCSS** — follow the existing design token system (`--app-*`, `--mat-sys-*`); see `libs/ui/styles/`.
- **ESLint** enforces `max-lines` (target < 300, hard max 400). Do not add new files to `tools/eslint/max-lines-baseline.mjs`.
- Use scoped path aliases from `tsconfig.base.json` — e.g. `@iptvnator/services`, not bare legacy aliases.

---

## 🧪 Testing

| Command | What it runs |
| :--- | :--- |
| `pnpm nx test <project>` | Unit tests for a specific library or app |
| `pnpm run test:frontend` | All Angular unit tests |
| `pnpm run test:backend` | Electron backend unit tests |
| `pnpm nx run web-e2e:e2e-ci--src/<spec>.e2e.ts` | Atomized E2E target |

---

## 🐛 Reporting Bugs

Use the [Bug Report template](https://github.com/Snapwave333/carbon_cast/issues/new?template=---bug-report.md). Include:
- CarbonCast version
- OS and mode (Electron / PWA / Docker)
- Playlist type (M3U / Xtream / Stalker)
- Steps to reproduce

---

## 💡 Feature Requests

Use the [Feature Request template](https://github.com/Snapwave333/carbon_cast/issues/new?template=---feature-request.md).

---

## ⚖️ License

By contributing, you agree that your contributions will be licensed under the same license as this project. See [LICENSE.md](./LICENSE.md).
