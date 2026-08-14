# CarbonCast IPTV Repository Table of Contents

Use this page as the maintained map of the CarbonCast IPTV workspace. It links
product documentation, runtime entry points, shared libraries, architecture
contracts, and maintenance tooling without treating generated output as source.

## 🚀 Start Here

| Need                          | Open                                                                                                                 | Purpose                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Product overview and setup    | [`README.md`](./README.md)                                                                                           | Features, downloads, self-hosting, and local development                    |
| Agent and contributor context | [`CLAUDE.md`](./CLAUDE.md)                                                                                           | Architecture, commands, feature ownership, and implementation notes         |
| Repository operating rules    | [`AGENTS.md`](./AGENTS.md)                                                                                           | Canonical agent workflow, validation, release-note, and documentation rules |
| User-visible history          | [`CHANGELOG.md`](./CHANGELOG.md)                                                                                     | Published release history                                                   |
| Pending release notes         | [`.changes/README.md`](./.changes/README.md)                                                                         | Format and policy for unreleased user-visible changes                       |
| Architecture contracts        | [`docs/architecture/`](./docs/architecture/)                                                                         | Maintained subsystem boundaries and behavior contracts                      |
| Package and task entry points | [`package.json`](./package.json)                                                                                     | Root scripts and workspace dependencies                                     |
| Licensing and attribution     | [`LICENSE.md`](./LICENSE.md), [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md), [`TRADEMARK.md`](./TRADEMARK.md) | Legal terms, inherited notices, and fork identity                           |

## 🗂️ Root Directory Map

| Path                                                         | Ownership                                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [`apps/`](./apps/)                                           | Deployable applications, backends, automation surfaces, mocks, and E2E suites     |
| [`libs/`](./libs/)                                           | Reusable Angular, data-access, UI, playback, persistence, and workspace libraries |
| [`docs/`](./docs/)                                           | Architecture contracts plus historical implementation plans and specifications    |
| [`tools/`](./tools/)                                         | Build, packaging, validation, release, branding, testing, and maintenance scripts |
| [`.github/`](./.github/)                                     | CI workflows, issue forms, and pull-request templates                             |
| [`docker/`](./docker/)                                       | Self-hosted PWA container and runtime documentation                               |
| [`vendor/embedded-mpv/`](./vendor/embedded-mpv/)             | Packaged Embedded MPV runtime manifests and platform notes                        |
| [`spikes/mpv-frame-copy/`](./spikes/mpv-frame-copy/)         | Frame-copy research, design notes, and prototypes—not production ownership        |
| [`patches/`](./patches/)                                     | pnpm dependency patches                                                           |
| [`.changes/`](./.changes/)                                   | One-file-per-change release-note inputs                                           |
| [`.plans/`](./.plans/)                                       | Finalized implementation plans                                                    |
| [`.codex/skills/`](./.codex/skills/)                         | Repository-specific agent playbooks                                               |
| [`carboncast-implementation/`](./carboncast-implementation/) | Branding implementation reference bundle; not a runtime application               |

### Generated or Local-Only Areas

| Path                                 | Treatment                                                              |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `.nx/`, `node_modules/`              | Tool caches and installed dependencies; regenerate instead of editing  |
| `dist/`, `coverage/`                 | Build and test output; do not use as implementation source             |
| `tmp/`                               | Disposable local artifacts and captures                                |
| `.claude/`, `.remember/`, `.entire/` | Local agent/tool state unless a tracked file explicitly says otherwise |

## ⚙️ Workspace Configuration

| File                                                                                                                                   | Responsibility                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [`nx.json`](./nx.json), [`pnpm-workspace.yaml`](./pnpm-workspace.yaml)                                                                 | Nx task defaults, plugin configuration, and pnpm workspace discovery        |
| [`tsconfig.base.json`](./tsconfig.base.json)                                                                                           | Shared TypeScript compiler options and `@iptvnator/*` compatibility aliases |
| [`eslint.config.mjs`](./eslint.config.mjs), [`.stylelintrc.json`](./.stylelintrc.json), [`.prettierrc`](./.prettierrc)                 | Code, style, and formatting policy                                          |
| [`jest.config.ts`](./jest.config.ts), [`jest.preset.js`](./jest.preset.js), [`jest.web-esm.workspace.ts`](./jest.web-esm.workspace.ts) | Unit-test discovery and Angular ESM test configuration                      |
| [`electron-builder.json`](./electron-builder.json)                                                                                     | Desktop package identity, artifacts, protocols, and platform targets        |
| [`ngsw-config.json`](./ngsw-config.json)                                                                                               | PWA service-worker asset and data caching                                   |
| [`drizzle.config.ts`](./drizzle.config.ts)                                                                                             | Drizzle schema and database tooling configuration                           |

## 🧩 Applications and Entry Points

| Path                                                         | Workspace project      | Responsibility                                                        |
| ------------------------------------------------------------ | ---------------------- | --------------------------------------------------------------------- |
| [`apps/web/`](./apps/web/)                                   | `web`                  | Angular renderer shared by Electron and the PWA                       |
| [`apps/electron-backend/`](./apps/electron-backend/)         | `electron-backend`     | Electron main process, native integration, IPC, SQLite, and packaging |
| [`apps/web-backend/`](./apps/web-backend/)                   | `web-backend`          | Self-hosted PWA HTTP backend and provider proxy                       |
| [`apps/remote-control-web/`](./apps/remote-control-web/)     | `remote-control-web`   | Mobile remote-control web client                                      |
| [`apps/website/`](./apps/website/)                           | `website`              | Astro marketing site and release blog                                 |
| [`apps/stalker-mock-server/`](./apps/stalker-mock-server/)   | `stalker-mock-server`  | Stalker/Ministra development and E2E fixture server                   |
| [`apps/xtream-mock-server/`](./apps/xtream-mock-server/)     | `xtream-mock-server`   | Xtream development, E2E, and marketing fixture server                 |
| [`apps/web-e2e/`](./apps/web-e2e/)                           | `web-e2e`              | Playwright coverage for browser/PWA workflows                         |
| [`apps/electron-backend-e2e/`](./apps/electron-backend-e2e/) | `electron-backend-e2e` | Playwright coverage for Electron-only workflows                       |
| [`apps/agent-control/`](./apps/agent-control/)               | Standalone module      | Shared authenticated live-bridge client                               |
| [`apps/mcp-server/`](./apps/mcp-server/)                     | Standalone module      | MCP stdio server for safe catalog and live playback automation        |
| [`apps/iptvctl/`](./apps/iptvctl/)                           | Standalone module      | Scriptable CLI over the agent-control bridge                          |

## 🧱 Shared Library Map

| Domain                           | Paths                                                                                                                                                                                                                                        | Responsibility                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Workspace                        | [`libs/workspace/shell/`](./libs/workspace/shell/), [`libs/workspace/dashboard/`](./libs/workspace/dashboard/)                                                                                                                               | Application shell, navigation, persistent playback bar, and home dashboard             |
| Playlist import and M3U          | [`libs/playlist/`](./libs/playlist/), [`libs/m3u-state/`](./libs/m3u-state/), [`libs/shared/m3u-utils/`](./libs/shared/m3u-utils/)                                                                                                           | Import flows, M3U routes/player, state, refresh, parsing, and filtering                |
| Portal providers                 | [`libs/portal/xtream/`](./libs/portal/xtream/), [`libs/portal/stalker/`](./libs/portal/stalker/), [`libs/portal/catalog/`](./libs/portal/catalog/), [`libs/portal/downloads/`](./libs/portal/downloads/)                                     | Xtream and Stalker data sources, catalogs, details, and downloads                      |
| Radio and podcasts               | [`libs/portal/radio/`](./libs/portal/radio/)                                                                                                                                                                                                 | Public radio/podcast discovery, local library, routed UI, audio dock, and visualizer   |
| Portal shared code               | [`libs/portal/shared/`](./libs/portal/shared/)                                                                                                                                                                                               | Shared portal data access, UI, navigation, playback state, and utilities               |
| EPG                              | [`libs/epg/data-access/`](./libs/epg/data-access/), [`libs/ui/epg/`](./libs/ui/epg/)                                                                                                                                                                                                                                                           | Guide data, mapping, followed-series scheduling, guide UI, and countdowns               |
| Playback UI                      | [`libs/ui/playback/`](./libs/ui/playback/)                                                                                                                                                                                                   | Audio/video engines, shared controls, inline playback, and source adapters             |
| Shared UI                        | [`libs/ui/components/`](./libs/ui/components/), [`libs/ui/pipes/`](./libs/ui/pipes/), [`libs/ui/remote-control/`](./libs/ui/remote-control/), [`libs/ui/shared-portals/`](./libs/ui/shared-portals/), [`libs/ui/styles/`](./libs/ui/styles/) | Cross-feature components, pipes, remote controls, portal contracts, and design tokens  |
| Runtime services                 | [`libs/services/`](./libs/services/)                                                                                                                                                                                                         | Environment-aware services, settings, metadata enrichment, and shared runtime behavior |
| Shared contracts and persistence | [`libs/shared/interfaces/`](./libs/shared/interfaces/), [`libs/shared/database/`](./libs/shared/database/), [`libs/shared/logging/`](./libs/shared/logging/)                                                                                 | IPC/types, Drizzle schema, database connection, and redacted diagnostics               |
| Fixtures and testing             | [`libs/shared/marketing-fixtures/`](./libs/shared/marketing-fixtures/), [`libs/shared/testing/`](./libs/shared/testing/)                                                                                                                     | Fictional marketing data and shared test helpers                                       |

## 🧭 Feature Ownership Quick Map

| Capability                          | Primary implementation                                                                                                                     | Canonical contract or closest guide                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Workspace shell and navigation rail | [`libs/workspace/shell/`](./libs/workspace/shell/)                                                                                         | [`workspace-shell.md`](./docs/architecture/workspace-shell.md)                         |
| Dashboard                           | [`libs/workspace/dashboard/`](./libs/workspace/dashboard/)                                                                                 | [`workspace-dashboard.md`](./docs/architecture/workspace-dashboard.md)                 |
| M3U import and playback             | [`libs/playlist/`](./libs/playlist/), [`libs/m3u-state/`](./libs/m3u-state/)                                                               | [`m3u-playlist-module.md`](./docs/architecture/m3u-playlist-module.md)                 |
| Xtream portals                      | [`libs/portal/xtream/`](./libs/portal/xtream/)                                                                                             | [`xtream-portal-compatibility.md`](./docs/architecture/xtream-portal-compatibility.md) |
| Stalker/Ministra portals            | [`libs/portal/stalker/`](./libs/portal/stalker/)                                                                                           | [`stalker-portal.md`](./docs/architecture/stalker-portal.md)                           |
| Radio and podcasts                  | [`libs/portal/radio/`](./libs/portal/radio/)                                                                                               | [`CLAUDE.md` key features](./CLAUDE.md)                                                |
| Player engines and controls         | [`libs/ui/playback/`](./libs/ui/playback/)                                                                                                 | [`player-controls-contract.md`](./docs/architecture/player-controls-contract.md)       |
| EPG and followed series             | [`libs/epg/data-access/`](./libs/epg/data-access/), [`libs/ui/epg/`](./libs/ui/epg/)                                                       | [`followed-series-auto-switch.md`](./docs/architecture/followed-series-auto-switch.md) |
| SQLite and worker operations        | [`libs/shared/database/`](./libs/shared/database/), [`apps/electron-backend/src/app/database/`](./apps/electron-backend/src/app/database/) | [`sqlite-db-worker.md`](./docs/architecture/sqlite-db-worker.md)                       |
| Remote control                      | [`apps/remote-control-web/`](./apps/remote-control-web/), [`libs/ui/remote-control/`](./libs/ui/remote-control/)                           | [`remote-control.md`](./docs/architecture/remote-control.md)                           |
| MCP, CLI, and live automation       | [`apps/agent-control/`](./apps/agent-control/), [`apps/mcp-server/`](./apps/mcp-server/), [`apps/iptvctl/`](./apps/iptvctl/)               | [`agent-control.md`](./docs/architecture/agent-control.md)                             |
| Marketing site and release media    | [`apps/website/`](./apps/website/), [`tools/release/`](./tools/release/)                                                                   | [`apps/website/README.md`](./apps/website/README.md)                                   |

## 📚 Architecture Index

| Area                         | Contracts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace and navigation     | [`workspace-shell.md`](./docs/architecture/workspace-shell.md) · [`workspace-dashboard.md`](./docs/architecture/workspace-dashboard.md) · [`navigation-ux-analysis.md`](./docs/architecture/navigation-ux-analysis.md) · [`nx-workspace-boundaries.md`](./docs/architecture/nx-workspace-boundaries.md)                                                                                                                                                                                                                                  |
| Playlist and data behavior   | [`m3u-playlist-module.md`](./docs/architecture/m3u-playlist-module.md) · [`category-management.md`](./docs/architecture/category-management.md) · [`playlist-backup-restore.md`](./docs/architecture/playlist-backup-restore.md) · [`date-handling.md`](./docs/architecture/date-handling.md) · [`sqlite-db-worker.md`](./docs/architecture/sqlite-db-worker.md)                                                                                                                                                                         |
| Xtream and Stalker providers | [`xtream-portal-compatibility.md`](./docs/architecture/xtream-portal-compatibility.md) · [`xtream-mock-server.md`](./docs/architecture/xtream-mock-server.md) · [`stalker-portal.md`](./docs/architecture/stalker-portal.md) · [`stalker-epg.md`](./docs/architecture/stalker-epg.md) · [`stalker-mock-server.md`](./docs/architecture/stalker-mock-server.md) · [`stalker-store-api-baseline.md`](./docs/architecture/stalker-store-api-baseline.md) · [`portal-detail-navigation.md`](./docs/architecture/portal-detail-navigation.md) |
| Playback and control         | [`player-controls-contract.md`](./docs/architecture/player-controls-contract.md) · [`embedded-inline-playback.md`](./docs/architecture/embedded-inline-playback.md) · [`embedded-mpv-native.md`](./docs/architecture/embedded-mpv-native.md) · [`download-manager.md`](./docs/architecture/download-manager.md) · [`remote-control.md`](./docs/architecture/remote-control.md) · [`agent-control.md`](./docs/architecture/agent-control.md) · [`followed-series-auto-switch.md`](./docs/architecture/followed-series-auto-switch.md) |
| Metadata                     | [`tmdb-metadata-enrichment.md`](./docs/architecture/tmdb-metadata-enrichment.md) · [`tmdb-roadmap.md`](./docs/architecture/tmdb-roadmap.md)                                                                                                                                                                                                                                                                                                                                                                                              |
| Platform and security        | [`electron-security.md`](./docs/architecture/electron-security.md) · [`pwa-self-hosted.md`](./docs/architecture/pwa-self-hosted.md) · [`dependency-security-overrides.md`](./docs/architecture/dependency-security-overrides.md)                                                                                                                                                                                                                                                                                                         |
| Quality and design           | [`validation-map.md`](./docs/architecture/validation-map.md) · [`iptvnator-ui-guidelines.md`](./docs/architecture/iptvnator-ui-guidelines.md)                                                                                                                                                                                                                                                                                                                                                                                            |

Historical design work lives under [`docs/superpowers/specs/`](./docs/superpowers/specs/)
and [`docs/superpowers/plans/`](./docs/superpowers/plans/). Treat the architecture
documents above and the current code as authoritative when they disagree with an
older plan.

## 🛠️ Tooling Index

| Path                                           | Responsibility                                              |
| ---------------------------------------------- | ----------------------------------------------------------- |
| [`tools/branding/`](./tools/branding/)         | Generate and verify the CarbonCast icon set                 |
| [`tools/build/`](./tools/build/)               | Build-time source generation and metadata injection         |
| [`tools/coverage/`](./tools/coverage/)         | Coverage collection, merge, health, and policy checks       |
| [`tools/embedded-mpv/`](./tools/embedded-mpv/) | Build, stage, verify, and document Embedded MPV runtimes    |
| [`tools/eslint/`](./tools/eslint/)             | Repository lint policy helpers and max-lines baseline       |
| [`tools/global/`](./tools/global/)             | Global workspace maintenance utilities                      |
| [`tools/i18n/`](./tools/i18n/)                 | Translation drift checks                                    |
| [`tools/packaging/`](./tools/packaging/)       | Installer/package identity and layout verification          |
| [`tools/playlists/`](./tools/playlists/)       | Playlist maintenance helpers                                |
| [`tools/release/`](./tools/release/)           | Release notes, screenshots, artwork, and publishing support |
| [`tools/testing/`](./tools/testing/)           | Packaged-app launch and test helpers                        |
| [`tools/tmdb/`](./tools/tmdb/)                 | Build-time TMDB key injection                               |

## ⚡ Common Commands

| Goal                                | Command                                                 |
| ----------------------------------- | ------------------------------------------------------- |
| Install exactly from the lockfile   | `pnpm install --frozen-lockfile`                        |
| Verify workspace discovery          | `pnpm nx show projects`                                 |
| Start the Electron desktop app      | `pnpm run serve:backend`                                |
| Start the browser/PWA renderer      | `pnpm run serve:frontend`                               |
| Start the marketing website         | `pnpm run serve:website`                                |
| Build Electron frontend and backend | `pnpm run build:frontend` then `pnpm run build:backend` |
| Type-check renderer and backend     | `pnpm run typecheck:ci`                                 |
| Run all unit suites                 | `pnpm run test:unit:ci`                                 |
| Lint all projects                   | `pnpm run lint`                                         |
| Verify generated icons              | `pnpm run icons:check`                                  |
| Validate pending release notes      | `pnpm run release:notes:validate`                       |
| Reset a stale Nx daemon/cache       | `pnpm nx reset`                                         |

## 🏷️ Branding and Compatibility Names

| Surface                                                                              | Rule                                                                                                       |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Product name, UI copy, website, screenshots, and new public docs                     | Use **CarbonCast IPTV** or **CarbonCast**                                                                  |
| TypeScript aliases such as `@iptvnator/*`                                            | Keep until a separately planned alias migration updates every consumer                                     |
| Environment variables such as `IPTVNATOR_*`                                          | Keep as compatibility API unless an explicit backward-compatible migration is designed                     |
| User data paths such as `~/.iptvnator` and the legacy executable/package identifiers | Keep stable so upgrades do not orphan user data or break launchers                                         |
| Historical filenames such as `iptvnator-ui-guidelines.md`                            | Keep when renaming would break links or erase upstream history; explain the compatibility boundary instead |
