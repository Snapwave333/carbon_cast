# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> The process sections below (Plan Mode, Documentation After Changes, Regression Prevention, Agent Bootstrap, Electron CDP Debugging) are mirrored in `AGENTS.md`, which is the canonical copy for agent workflows. When updating one, keep the other in sync.

## Repository Navigation

| Guide                                            | Purpose                                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| [`TABLE_OF_CONTENTS.md`](./TABLE_OF_CONTENTS.md) | Canonical map of apps, libraries, feature ownership, architecture docs, tools, and generated folders |
| [`README.md`](./README.md)                       | Product overview, downloads, self-hosting, and contributor setup                                     |
| [`AGENTS.md`](./AGENTS.md)                       | Canonical repository workflow and validation rules for coding agents                                 |
| [`docs/architecture/`](./docs/architecture/)     | Maintained subsystem contracts; prefer these over historical plans                                   |
| [`.changes/README.md`](./.changes/README.md)     | Release-note schema and writing policy                                                               |

Start repository exploration from the table of contents instead of recursively
scanning generated output such as `node_modules/`, `dist/`, `coverage/`, `.nx/`,
or `tmp/`.

## Plan Mode

- When Claude Code is in Plan Mode and produces a final `<proposed_plan>`, it must also save that finalized plan as a Markdown file in the repo-root `.plans/` directory.
- Save only finalized plans. Do not write interim exploration, question turns, or draft revisions to `.plans/`.
- Use the filename pattern `YYYY-MM-DD-short-topic.md` such as `.plans/2026-03-12-channel-filtering.md`.
- If the intended filename already exists, append a numeric suffix such as `-2`, `-3`, and so on.

## Documentation After Changes

- After implementing a meaningful change, Claude Code must assess whether canonical repo docs need updates before considering the task complete.
- Meaningful changes include new or changed user-visible behavior, architecture or data-flow changes, non-obvious maintenance workflows, new setup/debugging steps, and new subsystem contracts or boundaries.
- Skip doc updates for trivial refactors with unchanged behavior, formatting-only edits, and isolated test-only changes.
- Prefer updating an existing authoritative doc before creating a new one:
    1. `README.md` for top-level developer or user workflows
    2. `docs/architecture/` for architecture, ownership, and behavior contracts
    3. the nearest module `README.md` for local usage or behavior
- Keep this file (`CLAUDE.md`) itself up to date. It is a living document: whenever a change touches something it describes — monorepo structure (new/moved/renamed apps or libs), routes, database schema/tables, stores and their features, key components, commands, environment behavior, or coding conventions — update the affected `CLAUDE.md` sections as part of the same task, and keep the mirrored process sections in `AGENTS.md` in sync.
- When adding a new feature area, check whether the Architecture or Key Features sections of `CLAUDE.md` describe the surrounding area; if they do, reflect the addition there instead of leaving the description stale.
- Do not let `CLAUDE.md` drift: a stale path or route in this file poisons the context of every future agent session. If you notice an outdated claim while working, fix it (or flag it in the final summary) even if it is unrelated to the current task.
- Repo docs are canonical even when they were originally drafted by an LLM.
- Final task summaries should state whether docs were updated and which doc changed.

## Release Notes For User-Visible Changes

- Any change a user could notice — new behavior, changed behavior, bug fix, performance win, breaking change — must add one note file under `.changes/` in the same PR. Format, field table, and writing rules: `.changes/README.md`.
- Name it `<area>-<short-slug>.md`; `area` matches the conventional-commit scope. There is no version field — the release version is chosen at release time.
- Write the body for a user, not a reviewer: "the player now remembers volume between episodes", not "hoist volume state into the session". Max 400 characters; depth belongs in the release blog post.
- Skip the note for test-only changes, docs, CI/workflow plumbing, and pure refactors with no behavior change. When skipping on a PR that touches `apps/**` or `libs/**`, apply the `no-release-note` label.
- CI enforces this: the "Release note gate" job in `.github/workflows/ci.yml` fails PRs that change runtime code without an added `.changes/*.md` or the label (policy in `tools/release/check-release-note-gate.mjs`; tests/e2e/website/mock-server/docs paths are auto-exempt).
- The `release-notes` skill covers writing notes; the `release-cut` skill covers the full release sequence.
- Validate before finishing: `pnpm run release:notes:validate`.
- Release-post screenshots come only from the release capture script running against the mock servers. Never add a screenshot taken from a real playlist or account to `apps/website/public/blog/**` — real streams, logos, and metadata are copyrighted, and credentials must never reach a published image.
- Final task summaries should state whether a release note was added or why it was skipped.

## Regression Prevention And Test Updates

- Before the final summary for any feature, behavior change, bug fix, data-flow change, Electron IPC/database change, or user-visible UI workflow change, Claude Code must complete a test impact pass. Identify the affected projects and decide whether unit, integration, E2E, build, lint, or manual/CDP verification is required.
- Bug fixes must normally include regression coverage that fails on the old behavior and passes with the fix. If automated coverage is not practical, document why in the final summary and include the strongest manual validation performed.
- Feature work and behavior changes must update existing tests when assertions, fixtures, mocks, routes, or E2E flows are now stale, incomplete, or missing. Prefer extending the closest existing spec or E2E file before adding a new suite.
- Default validation ladder:
    1. Run targeted unit tests for directly affected projects with `pnpm nx test <project>` or existing scripts such as `pnpm run test:frontend`, `pnpm run test:backend`, or `pnpm run test:unit:ci` when the scope is broader.
    2. Run affected E2E coverage when changing user-visible workflows, routing, persistence, playback, portals, settings, import flows, or Electron-only behavior.
    3. Use `pnpm nx show projects --withTarget test` and `pnpm nx show projects --withTarget e2e` when project ownership or available validation targets are unclear.
    4. Prefer specific atomized E2E targets before broad suites when they cover the changed behavior, for example `pnpm nx run web-e2e:e2e-ci--src/xtream.e2e.ts` or `pnpm nx run electron-backend-e2e:e2e-ci--src/search.e2e.ts`.
- Electron-specific changes affecting IPC, SQLite, packaged runtime, external players, native file access, or Electron-only routes require Electron E2E coverage where available, or CDP/manual verification with `agent-browser` and the tracing flags documented below.
- Final task summaries must list tests added or updated, validation commands run with results, and any skipped validation with the reason. For docs-only changes, state that unit/E2E validation was not required and verify the changed Markdown instead.

## Project Overview

CarbonCast IPTV is a cross-platform IPTV player built with Angular and Electron.
It supports M3U/M3U8 playlists, Xtream Codes, Stalker/Ministra portals, public
radio and podcast discovery, desktop automation, and a self-hosted PWA. It is an
independent fork of IPTVnator and retains upstream attribution.

**Dual Environment Support**: The application is designed to work in both Electron and as a Progressive Web App (PWA). The architecture uses a factory pattern to inject environment-specific services at runtime, ensuring the same codebase works in both contexts.

### Branding Compatibility Boundary

| Surface                                                                          | Rule                                                                                         |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| User-visible name, copy, artwork, website, and new public documentation          | Use **CarbonCast IPTV** or **CarbonCast**                                                    |
| TypeScript path aliases such as `@iptvnator/*`                                   | Intentionally retained; changing them requires a separately planned workspace-wide migration |
| Environment variables such as `IPTVNATOR_*`                                      | Compatibility API; do not silently rename or remove                                          |
| User-data paths such as `~/.iptvnator` and legacy executable/package identifiers | Keep stable so upgrades preserve profiles, databases, scripts, and launchers                 |
| Upstream references and historical filenames                                     | Keep when needed for attribution, compatibility, or link stability                           |

## Development Commands

### Agent Bootstrap

```bash
pnpm install --frozen-lockfile
pnpm nx show projects
```

- Run the install step in a fresh worktree before relying on Nx discovery, lint, test, or build commands. Without `node_modules`, local Nx modules are unavailable.
- Use scoped path aliases from `tsconfig.base.json` such as `@iptvnator/services`, `@iptvnator/shared/interfaces`, and `@iptvnator/ui/components`.
- Do not add new imports from legacy bare aliases such as `services`, `shared-interfaces`, `components`, `m3u-state`, or `database`.
- Every Nx project should keep `scope:*`, `domain:*`, and `type:*` tags in `project.json`.
- See `docs/architecture/nx-workspace-boundaries.md` for the current Nx tag and alias policy.
- Repository-specific skills are committed under `.codex/skills/`. Claude Code only discovers skills under `.claude/skills/`, so `release-notes` and `release-cut` are mirrored there and the two copies must be kept in sync; every other entry in `.claude/skills/` is personal and stays gitignored. If an agent does not load skills directly, treat those files as concise ownership docs.

### Building and Serving

```bash
# Serve the Angular web app only (development mode, baseHref="/")
pnpm run serve:frontend
# or
nx serve web

# Serve with PWA configuration (optimized, baseHref="/")
pnpm run serve:frontend:pwa
# or
nx serve web --configuration=pwa

# Serve the Electron app (starts both frontend and backend)
pnpm run serve:backend
# or
nx serve electron-backend

# Build frontend for Electron (baseHref="./")
pnpm run build:frontend
# or
nx build web

# Build frontend for PWA deployment (baseHref="/")
pnpm run build:frontend:pwa
# or
nx build web --configuration=pwa

# Build backend (Electron)
pnpm run build:backend
# or
nx build electron-backend

# Package the app (creates distributable without installers)
pnpm run package:app
# or
nx run electron-backend:package

# Create installers/executables
pnpm run make:app
# or
nx run electron-backend:make
```

### Electron CDP Debugging

- Start Electron in dev mode with: `nx serve electron-backend`
- Package-script equivalent: `pnpm run serve:backend`
- The workspace is configured to always launch Electron with: `--remote-debugging-port=9222`
- Use CDP clients (Chrome DevTools Protocol tools) against: `127.0.0.1:9222`
- When the task is Electron automation/debugging, use the `electron` skill
- Do not auto-open DevTools during normal CDP automation. In development, DevTools is opt-in via `ELECTRON_OPEN_DEVTOOLS=1`.
- If DevTools is open, `agent-browser --cdp 9222 ...` may attach to the DevTools page instead of the CarbonCast window (symptoms: `tab list` shows `about:blank`, empty snapshots, black screenshots). Inspect targets with `curl http://127.0.0.1:9222/json/list` and connect directly to the app page's `webSocketDebuggerUrl`.
- The app holds a single-instance lock (`acquireSingleInstanceLock` in `apps/electron-backend/src/app/services/single-instance.ts`): a second launch against the same `userData` quits immediately and focuses the running window. To attach a second CDP-enabled instance to the same profile, set `IPTVNATOR_ALLOW_MULTIPLE_INSTANCES=1` — knowing that only one of the two processes will own the renderer's IndexedDB, so settings written by the other are lost. Before focusing, the guard forwards the second launch's argv to `onSecondInstance`, which is how a playlist path handed to an already-running app reaches the open queue.

For startup tracing or white-screen debugging:

```bash
IPTVNATOR_TRACE_STARTUP=1 nx serve electron-backend
```

Useful narrower flags:

- `IPTVNATOR_TRACE_IPC=1` traces renderer `window.electron.*` bridge calls
- `IPTVNATOR_TRACE_DB=1` traces DB worker requests and DB progress events
- `IPTVNATOR_TRACE_SQL=1` traces SQLite statements in both main and worker connections
- `IPTVNATOR_TRACE_WINDOW=1` traces BrowserWindow navigation/load lifecycle
- `IPTVNATOR_TRACE_PLAYER=1` traces external-player activity and bounded Embedded MPV runtime-probe stderr
- `IPTVNATOR_TRACE_RENDERER_CONSOLE=1` mirrors renderer console logs into the Electron terminal
- `IPTVNATOR_PERF_CAPTURE=1` enables development/test-only, redacted M3U and Xtream preload IPC request/completion markers plus count-only M3U acquire/parse/normalize, Xtream main network/JSON-transform/success-response-ready/cancel-dispatch, and renderer store phase capture; renderer wrappers emit only while the benchmark installs its Symbol hook, benchmark tooling sets the flag explicitly, and production launches must leave it unset
- `IPTVNATOR_PERF_WORKER_PROFILING=1` enables development/test-only, request-scoped worker receive/work/response-post timestamps, thread CPU, event-loop utilization/delay, count-only playlist serialization/SQLite write/read/deserialization plus Xtream category/content/cache-clear/delete/in-source-search phase events, profiling-only worker cancel-receipt acknowledgements, valid-sample-counted isolate peak memory, and the database worker's idle-only one-shot post-GC heap probe; overlapping database requests are explicitly invalidated instead of misattributed, the performance benchmark sets the flag automatically, and production launches must leave it unset

Settings, portal request/response, and trace payloads must use
`@iptvnator/shared/logging` or the redacting portal logger before reaching
`console.*`; never log raw credentials while debugging.

If the Nx daemon gets into a bad state before rerunning Electron:

```bash
pnpm nx reset
```

Use global `agent-browser` (preferred):

```bash
# Verify CDP targets
agent-browser --cdp 9222 tab list

# Switch to the app tab and inspect interactive elements
agent-browser --cdp 9222 tab 1
agent-browser --cdp 9222 snapshot -i -c -d 4

# Capture debug artifacts
agent-browser --cdp 9222 screenshot /tmp/carboncast-cdp.png
agent-browser --cdp 9222 trace start /tmp/carboncast.trace.zip
agent-browser --cdp 9222 wait 1500
agent-browser --cdp 9222 trace stop /tmp/carboncast.trace.zip
```

If `agent-browser` is not in PATH, use:

```bash
npx --yes agent-browser --cdp 9222 tab list
```

### Testing

```bash
# Run frontend tests
pnpm run test:frontend
# or
pnpm nx test web

# Run backend tests
pnpm run test:backend
# or
pnpm nx test electron-backend

# Run targeted E2E tests (Playwright)
pnpm nx run web-e2e:e2e-ci--src/xtream.e2e.ts
pnpm nx run electron-backend-e2e:e2e-ci--src/search.e2e.ts

# Run broad E2E suites only when the impact justifies it
pnpm nx e2e web-e2e
pnpm nx e2e electron-backend-e2e

# Run tests with coverage when needed
pnpm nx test web --configuration=ci
```

Before finishing behavior changes or bug fixes, follow `Regression Prevention And Test Updates` above and report the test impact decision in the final summary.

### Linting

```bash
# Lint all projects (CI runs this on master; PRs lint affected projects)
pnpm run lint

# Lint a single project
nx lint web
nx lint electron-backend
```

CI lints affected projects on PRs (`nx affected`) and every project on master
pushes (`.github/workflows/ci.yml`). This enforces the
Nx module-boundary tags, the legacy bare-alias ban, and a `max-lines` ESLint
rule (hard maximum 400 lines per TypeScript file). Pre-existing oversized files
are baselined in `tools/eslint/max-lines-baseline.mjs`; regenerate the baseline
with `node tools/eslint/generate-max-lines-baseline.mjs` after splitting a file.
Never add new files to the baseline — the list must only shrink. A new file
that genuinely cannot be split (for example a function serialized into another
process) instead carries its own file-wide
`/* eslint-disable max-lines -- <why> */`; the generator skips those files, so
a justified exemption never lands in the baseline.

Project `lint` targets that shell out to eslint must quote the glob, e.g.
`eslint "apps/<project>/**/*.ts"`. An unquoted `**` is expanded by the POSIX
shell on Linux and macOS (which has no `globstar`, so it matches only a
shallow subset of files) while Windows passes the literal pattern to ESLint,
which expands it recursively — the two hosts then lint different file sets.
The target still reports success either way, so a broken glob hides missing
coverage instead of failing. After changing such a target, compare the linted
file count against `find <project> -name '*.ts' | wc -l`.

## Architecture

### Monorepo Structure (Nx Workspace)

This is an Nx monorepo. Use [`TABLE_OF_CONTENTS.md`](./TABLE_OF_CONTENTS.md) for
the complete navigable directory, feature ownership, documentation, and tooling
map; keep this architectural summary aligned with it.

- **apps/web** - Angular application (frontend, shared by Electron and PWA)
- **apps/electron-backend** - Electron main process
- **apps/web-backend** - HTTP backend for the self-hosted PWA (`/parse`, `/parse-xml`, `/xtream`, `/stalker` CORS proxy endpoints)
- **apps/remote-control-web** - Mobile remote-control web app served by the Electron backend
- **apps/agent-control** - Shared authenticated bridge client used by local automation surfaces
- **apps/mcp-server** - MCP stdio server for safe catalog reads and live bridge forwarding
- **apps/iptvctl** - Scriptable CLI over the same live bridge client
- **apps/web-e2e** - Playwright E2E tests against the web app
- **apps/electron-backend-e2e** - Playwright E2E tests against the Electron app
- **apps/stalker-mock-server** - Mock Stalker/Ministra portal for dev and E2E
- **apps/xtream-mock-server** - Mock Xtream Codes API for dev and E2E
- **apps/website** - Astro + Tailwind landing page and blog
- **apps/remotion-brand** - Remotion authoring project for animated brand assets. Not an Nx project (no `project.json`), so it is excluded from `run-many`, lint and test. Build-time only: the rendered asset is committed and no Remotion code ships. Note Remotion is not MIT-licensed — see `apps/remotion-brand/README.md`
- **libs/** - Shared libraries:
    - **epg/data-access** - EPG services, runtime bridge, program normalization, followed-series matching, and auto-switch scheduling
    - **m3u-state** - NgRx state management for M3U playlists
    - **playlist/import/feature** - Playlist import flows (file/URL/text upload, Xtream and Stalker import dialogs)
    - **playlist/m3u/feature-player** - M3U video player page and `/workspace/playlists/:id` routes
    - **playlist/shared/{ui,util}** - Shared playlist UI and utilities
    - **portal/xtream/{data-access,feature}** - XtreamStore, services, data sources; routed Xtream components
    - **portal/stalker/{data-access,feature}** - StalkerStore and routed Stalker components
    - **portal/catalog/feature** - Portal catalog UI
    - **portal/downloads/feature** - Download manager UI
    - **portal/radio/{data-access,feature}** - Internet radio and podcasts: Radio Browser / iTunes / RSS clients and local library in `data-access`; the routed page, grids, audio dock, and WebGL visualizer in `feature`
    - **portal/shared/{data-access,ui,util}** - Cross-portal shared code
    - **services** - Abstract DataService contract and shared app services (incl. the TMDB metadata enrichment module in `lib/tmdb/`)
    - **shared/interfaces** - TypeScript interfaces and types (incl. `ElectronBridgeApi`)
    - **shared/logging** - Dependency-free structured redaction for diagnostic logs
    - **shared/database** - Canonical Drizzle schema and DB connection (used by the Electron backend)
    - **shared/m3u-utils** - M3U playlist utilities
    - **shared/marketing-fixtures** - Provider-neutral fictional movie metadata shared by the Xtream and Stalker marketing mocks
    - **shared/testing** - Shared test helpers
    - **ui/components** - Reusable UI components (incl. channel list)
    - **ui/epg** - EPG UI (timeline ribbon, multi-EPG, progress panel, program dialogs, followed-series schedule, and countdown overlay)
    - **ui/playback** - Player UI (video/audio players)
    - **ui/pipes** - Angular pipes
    - **ui/remote-control** - Remote-control UI pieces
    - **ui/shared-portals** - Shared portal types (`LiveEpgPanelSummary`)
    - **ui/styles** - Shared styles/theme
    - **workspace/{shell,dashboard}** - Workspace shell (layout/navigation) and dashboard

### Frontend Architecture (Angular)

**State Management**: Uses NgRx for playlist state management:

- Store configuration in `apps/web/src/app/app.config.ts`
- Playlist state, actions, effects, and reducers in `libs/m3u-state/`
- Entity adapter pattern for managing playlists collection
- Router store integration for route-based state

**XtreamStore Architecture** (Signal Store with Feature Composition):

The Xtream Codes module uses NgRx Signal Store with a layered architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│              Components use XtreamStore (facade)                 │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FACADE LAYER                             │
│                         XtreamStore                              │
│            (Composes feature stores, unified API)                │
└─────────────────────────────────────────────────────────────────┘
                                  │
        ┌────────────┬────────────┼────────────┬────────────┐
        ▼            ▼            ▼            ▼            ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│  withPortal│ │withContent │ │withSelection│ │ withSearch │ │ withPlayer │
└────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘
        │                           │              │
        └───────────────────────────┼──────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA SOURCE LAYER                             │
│                   IXtreamDataSource                              │
│         ┌───────────────────┬───────────────────┐               │
│         ▼                   ▼                                    │
│  ElectronDataSource    PwaDataSource                            │
│  (DB-first + API)      (API-only)                               │
└─────────────────────────────────────────────────────────────────┘
```

File structure:

```
libs/portal/xtream/
├── data-access/src/lib/
│   ├── stores/
│   │   ├── features/
│   │   │   ├── with-portal.feature.ts             # Playlist & portal status
│   │   │   ├── with-content.feature.ts            # Categories & streams
│   │   │   ├── with-selection.feature.ts          # UI selection & pagination
│   │   │   ├── with-search.feature.ts             # Search functionality
│   │   │   ├── with-epg.feature.ts                # EPG data
│   │   │   ├── with-player.feature.ts             # Stream URLs & player
│   │   │   ├── with-playback-positions.feature.ts # Resume/playback positions
│   │   │   └── index.ts
│   │   ├── xtream.store.ts                        # Facade composing all features
│   │   └── index.ts
│   ├── services/
│   │   ├── xtream-api.service.ts                  # Xtream Codes API calls
│   │   ├── xtream-url.service.ts                  # Stream URL construction
│   │   ├── favorites.service.ts                   # Favorites persistence
│   │   ├── epg-queue.service.ts                   # EPG fetch queueing
│   │   ├── xtream-xmltv-fallback.service.ts       # XMLTV fallback EPG
│   │   └── index.ts
│   ├── data-sources/
│   │   ├── xtream-data-source.interface.ts        # Abstract interface + types
│   │   ├── electron-xtream-data-source.ts         # DB-first implementation
│   │   ├── pwa-xtream-data-source.ts              # API-only implementation
│   │   └── index.ts                               # provideXtreamDataSource() factory
│   ├── with-favorites.feature.ts                  # Favorites feature
│   └── with-recent-items.ts                       # Recently viewed feature
└── feature/src/lib/                               # Routed components
    ├── xtream-feature.routes.ts                   # createXtreamRoutes(): /workspace/xtreams/:id tree
    ├── live-stream-layout/, vod-details/, serial-details/, ...
    └── global-search-results/                     # Global search (Electron-only route)
```

Key patterns:

- **Feature stores**: Each `with*.feature.ts` uses `signalStoreFeature()` for focused functionality
- **Facade pattern**: `XtreamStore` composes all features, maintaining backward compatibility
- **Data source abstraction**: `IXtreamDataSource` interface with environment-specific implementations
- **Factory injection**: `provideXtreamDataSource()` selects Electron or PWA implementation at runtime

Data strategies by environment:

| Environment  | Strategy                                                |
| ------------ | ------------------------------------------------------- |
| **Electron** | DB-first: Check DB → fetch API if missing → cache to DB |
| **PWA**      | API-only: Always fetch from API, store in memory        |

**M3U Playlist Module Architecture**:

The M3U playlist module handles traditional M3U/M3U8 playlists with support for 90,000+ channels.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VIDEO PLAYER PAGE                            │
│        libs/playlist/m3u/feature-player/src/lib/video-player/       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌───────────────────────────────────────────────┐│
│  │   Sidebar   │  │        Video Player (ArtPlayer/Video.js)      ││
│  │ ┌─────────┐ │  │                                               ││
│  │ │Channel  │ │  ├───────────────────────────────────────────────┤│
│  │ │List     │ │  │  EPG timeline ribbon (app-epg-timeline)       ││
│  │ │Container│ │  │  horizontal, under the player                 ││
│  │ └─────────┘ │  └───────────────────────────────────────────────┘│
│  └─────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

The live EPG panel is a horizontal **timeline ribbon** under the player (`app-epg-timeline`, `libs/ui/epg/src/lib/epg-timeline/`), not a right-side drawer (reworked in PR #1102). See `docs/architecture/m3u-playlist-module.md` for the timeline's controllers and scroll behavior.

**Radio Channel Layout** (when `channel.radio === 'true'`):

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌─────────────┐  ┌────────────────────────────────────────────────┐│
│  │   Sidebar   │  │  Blurred backdrop (station logo)              ││
│  │             │  │  ┌──────────┐                                 ││
│  │             │  │  │ Artwork  │  ← cinematic hero layout        ││
│  │             │  │  └──────────┘                                 ││
│  │             │  │  Station Name                                 ││
│  │             │  │  [LIVE] badge                                 ││
│  │             │  │  ⏮  ▶/⏸  ⏭   ← transport controls          ││
│  │             │  │  🔊 ━━━━━━━━━  ← volume slider               ││
│  │             │  │  (no EPG panel)                               ││
│  └─────────────┘  └────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

Key radio behavior:

- Detection: `channel.radio === 'true'` (string from M3U `radio` attribute)
- The audio player always renders inline — `shouldShowInlinePlayer` is bypassed for radio
- EPG panel is conditionally hidden in the template when radio is active
- Volume is shared with video player via `localStorage` key `'volume'`
- Keyboard: ArrowUp/Down adjusts volume by 5%, M toggles mute
- Component: `libs/ui/playback/src/lib/audio-player/audio-player.component.ts`

Channel List Component Structure (parent coordinator pattern):

```
libs/ui/components/src/lib/channel-list-container/
├── channel-list-container.component.ts   # Parent - shared state coordinator
├── all-channels-view/                     # Virtual scroll + debounced search
├── groups-view/                           # Expansion panels + infinite scroll
└── channel-list-item/                     # Individual channel display
```

`activeView` only ever receives `guide`, `all` or `groups`: the playlist route
tree matches `favorites` and `recent` before its `:view` segment and sends both
to `M3uCollectionRouteComponent`, so the container has no favorites or recent
view of its own.

Key patterns:

- **EnrichedChannel**: Pre-computed EPG data attached to channels for performance
- **Parent coordinator**: Manages shared signals (`channelEpgMap`, `progressTick`, `favoriteIds`)
- **Virtual scrolling**: CDK virtual scroll for 90,000+ channel lists
- **Infinite scroll**: IntersectionObserver in groups view loads 50 items at a time
- **Global progress tick**: Single 30s interval instead of per-item intervals

State management via NgRx (`libs/m3u-state/`):

- `PlaylistActions`: loadPlaylists, addPlaylist, removePlaylist, parsePlaylist
- `ChannelActions`: setChannels, setActiveChannel, setAdjacentChannelAsActive
- `EpgActions`: setActiveEpgProgram, setCurrentEpgProgram, setEpgAvailableFlag
- `FavoritesActions`: updateFavorites, setFavorites, hydrateFavorites

See `docs/architecture/m3u-playlist-module.md` for complete documentation.

**Routing**: Lazy-loaded routes in `apps/web/src/app/app.routes.ts`. All user-facing routes are nested under the workspace shell (`/workspace/...`); `/` redirects into the workspace.

- Dashboard: `/workspace/dashboard`; sources overview: `/workspace/sources`
- M3U player: `/workspace/playlists/:id` (children: `favorites`, `recent`, `:view` where `:view` covers `guide`/`all`/`groups`) — routes in `libs/playlist/m3u/feature-player`. The empty path redirects via a function reading `Settings.playlistDefaultSection` (default `guide`; falls back to `all` when `RuntimeCapabilitiesService.supportsEpg` is false, i.e. the PWA). The `guide` view embeds `MultiEpgContainerComponent` inline (its `COMPONENT_OVERLAY_REF` is optional for this) with any playing channel in a compact strip above it; it clips overnight programmes into the selected day, keeps a real minute-driven today playhead, supports keyboard programme activation, generation-gates pagination/search, and exposes Today/retry actions. `Settings.resumeLastChannel` (default on) re-activates the playlist's most recent `recentlyViewed` m3u item when the playlist opens with nothing playing, falling back to the first channel when there is no history to resume (or the remembered channel has left the playlist), so an opened playlist always starts playing
- Xtream Codes: `/workspace/xtreams/:id` (children: `live`, `vod`, `series`, `search`, `actor/:personId`, `recently-added`, `favorites`, `recent`, `downloads`) — `libs/portal/xtream/feature/src/lib/xtream-feature.routes.ts`
- Stalker portal: `/workspace/stalker/:id` (children: `itv`, `vod`, `radio`, `series`, `favorites`, `recent`, `search`, `actor/:personId`, `downloads`) — `libs/portal/stalker/feature/src/lib/stalker-feature.routes.ts`
- Global collections: `/workspace/global-favorites`, `/workspace/global-recent`
- Radio & podcasts: `/workspace/radio` — `libs/portal/radio/feature`. Not playlist-scoped, so it carries no portal context rail
- Global search: `/workspace/search` (Electron-only; a guard redirects the PWA to `/workspace/sources`)
- Downloads: `/workspace/downloads`
- Settings: `/workspace/settings` (`/settings` redirects there)

**Service Architecture** (Factory Pattern):

- Abstract `DataService` class in `libs/services/src/lib/data.service.ts` defines the contract
- Two environment-specific implementations:
    - `ElectronService` (`apps/web/src/app/services/electron.service.ts`) - Uses IPC to communicate with Electron backend
    - `PwaService` (`apps/web/src/app/services/pwa.service.ts`) - Uses HTTP API and IndexedDB for standalone web version
- Factory function `DataFactory()` in `apps/web/src/app/app.config.ts` determines which implementation to inject:
    ```typescript
    if (window.electron) {
        return inject(ElectronService);
    }
    return inject(PwaService);
    ```

**Data Storage (Environment-Specific)**:

- **Electron**: SQLite database via Drizzle ORM (`better-sqlite3` driver)
    - Location: `~/.iptvnator/databases/iptvnator.db`
    - Full-featured relational database with foreign keys and indexes
    - Canonical schema and connection live in `libs/shared/database`
- **PWA (Web)**: IndexedDB via `ngx-indexed-db`
    - Browser-based NoSQL storage
    - Same schema structure but implemented in IndexedDB
    - Limited by browser storage quotas

**TypeScript File Size Rule**:

Keep TypeScript files under **300 lines**. Hard maximum is **350–400 lines**.

- When creating new files, design them to stay within this limit from the start.
- When adding a feature to an existing file that would push it past 350 lines, **refactor first**: extract helpers, sub-services, or feature modules before adding the new code.
- When you notice a file already exceeds 350 lines, **proactively suggest a refactoring** (or perform it if the change is straightforward) — even if the immediate task is small.

Typical split strategies:

- Angular components: extract child components, move logic to a dedicated service or store feature
- Signal store features: split into smaller `with*` feature functions in separate files
- Services: split by responsibility (e.g. separate API, transformation, and state concerns)
- Utility files: group by domain and export from a barrel `index.ts`

This rule exists to keep the codebase navigable and reviewable. A 150-line file is always preferable to a 500-line file.

---

**Angular Coding Standards**:

This project uses modern Angular signal-based APIs and patterns. **ALWAYS** use the following:

- **Component Queries**: Use `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()` instead of `@ViewChild`, `@ViewChildren`, `@ContentChild`, `@ContentChildren` decorators

    ```typescript
    // ✅ Correct - Signal-based
    readonly menu = viewChild.required<MatMenu>('menuRef');
    readonly items = viewChildren<ElementRef>('item');

    // ❌ Incorrect - Old decorator syntax
    @ViewChild('menuRef') menu!: MatMenu;
    @ViewChildren('item') items!: QueryList<ElementRef>;
    ```

    **Important**: When using signals in templates with properties that expect non-signal values, unwrap the signal by calling it:

    ```html
    <!-- ✅ Correct - Unwrap the signal -->
    <button [matMenuTriggerFor]="menu()">Open Menu</button>

    <!-- ❌ Incorrect - Signal not unwrapped -->
    <button [matMenuTriggerFor]="menu">Open Menu</button>
    ```

- **Component Inputs/Outputs**: Use `input()` and `output()` functions instead of `@Input()` and `@Output()` decorators

    ```typescript
    // ✅ Correct - Signal-based
    readonly title = input.required<string>();
    readonly size = input<number>(10); // with default value
    readonly clicked = output<string>();

    // ❌ Incorrect - Old decorator syntax
    @Input({ required: true }) title!: string;
    @Input() size = 10;
    @Output() clicked = new EventEmitter<string>();
    ```

- **Reactive State**: Use signal primitives for reactive state management

    ```typescript
    // ✅ Use signal(), computed(), effect(), linkedSignal()
    readonly count = signal(0);
    readonly doubled = computed(() => this.count() * 2);

    constructor() {
        effect(() => {
            console.log('Count changed:', this.count());
        });
    }
    ```

- **Host Bindings**: Use `@HostBinding()` and `@HostListener()` decorators (these don't have signal equivalents yet)

    ```typescript
    @HostBinding('class.active') get isActive() { return this.active(); }
    @HostListener('click') onClick() { /* ... */ }
    ```

- **Control Flow**: Use `@if`, `@for`, `@switch` instead of `*ngIf`, `*ngFor`, `*ngSwitch`

    ```typescript
    // ✅ Correct - Modern syntax
    @if (isLoggedIn()) {
        <p>Welcome!</p>
    }

    @for (item of items(); track item.id) {
        <li>{{ item.name }}</li>
    }

    // ❌ Incorrect - Old syntax
    <p *ngIf="isLoggedIn">Welcome!</p>
    <li *ngFor="let item of items; trackBy: trackById">{{ item.name }}</li>
    ```

### Backend Architecture (Electron)

**Main Entry**: `apps/electron-backend/src/main.ts`

- Bootstraps Electron app and initializes database
- Registers event handlers for IPC communication
- Holds a single-instance lock (`app/services/single-instance.ts`), requested after the `userData` override so E2E runs with their own data dir keep independent locks. A second launch quits and focuses the running window; concurrent instances would otherwise share a Chromium profile whose IndexedDB only one of them can lock, silently breaking renderer-side settings persistence. `IPTVNATOR_ALLOW_MULTIPLE_INSTANCES=1` opts out for local debugging. The guard also forwards that launch's argv and working directory, so `iptvnator playlist.m3u` against a running app opens the playlist instead of being discarded.

**Database**:

- **ORM**: Drizzle ORM with `better-sqlite3` (local SQLite file)
- **Location**: `~/.iptvnator/databases/iptvnator.db` (avoids spaces in path)
- **Schema** (`libs/shared/database/src/lib/schema.ts` — canonical; `apps/electron-backend/src/app/database/schema.ts` is a backwards-compat re-export shim):
    - `playlists` - Playlist metadata (M3U, Xtream, Stalker)
    - `categories` - Content categories (live, movies, series)
    - `content` - Streams/VOD/series items
    - `favorites` - User favorites
    - `recentlyViewed` - Watch history
    - `epgChannels`, `epgPrograms` - Persisted EPG data
    - `epgChannelMappings` (`epg_channel_mappings`) - Manual EPG channel mappings (defined in `epg-mapping.schema.ts`, re-exported by `schema.ts`)
    - `playbackPositions` - Resume positions
    - `downloads` - Download manager state
    - `appState` - Key-value app state (also tracks one-off data migrations)
    - `tmdbMetadata` - TMDB enrichment cache (details payloads + search match resolutions, keyed by media type/lookup key/language)
- **Connection**: `libs/shared/database/src/lib/connection.ts`
    - `createTables()` auto-creates tables on init (`CREATE TABLE IF NOT EXISTS`)
    - Provides full read-write access for `electron-backend` and a read-only mode
    - A root `drizzle.config.ts` configures Drizzle Kit tooling (points at the schema via the compat shim)

**IPC Communication**:

- **Preload script**: `apps/electron-backend/src/app/api/main.preload.ts`
    - Exposes `window.electron` API via `contextBridge`
    - All IPC channels defined here (playlist operations, EPG, database CRUD, external players, etc.)
    - The canonical TypeScript contract is `ElectronBridgeApi` in `libs/shared/interfaces/src/lib/electron-api.interface.ts`; `global.d.ts`, `apps/web/src/typings.d.ts`, and `main.preload.ts` must reference this shared type instead of maintaining separate method lists.
- **Event handlers**: `apps/electron-backend/src/app/events/`
    - `database.events.ts` - Database CRUD operations
    - `playlist.events.ts` - Playlist import/update
    - `playlist-open.events.ts` - Playlist files handed over by the OS (argv, file association, macOS `open-file`); the queue itself lives in `services/playlist-open-request.ts`
    - `epg.events.ts` - EPG IPC registration; freshness/fetch orchestration lives in `epg-fetch.service.ts`, manual channel-mapping resolution and CRUD in `epg-mapping.service.ts`, worker lifecycle in `epg-worker.service.ts`, DB lookups in `epg-query.service.ts`
    - `xtream.events.ts` - Xtream Codes API
    - `stalker.events.ts` - Stalker portal API
    - `player.events.ts` - External player IPC registration; MPV/VLC lifecycle logic lives in `mpv-session.service.ts`, `vlc-session.service.ts`, and shared `external-player-*` helpers
    - `settings.events.ts` - App settings
    - `remote-text.events.ts` - `FETCH_REMOTE_TEXT`: fetches a podcast RSS feed on the renderer's behalf. Deliberately narrow (GET only, public hosts only via the `validateRemoteUrl` SSRF guard, no renderer-supplied headers, 12 MB cap) because the renderer cannot read those feeds itself — publishers rarely send CORS headers
    - `electron.events.ts` - App version, etc.

**Workers** (`apps/electron-backend/src/app/workers/`):

- EPG parsing: `epg-parser.worker.ts`; main-process worker lifecycle is coordinated from `apps/electron-backend/src/app/events/epg-worker.service.ts`
- Non-EPG SQLite work: `database.worker.ts` (see `docs/architecture/sqlite-db-worker.md`)
- Playlist refresh: `playlist-refresh.worker.ts`; explicit cancellation is main-process-owned and terminates the one-shot worker before acknowledging `PLAYLIST_CANCEL_REFRESH` (see `docs/architecture/m3u-playlist-module.md`)

### Key Features

**Playlist Support**:

- M3U/M3U8 files (local or URL)
- Xtream Codes API (`username`, `password`, `serverUrl`)
- Stalker portal (`macAddress`, `url`)

**Opening a playlist from the OS** (Electron only): a `.m3u`/`.m3u8` path passed
on the command line, opened through a file association, or delivered by macOS'
`open-file` event is normalized to an absolute path in the main process
(`services/playlist-open-request.ts`) and queued there. The renderer
(`apps/web/src/app/services/playlist-open-request.service.ts`) subscribes to the
`OPEN_FILE` push **before** calling `announcePlaylistOpenListener`, which is
what makes the main process flush. `OPEN_FILE` is the only way out of the
queue, and a request stays there until the renderer confirms receipt via
`acknowledgePlaylistOpenRequest` — `webContents.send()` returns before the
listener runs, and a reload or dead render process keeps the `WebContents`
alive, so a successful push is not proof of delivery. Anything unacknowledged
is replayed to the next renderer that announces itself. The renderer
imports them on a single promise chain so a burst arrives in a deterministic
order. `addPlaylist$` in `libs/m3u-state` uses `concatMap` (not `switchMap`)
for the same reason: each action carries a different playlist, so a newer add
must never cancel an older one's write, EPG fetch and navigation. The import
itself reuses the normal file path
(`updatePlaylistFromFilePath` → `PlaylistActions.addPlaylist`), so persistence,
playlist-scoped EPG, and the navigation to the new playlist all behave exactly
like a dialog import.

The OS-level registration that makes those paths reachable is
`fileAssociations` in `electron-builder.json` — one entry per extension, each
with its own `mimeType`. Electron Builder derives all three platform
registrations from it: macOS `CFBundleDocumentTypes` (which is what makes
`open-file` fire from Finder), the NSIS registry entries, and, on Linux, the
desktop entry's `MimeType` plus `/usr/share/mime/packages/iptvnator.xml` for
deb/rpm/pacman. Two traps: it assigns the derived `MimeType` _after_ spreading
`linux.desktop.entry`, so declaring `MimeType` there is silently overwritten and
must not be used; and it appends `%U` to `Exec`, so Linux file managers hand
over percent-encoded `file://` URIs rather than paths —
`createPlaylistOpenRequest` decodes them before the extension check. `%U` is
also the _plural_ exec code, so a multi-file selection arrives as one launch
with one argument per file; `extractPlaylistOpenRequestsFromArgv` returns all
of them and `enqueueAll` queues the batch, because stopping at the first match
would silently drop the rest of the selection. Adding an exec code to
`linux.executableArgs` would suppress the `%U` but also pass that code to the
app as a real argument, so it is not an option.

**Video Players**:

- Built-in web players: HTML5+hls.js, Video.js, and ArtPlayer. `HtmlVideoPlayerComponent.playChannel` is async and **awaits** the `setUserAgent` IPC before starting a source engine: the header override lives in the main process and only takes effect once that IPC lands, so starting the engine first sent the manifest request with default headers and providers gating on user-agent rejected it. That await is bounded (`configureRequestHeaders` in `html-video-request-headers.ts`): an IPC that never settles — a main process wedged on a long import, a dead bridge — would otherwise leave the player permanently black with no diagnostic, so after the timeout playback proceeds with default headers. A `playbackGeneration` counter discards a channel that was superseded while awaiting, and cancels a pending start on destroy. A provider item with a blank `streamUrl` never reaches an engine, so `WebPlayerViewComponent` raises a `missing-stream-url` diagnostic itself rather than leaving every engine on a silent black surface
- DASH + ClearKey (M3U module): `.mpd` channels play through a lazily loaded
  Shaka Player source engine inside the HTML5 and ArtPlayer components (no new
  player in settings). ClearKey keys come from `#KODIPROP:inputstream.adaptive.*`
  lines, post-processed into `Channel.drm` by `extractDrmFromRaw()` in
  `libs/shared/m3u-utils` (hooked in `createPlaylistObject()`, covering all
  import paths). DASH channels always play inline: `isDashChannel()` bypasses
  the external-player setting (radio precedent) and routes Video.js/MPV/VLC/
  embedded-MPV users to the HTML5 player via `playerOverride` (ArtPlayer keeps
  ArtPlayer). Unsupported license types (Widevine/PlayReady — out of scope,
  need the castLabs Electron fork) surface a DRM playback diagnostic instead
  of crashing. ClearKey EME works in stock Electron. Engine:
  `libs/ui/playback/src/lib/shaka-engine/`; details in
  `docs/architecture/m3u-playlist-module.md` ("DASH + ClearKey Playback").
- External players: MPV, VLC (via IPC to Electron backend)
- Embedded MPV (experimental, macOS/Windows/Linux): renders mpv video inside the Electron window through a native addon. macOS uses the libmpv render API in an `NSOpenGLView`; Windows uses in-process libmpv with `--wid` against an app-owned child `HWND`; Linux spawns an out-of-process `mpv --wid=<x11-window>` controlled over a JSON IPC socket (X11/XWayland only, requires system `mpv` on PATH; subtitles/speed/aspect/recording are not exported there). mpv's own screensaver inhibition does not apply to any of these paths, so `EmbeddedMpvNativeService` holds an Electron `powerSaveBlocker` (`prevent-display-sleep`) whenever any session's status is `playing`, and releases it on pause, dispose, or shutdown. Renderer bounds are CSS pixels; the service converts them to native units in the main process (`embedded-mpv-bounds.util.ts`: × page zoom everywhere, × display scale on Windows/Linux whose child windows are positioned in physical pixels; frame-copy bounds stay unscaled), and the session controller re-syncs bounds when `devicePixelRatio` changes. Service: `apps/electron-backend/src/app/services/embedded-mpv-native.service.ts`; full architecture: `docs/architecture/embedded-mpv-native.md`.
- Embedded MPV frame-copy engine (experimental, macOS Apple Silicon + Linux
  x64 + Windows; enabled via `Settings > Playback > Embedded MPV: frame-copy
engine` (restart required) or
  `IPTVNATOR_ENABLE_EMBEDDED_MPV_FRAME_COPY=1` on top of the embedded MPV
  experiment flag): a per-session helper renders mpv offscreen (CGL on macOS,
  EGL on Linux, WGL on Windows), publishes BGRA frames into a shm ring, and the
  preload frame pump uploads them to
  `<canvas data-embedded-mpv-frame>`. Shared `app-player-controls` owns the DOM
  UI; native-view retains the legacy dock. On Linux, only
  `iptvnator_mpv_helper` may link libmpv; Electron, its shipped libraries, the
  addon, and frame reader must not. Pristine afterPack/unpacked layouts scan
  Electron libraries recursively; extracted Snap payloads exclude only the
  package-manager `lib/**` and `usr/lib/**` trees overlaid into the same root.
  Every other directory remains recursive, and Electron-library symlinks still
  fail closed. `electron-backend/native{,/**/*}` is excluded from `app.asar`;
  `afterPack` alone owns the profile-normalized unpacked native tree, and
  package checks reject every archived `/electron-backend/native/**` entry.
  Packaged addon, frame-reader, and helper discovery uses only package-owned
  `app.asar.unpacked` paths; cwd/dist candidates remain development-only.
  Official x64 packages use three separate profiles:
  DEB/RPM/Pacman depend on system libmpv plus the helper's direct
  EGL/GL/GBM interfaces, AppImage/Snap bundle the pinned LGPL closure, and
  Flatpak bundles the same closure. Flatpak is an isolated packaging pass and
  keeps `iptvnator` as the real Electron ELF so Electron Builder's
  `electron-wrapper` passes it directly to Zypak. Other Linux targets retain the
  conditional `iptvnator` wrapper and `iptvnator.bin`. Mixed
  Flatpak/non-Flatpak target sets fail before mutation. Exact system
  dependencies are DEB=`libmpv2,libegl1,libgl1,libgbm1`,
  RPM=`mpv-libs,libglvnd-egl,libglvnd-glx,mesa-libgbm`, and
  Pacman=`mpv,libglvnd,mesa`. The DEB contract is verified on Ubuntu 24.04+;
  Ubuntu 22.04 users need the x64 AppImage because Jammy provides `libmpv1`.
  ARM packages are marker-only. Stored or explicit opt-ins cannot bypass the
  fail-closed packaged manifest/file/hash gate and bounded `--runtime-probe`;
  any failure keeps the sandbox enabled, records a stable reason, and falls
  back to native-view without crashing. Snap is `core22`/strict and uses an
  exact private `shared-memory` plug plus the `graphics-core22` content plug at
  a real empty mode-0755 `$SNAP/graphics`, with external `mesa-core22` as the
  default provider. Its only provider-data layouts bind `/usr/share/libdrm`
  from `$SNAP/graphics/libdrm` and symlink `/usr/share/drirc.d` to
  `$SNAP/graphics/drirc.d`. Installed-Snap CI requires controlled unavailable
  status after disconnect, then reconnects and requires success. The helper
  links `libGL.so.1`, and probe/playback share a sanitized loader environment
  in which ambient audit, preload, library, graphics-driver, and shell-startup
  overrides are removed; the validated private closure plus trusted host GL,
  graphics-content, core22 base x64, and exact GNOME-platform roots have
  explicit precedence. The core22 base stays ahead of GNOME so the older
  `libedit.so.2` requiring `libtinfo.so.5` cannot shadow the base ABI. The
  extracted-artifact verifier removes the identical unsafe loader/graphics/
  shell set before direct helper smoke while preserving selectors such as
  `LIBGL_ALWAYS_SOFTWARE`. Snap fixes the wrapper `PATH`,
  removes exported `BASH_FUNC_*` functions, and
  launches probe/playback through the regular executable
  `$SNAP/graphics/bin/graphics-core22-provider-wrapper`; a missing or
  disconnected provider returns `snap-graphics-provider-unavailable` before
  helper spawn. The packaging-only
  `--embedded-mpv-runtime-probe` app switch runs the complete packaged gate
  before BrowserWindow startup and emits one availability JSON line. A nonzero
  helper exit keeps top-level reason `helper-probe-failed`; `helperReason` is
  present only for an exact protocol-v1 line carrying a fixed allowlisted
  reason, and its optional `helperDetail` must be 1–1024 printable ASCII
  characters. Invalid detail suppresses both helper fields. Every probe uses
  an explicit 16 MiB aggregate captured-output ceiling independent of tracing.
  With `IPTVNATOR_TRACE_PLAYER=1`, non-empty helper stderr is emitted separately
  as one JSON-escaped stderr line with a 16,384-character `stderr` limit and an
  explicit `truncated` field; trace-write failure cannot change availability.
  Installed-Snap CI enables Mesa EGL/GL diagnostics through this bounded
  channel. The exact packaged Flatpak `/app` context reconstructs only
  Freedesktop Platform 24.08's immutable
  `__EGL_EXTERNAL_PLATFORM_CONFIG_DIRS`; its CI smoke invokes that
  application-level probe instead of the helper directly. The packaged x64
  Playwright smoke runs its fixture-contract target first and passes Chromium
  `--ignore-gpu-blocklist` so CI llvmpipe exposes WebGL2; this does not bypass
  the runtime gate, and `--no-sandbox` remains root-only. Bundled Linux
  packages carry hash-validated
  `embedded-mpv-notices.json`, `THIRD_PARTY_NOTICES.txt`, and `licenses/**`.
  CI caches the staged runtime plus immutable source inputs, never finished
  notices or the compliance tarball; it regenerates those notices and the
  VCS-metadata-free `linux-frame-copy-runtime-sources.tar.xz` for the current
  checkout while preserving the exact pinned six recursive libplacebo
  submodule records. Each record is canonical `full-commit safe/path`;
  clone-depth dependent `git describe` annotations are discarded and never
  form part of the provenance identity. Its source index carries the globally sorted libplacebo
  directory/file/symlink inventory; file hashes, sizes, executable bits, link
  targets, aggregates, and canonical tree digest must match the trusted pinned
  checkout. The archive has an exact member/type layout and its
  `metadata/archive-sha256.txt` records must match the actual source archives.
  Concatenated tar/xz streams are inspected past every end marker. Every
  bundled x64 package manifest binds the final archive's SHA-256 and repository
  revision; system and marker-only packages do not carry that binding. Snap
  Store
  publication runs only from a public `v*` GitHub release that already
  contains the Snap assets and exactly one source archive. Before any upload,
  the workflow hashes and checks the archive's exact member/type set and size
  bounds, verifies its clean tag revision, pinned sources including the six
  recursive submodule records and exact libplacebo tree digest, legal payload,
  and exact released tooling, then performs bounded extraction and static
  validation for every Snap. That public-release boundary independently
  revalidates the exact strict `meta/snap.yaml` graphics/shared-memory
  contract and enumerates `resources/app.asar`, rejecting any archived
  `electron-backend/native/**` payload before publication. Its bounded ASAR
  header reader uses only Node built-ins and released local tooling, so the
  clean tag checkout does not require `node_modules`. Exactly one x64 Snap
  must have matching
  `sourceArchive` and `sourceRuntime`; any non-x64 Snap remains marker-only.
  Checkout and artifact-transfer actions are pinned to full commits; checkout
  does not persist credentials, and repository credentials are scoped to
  download steps. A secretless verification job copies assets through
  no-follow descriptors, checks them before and after inspection, writes an
  exact receipt, fully reverifies a root-owned read-only snapshot, and
  transfers only that data through the pinned artifact service while passing
  the receipt digest separately through a job output. The dependent publish
  job uses a bounded `ubuntu-latest` runner with no checkout or release-tag
  code, verifies that digest plus the exact receipt, asset hashes, and
  file-only layout, root-seals the data again, and installs Snapcraft directly.
  Its final fixed shell step alone receives the Store credential, resolves no
  PATH command, executes no released code, and exposes that credential only to
  each exact
  `/snap/bin/snapcraft upload --release=edge` process. Candidate/stable
  promotion is manual after installed-Snap frame-copy and missing-runtime
  fallback smoke; GitHub Actions never promotes automatically. On Windows,
  package validation requires the exact MPV DLL named by the helper's PE import
  table beside the executable.
  Backend adapter:
  `apps/electron-backend/src/app/services/embedded-mpv-frame-copy.adapter.ts`;
  shared-controls adapter:
  `libs/ui/playback/src/lib/embedded-mpv-player/embedded-mpv-controls.adapter.ts`;
  helper: `apps/electron-backend/native/helper/`; canonical packaging/runtime
  contracts: `docs/architecture/embedded-mpv-native.md` and
  `tools/embedded-mpv/README.md`.
- Shared player-controls layer: `libs/ui/playback/src/lib/player-controls/` exports the engine-neutral `PlayerController` contract, standalone `app-player-controls`, a generic web-video adapter/helper, and component-scoped `WEB_PLAYER_SHARED_CONTROLS` rollout token. In fullscreen, `app-player-controls` shows a pointer-transparent media-title overlay at the top while controls are revealed (`mediaTitle` input: movie/channel/series name, plus an `S01E03` second line for episodes; series names flow from the detail views through `PortalInlinePlayerComponent.seriesTitle` and `WebPlayerViewComponent.mediaTitle`). Persisted `Settings.webPlayerSharedControls` is default-off, and its checkbox appears only when HTML5, Video.js, or ArtPlayer is selected. `WebPlayerViewComponent` snapshots the preference into the immutable token for each new player host. The parent `/workspace` route awaits the initial `SettingsStore` load, including cold-start direct links, before this snapshot can occur. Saving applies to the next host without an application restart; an existing session never changes controls mode in place. Embedded MPV ignores the web-player preference: frame-copy always uses shared DOM controls through `EmbeddedMpvControlsAdapter`, native-view retains its compositor-safe legacy dock, and external MPV/VLC retain their own UI. The Embedded MPV host selects exactly one controls UI for its reported engine. `showControls=false` detaches the shared surface, modal overlays gate frame-copy playback shortcuts, fullscreen remains DOM-based with Embedded MPV bounds sync, and a playback/session transition key prevents engine or session handoff from presenting stale recording feedback while timers and pending commands are cancelled. Same-session IPC replies yield to a broadcast snapshot received while the command was pending, so a successful recording acknowledgement cannot be rolled back by a stale reply. The built-in HTML5/hls.js player is the second guarded consumer: `HtmlVideoPlayerComponent` provides a component-scoped `WebVideoControlsAdapter`, while its neutral `web-video-support` bridge is shared with ArtPlayer and owns HLS/Shaka(DASH)/native tracks, MPEG-TS VOD duration correction, caption preference, and source cleanup. `HtmlVideoElementSession` owns native video-event lifecycle, persisted volume, and start-time/time/ended propagation. Video.js is the third guarded consumer: `VjsPlayerComponent` provides a component-scoped `WebVideoControlsAdapter`; its bridge rebinds the current Tech video after `playerreset`, exposes source-stable audio/subtitle IDs, preserves caption preference and explicit subtitle-off state, and reads Video.js duration. Reset-driven raw MPEG-TS changes pause first, coalesce to the latest desired source, preserve actual volume across Video.js's reset, and restart when authoritative live/VOD metadata changes. In shared-controls mode, Video.js native controls, click/double-click/hotkey actions, and spatial navigation are disabled. ArtPlayer is the fourth guarded consumer: `ArtPlayerComponent` provides a component-scoped `WebVideoControlsAdapter`; `ArtPlayerSourceSession` owns HLS/DASH(Shaka)/MPEG-TS/native sources, the neutral web-video bridge, exact cleanup, and a destroyed-session guard for delayed `customType` callbacks, while `ArtPlayerVideoSession` owns native media/ArtPlayer events. Shared ArtPlayer mode uses authoritative live/VOD metadata, HLS/Shaka/native tracks and caption preference, MPEG-TS VOD duration correction, and reapplies app volume directly after ArtPlayer restores its own stored volume. Vendor chrome/hotkeys are disabled, and a transparent capture layer gives shared controls exclusive click and double-click ownership. `WebPlayerViewComponent.resolvedIsLive` supplies authoritative metadata; visible playback diagnostics disable shared pointer/keyboard ownership and exit only the active HTML5, Video.js, or ArtPlayer shell's own fullscreen so retry/fallback actions remain visible. On the preference-off path, all three web players retain their existing controls, source behavior, and legacy series navigation. `Settings.showCaptions` is deliberately outside this rollout gate: it is engine state, so the preference-off players apply it through the same helpers without an adapter (`WebVideoSourceTracks` for HTML5/ArtPlayer, `VjsLegacyTracks` for Video.js), re-applying it as the engine adds or switches text tracks. The two modes differ in how long it is enforced: shared controls are authoritative for the session (user intent arrives via `setSubtitleTrack`), while vendor chrome is source-default — the preference seeds each new source and is released once the media reports `playing`, so the engine's own caption menu keeps working. Mode selection is the optional `playbackStarted` probe the legacy owners pass to all three helpers (HLS, native text tracks, Shaka); in that mode the HLS helper deselects (`subtitleTrack = -1`) rather than hiding, since `subtitleDisplay` would override the vendor menu, and DASH is seeded by `ShakaVideoSession.start()` after the manifest loads. `WebPlayerViewComponent` reads it from `SettingsStore` instead of a host input so every host (M3U, Xtream/Stalker live layouts, portal detail inline player) inherits it. Playback shortcuts are unmodified Space/K, F, arrow keys, M, plus Home/End and the digits `0`-`9`, which seek to a fraction of the duration (`3` = 30%) and therefore share the seek gate and never apply to live streams. A `loading` status or a `stalled` state renders a centred buffering indicator (`role="status"`, translated `LOADING_STREAM`); before it, both states only greyed the transport buttons out and a buffering stream gave no feedback. Its visual is a 30-frame sprite strip authored in `apps/remotion-brand` and rendered to `apps/web/src/assets/animations/loading-loop.webp`, stepped with a CSS `steps(30)` transform — frame count, 48px display size and the 1.25s loop duration are hardcoded in the SCSS and must change together with the composition. The `WebVideoControlsAdapter` refreshes on every native media event, so `timeupdate`/`progress` alone fire several times a second: its injected track getters are read through memoized signals (one engine read per refresh, shared by `capabilities` and `state`) and capabilities/track lists compare structurally via `player-controls-equality.ts`, so a position-only refresh does not cascade through the view model or open track menus. Contract: `docs/architecture/player-controls-contract.md`.
- Shared controls are bottom-docked; the top fullscreen title is informational only. `Settings.playerControls` captures visibility, auto-hide delay (zero means never hide), compact/expanded density, solid/translucent backdrop, and small/medium/large size when `WebPlayerViewComponent` creates a new host through `PLAYER_CONTROLS_SETTINGS`. Fresh profiles default `mirrorLayout` to player-left/channel-rail-right, but an explicit stored layout is preserved.
- Agent control: `AgentControlEvents` exposes authenticated `/api/agent-control/v1` endpoints and resolves live commands only after the renderer returns the matching correlation ID. `AgentControlRuntimeService` uses real renderer stores/media state; `apps/agent-control/src/client.mjs` is shared by MCP and `iptvctl`. Tokens are scoped hashed records with expiry/revocation, rate limits, redacted audit records, and SSE events. `diagnostics.screenshot` is the one operation served entirely from the main process (`BrowserWindow.capturePage()`): the reason to ask for a screenshot is usually that the renderer has stopped answering, so gating it on renderer acknowledgement would fail exactly when it is needed. Its file name is generated (a caller-supplied path would be an arbitrary file write) and its result field is `file`, not `path`, because every response passes through the credential redactor whose key pattern includes `path`. Operations that read the M3U channel store (`channel.list`/`switch`/`next`/`previous`) only see channels on routes that render a channel list, so `channel.list` reports `loaded` and the others raise `operation-unsupported` rather than claiming a channel is missing. The bridge only listens when desktop remote control is enabled (`remoteControl` in the main-process config). Canonical contract: `docs/architecture/agent-control.md`.
- Shared web picture-in-picture stays inside that default-off rollout.
  `PlayerController` exposes capability `pictureInPicture`, state
  `pictureInPictureActive`/`canPictureInPicture`, and command
  `togglePictureInPicture()`. HTML5, Video.js, and ArtPlayer use standard
  element PiP from the adapter's attached video; shared ArtPlayer keeps vendor
  `pip: false`, while preference-off native/vendor paths remain unchanged. The
  capability-gated button sits before fullscreen and uses active enter/exit
  semantics; entry is disabled until metadata, and the action is disabled while
  an operation is pending. Embedded MPV reports capability/state false with a
  no-op command and has no popup/mini-window.
- `WebVideoControlsAdapter` supplies its current video and binding generation to
  `WebVideoPictureInPictureController`; the controller reads the video's
  `ownerDocument`, while browser enter/leave events remain authoritative.
  Exact-owner exit stays available if request support changes. Request/exit
  invocation remains synchronous for user activation, one operation is
  serialized, and binding generation plus exact video identity protects
  replacement and teardown from stale completion. Video.js Tech reset and
  ArtPlayer rebuild rebind with exact-owner cleanup; HTML5 source changes on a
  retained target preserve PiP.
  Standard PiP shows the browser/OS video surface without Angular control
  chrome, with browser-dependent subtitles. AirPlay, Cast, Document PiP, a PiP
  keyboard shortcut, and Embedded MPV popup/native support are out of scope.

**VOD/Series Detail Pages (two-state layout)**:

- Xtream and Stalker detail pages use the shared `PortalDetailShellComponent` (`libs/ui/components/src/lib/portal-detail-shell/`) with two states: **Browse** (hero with poster/metadata/actions, episodes below) and **Watch** (hero collapses with a ~300ms morph, the inline player takes the full content width, metadata moves to an About block below the episodes)
- The inline player (`PortalInlinePlayerComponent`) renders a full-width **theater stage** (`.player-shell__viewport`): the 16:9 player is centered and letterboxed so the leftover on wide-short windows is always the stage's black background, never app surface. An opt-in `playerAmbientMode` setting (Settings → Playback, default off, built-in web players only) fills that leftover with a blurred, dimmed copy of the poster (YouTube "Ambient mode" style)
- For inline **series** playback on wide windows the stage instead docks the player left and shows an **"Up Next" episode rail** in the leftover column (`app-up-next-rail` in `libs/ui/playback/src/lib/portal-inline-player/`): rest of the current season plus next-season spillover, playing episode highlighted, watch-progress bars from playback positions; clicking plays inline via the host's episode flow (both Xtream and Stalker). Gated by the `playerUpNextRail` setting (default on, web players only) and a ≥320px leftover-width check via ResizeObserver — narrower windows keep the centered theater/ambient stage; movies and live never show the rail. The rail is opaque and sits on top of the ambient fill
- Watch state derives from `inlinePlayback() !== null` only; external MPV/VLC playback keeps the browse layout. Esc and "Close player" exit to browse without navigation; the now-playing back arrow is route-level back (straight to the list via the host's `goBack()`)
- A successful external MPV/VLC episode launch immediately persists the selected episode as the latest playback-position entry and retargets the series CTA to `Play episode N`; real player telemetry overwrites that marker when available, so episode identity is reliable while exact external timestamps remain best-effort.
- Stalker preserves this contract for regular `/series`, embedded VOD `series[]`, and lazy Ministra VOD `is_series` items: quick-start translation parameters must reach the CTA, and inline/external episode handoffs must include the parent series id plus resolved season and episode numbers. This metadata lets the dashboard render the tracked S/E badge for VOD-backed series. Existing playback rows without it remain badge-less until the episode is played again.
- Hosts pass hero chips/meta/actions as `*appDetailTags`/`*appDetailMeta`/`*appDetailActions` templates; the shell stamps them into both the hero and the About block
- Seasons are tabs (`SeasonTabsComponent`, dropdown beyond 6 seasons) with auto-selection (playing episode's season → resume season → first) that fires the same `seasonSelected` lazy-load/enrichment hooks as manual clicks; grid/list episode view toggle persists to localStorage; season descriptions come from `get_series_info` (Xtream) or TMDB (Stalker)
- Dashboard hero/Continue Watching clicks for an Xtream series carry a one-shot resume target through the global-recent inline-detail handoff; after series metadata and playback positions load, the exact saved episode starts at its stored position. A failed positions load leaves the target unconsumed and the handoff detail-only, so a transient storage error never starts the episode from the beginning. Ordinary global-recent grid clicks remain detail-only.
- See `docs/architecture/embedded-inline-playback.md` ("Two-State Detail Layout")

**Workspace Playback Bar** (`libs/workspace/shell/feature/.../workspace-playback-bar/`):

- Rendered by the shell, not by a page, so radio playback survives navigation.
  It hosts whichever player currently has media (today: `app-radio-player`)
- Three remembered sizes from `PlaybackBarService` (`libs/portal/shared/util`):
  compact `88px` strip, medium `40vh` and large `75vh` stages. The service lives
  in portal-shared rather than workspace so the players inside the bar can read
  the size without crossing a module boundary
- The medium/large stage layout is component CSS reaching into the player
  through `:host ::ng-deep`. `:host` must lead the selector — Angular rewrites
  it to the host's own attribute wherever it appears, so nesting it under the
  size class silently produces a rule that can never match
- Pop-out uses Document Picture-in-Picture (`DocumentPictureInPictureService`),
  which *moves* the content element into the floating window rather than
  cloning it, so the `<audio>` element keeps playing. Two consequences: the
  `--mat-sys-*` token mapping has to be declared on the moved element itself
  (a host-scoped block stays behind in the main document), and the bar must
  close the window when it is destroyed, or the window outlives its content

**Radio Player**:

- Dedicated audio player for channels with `radio="true"` M3U attribute
- Cinematic layout: blurred station logo as backdrop, floating artwork card, transport controls
- Always uses the built-in inline player — external player settings (MPV/VLC) are ignored for radio
- EPG panel is hidden for radio channels (radio streams have no EPG data)
- Volume synced with video player via shared `localStorage` key `'volume'`
- Keyboard shortcuts: ArrowUp/ArrowDown (volume), M (mute)
- Component: `libs/ui/playback/src/lib/audio-player/audio-player.component.ts`

**Radio & Podcasts** (`/workspace/radio`) — distinct from the Radio Player
above, which plays `radio="true"` channels out of a user's own M3U playlist.
This section is a standalone browser over public catalogues and needs no
playlist:

- Catalogues, all key-free and signup-free: Radio Browser for stations
  (`radio-browser.service.ts`, mirror discovery plus per-request failover, since
  individual mirrors go down routinely), the Apple iTunes Search API and its
  public top-podcasts chart for shows, and each show's own RSS feed for episodes
- **Podcast feeds need the main process.** Publishers rarely send CORS headers,
  so the renderer cannot read them; `RemoteTextService` routes through the
  `FETCH_REMOTE_TEXT` IPC channel under Electron and falls back to a direct
  `fetch` in the PWA, surfacing `RemoteTextUnavailableError` as a specific
  "open the desktop app" message when a host refuses
- Library (favourites, subscriptions, recents, episode resume points) lives in
  `localStorage`, not SQLite: it is small and must behave identically in the PWA
  where the SQLite bridge is absent
- Resume points are keyed by episode id, and feeds do repeat `<guid>` values, so
  `podcast-feed.parser.ts` disambiguates a repeat as `<id>#2` rather than
  letting two episodes share one progress entry. The first occurrence keeps the
  raw id so already-stored resume points still resolve. The same parser caps a
  feed at its newest 500 episodes — long-running shows publish thousands, and
  every one becomes a stored-progress key and a rendered row
- Sorting by country or genre deliberately **does not** use the catalogue's own
  `order=country`/`order=tags`. A large share of stations have a blank value
  there, and ascending order returns nothing but those blanks; the top list is
  ranked by popularity and grouped locally instead. Genre additionally snaps
  free-text tags onto the catalogue's ranked tag list so "classic rock" and
  "indie, rock" group together (`radio-station-sort.ts`)
- **The visualizer's audio reactivity is synthesized, and must stay that way.**
  Reading a stream's real spectrum requires a `MediaElementAudioSourceNode`,
  which the Web Audio spec makes emit silence for any cross-origin resource
  without CORS opt-in — i.e. nearly every internet radio stream. Tapping the
  element would mute the audio it visualizes. `radio-energy-model.ts` models the
  shape of music instead; `radio-metaball-renderer.ts` draws it in WebGL2
- Orbit geometry is aspect-corrected, in both directions. The compact dock is
  roughly 15:1, and orbits written for a square canvas collapse to an invisible
  pinprick at its centre; conversely, radii sized for that strip cover most of
  the canvas once the playback bar is expanded to a 40vh or 75vh stage, and
  seven of them then fuse into a flat wash. Both the spread and the radius scale
  therefore ramp with the aspect ratio. `computeOrbPlacements()` is split out
  from the GL calls so that geometry is unit-testable
- Fill cost is budgeted, not just capped at 2x device pixels: the shader
  evaluates the seven-orb field five times per pixel, and the tall presets are
  tens of times the area of the strip. `computeDrawingBufferSize()` caps the
  drawing buffer at ~1.6M pixels, which the canvas's 7px blur makes invisible.
  The canvas's CSS size comes from a `ResizeObserver` rather than `clientWidth`
  so the frame loop never forces a synchronous layout
- Each orb carries its own hue (`OrbPlacement.hue`, golden-ratio spaced over
  `ORB_HUE_SPREAD`), and the shader blends them weighted by each orb's field
  contribution, so a core takes its own colour and a neck mixes the two. Hues
  are uploaded as unit vectors on the colour wheel (`uOrbHues`): averaging them
  as plain numbers would send a blend of 0.95 and 0.05 to 0.5 — the opposite
  colour — instead of back through red
- Orbs are choreographed, not merely animated. Each has a `temperament` and they
  respond to one another: `anchor` holds the centre, `satellite` orbits it,
  `mirror` sits opposite the satellite through the centre, `shy` is pushed away
  and shrinks when crowded, `clinger` chases its nearest neighbour and swells as
  it closes, `skittish` bolts on the beat, and `drifter` ignores everyone
  (without one the cluster feels uniformly reactive). The rules live in
  `radio-orb-behaviours.ts`, the paths and blending in
  `radio-orb-choreography.ts`. Two rules hold the design together:
    - **It stays a pure function of `time`.** Interaction is one relaxation
      pass — all base paths are evaluated, then each orb is displaced from the
      others' base positions — not an integrated simulation. The frame loop
      parks when playback stops and resumes later, and a stateful simulation
      would lurch on resume or have to be kept running to stay correct.
    - **Partner links read *resolved* positions**, so orbs are resolved in
      `TEMPERAMENT_RESOLVE_ORDER` (role order, not index order) — satellite
      after anchor, mirror after satellite. Reading base positions instead put
      the mirror opposite the path the satellite had already abandoned.
    - **Nothing may switch on a hard comparison.** The clinger originally
      chased `nearestOther()`, which teleports it across the frame the instant
      two candidates are equidistant; it now uses a distance-weighted blend of
      every neighbour. Same reason the `shy` repulsion is smoothstepped and its
      denominator softened.
- Who plays which part rotates (`radio-orb-roster.ts`). The seven temperaments
  are a fixed ensemble — every one is always cast, so there is always exactly
  one anchor for the satellite to circle — and the orbs rotate through them on a
  23s cycle with a 6s crossfade. The rotation is `floor(time / cycle)`, never
  tracked, so it too survives parking. `temperamentFor` takes a per-station seed
  so two stations open on different arrangements.
- `OrbPlacement.prominence` is the size hierarchy: one lead, two supporting,
  four extras. It belongs to the orb, not to the part, so the eye keeps landing
  in the same place while behaviour changes around it. `PROMINENCE_FLOOR` is
  chosen so the mean multiplier is 1 — the hierarchy redistributes area rather
  than adding it, which is what keeps the coverage budget intact.
  Temperaments make the orbs gather far more than independent paths did, so
  they interact with the radius scale: retuning one needs the coverage measured
  again (see the preview-harness note below), or the tall presets go back to
  being a flat wash.
- Orbs also carry a depth layer (`OrbPlacement.layer`, `uOrbs.w`). Near layers
  travel further, are larger, and catch the specular; far ones are desaturated
  by aerial perspective. Three traps, all of which were shipped bugs at some
  point and all of which look like "a dark hole in the middle of every blob":
    1. **Anything fed the raw field `f` explodes at an orb's centre**, where
       the inverse-square sum is unbounded. The hue's depth term must use a
       saturating `density = f / (1 + f)`; raw `f` spun the hue through whole
       revolutions across two pixels and the blur averaged it to grey.
    2. **The depth blend must use a saturating weight** (`c / (1 + c)`), or an
       orb's own layer wins outright at its own centre while the surroundings
       average toward its neighbours.
    3. **Depth must not appear in `alpha`.** Inside the body every other alpha
       term has saturated, so a depth factor there is the only thing varying
       across it and shows up directly. On the colour terms it is outweighed by
       `density`, which peaks in the same place. For the same reason aerial
       perspective leans on desaturation rather than dimming.
  When something looks wrong here, render the suspect term straight to
  `fragColor` as greyscale and look at it — the terms interact in ways that do
  not survive reasoning about them in the abstract
- The synthetic beat is an attack/decay envelope with a **smoothstepped** rise,
  not a bare exponential decay. An exponential decay restarts each beat with a
  step from silence to full, and an exponential *attack* is at its steepest the
  instant the beat lands; both read as a jolt. `PULSE_PEAK` is scanned once at
  load so the pulse still tops out at 1 whatever the constants are retuned to,
  because every weight applied to it downstream assumes that range
- Body brightness rides `density` so blobs read as volumes lit from within
  rather than flat discs, and a cheap hash `grain()` dithers the result: the
  body is one enormous smooth gradient and an 8-bit surface bands visibly
  across it at the tall presets
- Motion trails accumulate in an offscreen RGBA8 framebuffer that is faded each
  frame and blitted to the canvas, because the drawing buffer itself is cleared
  by the compositor between frames. Two things the implementation depends on:
    - **The frame is combined with `MAX`, not composited over.** Compositing
      over a faded buffer is a temporal integrator, so a *stationary* region
      keeps adding to its own decayed self — a halo at alpha 0.3 settles at
      0.79 — and the whole picture washes out instead of growing tails.
      Measured: mean coverage went 0.40 → 0.66 at the large preset. With `MAX`
      anything still keeps exactly its own value and only vacated pixels decay.
    - **The fade is time-based** (`exp(-dt / TRAIL_FADE_SECONDS)`), so the trail
      is the same length at 30fps as at 60, and a gap longer than
      `MAX_TRAIL_STEP_SECONDS` clears instead of smearing — that gap means the
      loop parked and resumed. Trails are off under `prefers-reduced-motion`,
      and fail closed if the framebuffer cannot be created
- Shader source and program linking live in `radio-metaball-program.ts`, the
  trail framebuffer in `radio-trail-buffer.ts`, and the orb geometry in
  `radio-orb-{choreography,behaviours,roster}.ts`; `radio-metaball-renderer.ts`
  keeps only the GL lifecycle and the uniform uploads
- **Look at it before and after changing it**, with `pnpm run viz`
  (`tools/visualizer-preview/`, which has its own README). The visualizer cannot
  be checked from unit tests and the in-app browser preview does not composite,
  so `requestAnimationFrame` never fires there and the frame loop never runs;
  the tool bundles the real modules and renders them headlessly through
  SwiftShader instead. `viz shots` screenshots each dock size, `viz coverage`
  guards the flat-wash failure (compact sits near 0.30, large near 0.38; much
  past 0.5 and the blobs stop reading as separate bodies), `viz trails` checks
  the trail is not integrating, and `viz perf` gives a rough frame cost. Every
  shading bug listed above was found this way and none was visible in review

**EPG (Electronic Program Guide)**:

- XMLTV format support
- Background parsing in worker thread
- Stored in database for quick lookup
- Programme times go through `getProgramTimeMs`, which rejects implausible
  values instead of plotting them. A feed already emitting **milliseconds** in
  `start_timestamp` was multiplied by 1000 and landed tens of thousands of years
  out; both the grid and the ribbon size their axis from the furthest programme,
  so one such row generated ticks across millennia and locked the tab.
  `buildTimelineAxis` clamps to `now ± TIMELINE_MAX_SPAN_MS` (90 days) as a
  second backstop
- Guide surfaces track programmes by **position plus identity**, never identity
  alone: feeds repeat entries, and a duplicate `@for` key is a hard Angular
  error that takes the whole guide down
- The guide grid is a keyboard grid (`MultiEpgProgramFocus` in
  `multi-epg-program-focus.ts`): a roving tabindex keeps one cell tabbable so
  Tab steps past the guide in one press, arrows move between cells (up/down land
  on the neighbouring channel's programme nearest the same point on the
  timeline), and Enter/Space opens the details dialog
- Manual EPG mapping (Electron only): right-click a channel in any list (M3U views, Xtream portal list, Stalker ITV sidebar, global favorites) → "Map EPG channel" attaches it to an uploaded-XMLTV channel; stored in `epg_channel_mappings` keyed by the M3U lookup key or a playlist-scoped portal key (`xtream:{playlistId}:{id}` / `stalker:{playlistId}:{id}`, helpers in `libs/shared/interfaces/src/lib/epg-mapping-key.util.ts`); resolved on every EPG path (single + batch IPC lookups, portal detail views, preview queues); dialog: `libs/ui/components/src/lib/channel-list-container/epg-mapping-dialog/`
- Followed Series: EPG programme dialogs and Xtream/Stalker series details feed a device-local, versioned schedule at `/workspace/followed-series`; a 14-day indexed EPG lookahead normalizes series/episode identity, groups alternative airings, reconciles schedule moves/cancellations, and arms a min-heap timer. The global countdown supports cancel/switch-now/disable, conflicts support prompt/priority/first-available, and the playback runtime uses bounded probes plus backup channels while respecting recording, casting, browser-background, and return-channel preferences. Canonical contract: `docs/architecture/followed-series-auto-switch.md`

**TMDB Metadata Enrichment** (opt-in):

- Enriches Xtream and Stalker VOD/series detail views with TMDB data (plot, cast with avatar chips, director, genres, rating, artwork, YouTube trailers) via a field-level merge — the provider stays authoritative for stream data and any field TMDB can't fill; Cyrillic titles are searched with `ru-RU` so exact-title matching works
- "Similar" rail in ALL detail views: TMDB recommendations matched against the provider catalog by normalized title, two-tier — exact form first, year-stripped fallback gated on year compatibility (`libs/portal/xtream/feature/src/lib/tmdb-similar.util.ts`, `normalizeTitleKeys`); cross-portal matches from other imported Xtream playlists supplement the Xtream rail and fully power the Stalker rail (`CrossPortalSimilarService` in `libs/services`, batched `DB_MATCH_TITLES`, Electron only); detail components re-initialize on route param changes since the router reuses them for detail→detail navigation
- Season/episode enrichment: opening a season lazily fetches `/tv/{id}/season/{n}` and overlays real episode names, overviews and stills via `mergeEpisodesWithTmdb` (Xtream: `XtreamStore.enrichSelectedSerialSeason`; Stalker: overlay in the series view's `mappedSeasons`); for single-season provider slices whose title carries an explicit season marker ("The Mandalorian (2 season)", "s02", "2 сезон"), the marker overrides the provider's renumbered season (`resolveEnrichmentSeasonNumber` in `libs/shared/interfaces/src/lib/season-marker.util.ts`)
- Dashboard: opt-in "Trending this week" rail (weekly TMDB trending matched against imported Xtream playlists via one batched `DB_MATCH_TITLES` request; Electron-only, `dashboardRails.tmdbTrending` toggle) and hero TMDB extras (backdrop fallback, rating + genre badges, memoized per session; series heroes show the tracked S/E badge from playback positions) — `DashboardTrendingService` in `libs/workspace/dashboard/data-access`, `DashboardHeroTmdbService` in `libs/workspace/dashboard/feature`; both load async after first paint
- Series detail views show a TMDB production-status chip (`tmdb_status`, e.g. Ended / Returning) — TMDB sends `status` in English regardless of request language, so it is normalized to a token by `normalizeSeriesStatus` and rendered via `seriesStatusLabelKey` translations; person pages show `deathday` alongside `birthday`
- Actor pages: cast avatar chips are clickable (TMDB person id) and open `actor/:personId` inside the current portal — TMDB person bio + full filmography (acting + directing credits merged; acting wins the per-title dedup); director/creator chips (`tmdb_directors` via `enrichedDirectors`/`enrichedCreators` in `tmdb-credits.ts`) are clickable the same way and open the same person page; Xtream matches titles against the loaded catalog (direct navigation), unmatched titles and all Stalker titles open the portal search prefilled (`?q=`); the in-portal search page shows a Back button (`SearchLayoutComponent.showBackButton` → `Location.back()`) so users can return to the actor page; shared UI in `libs/ui/shared-portals` (`ActorViewComponent`)
- Actor page "All portals" scope (Electron only): batched `DB_MATCH_TITLES` worker op (trigram FTS over all imported Xtream playlists, `apps/electron-backend/src/app/database/operations/title-match.operations.ts`); `normalizeTitle` is shared renderer/worker via `libs/shared/interfaces/src/lib/title-normalization.util.ts`
- Opt-in via `Settings > Metadata (TMDB)` (sends titles to TMDB); the section also has a "check key" button and a cache panel (row count + payload size, with a clear button); optional user API key overrides the embedded default (`DEFAULT_TMDB_API_KEY` in `libs/services/src/lib/tmdb/tmdb-config.ts` — an empty placeholder in the repo by design; the real key lives in the `TMDB_API_KEY` GitHub Actions secret and is injected at CI build time by `tools/tmdb/inject-tmdb-key.mjs`)
- Match confidence: a provider `tmdb_id` is a strong hint, not gospel — its payload is weighed against the item (`assessProviderId`: title or year agrees → use it; both years known and incompatible → the search may take over; title-only mismatch → keep it, since TMDB localizes titles). A 404 marks the id dead (`badProviderId:<id>` row); transient failures never do. Without a usable id: normalized-title + year (±1) search with a strict gate — no confident match means no enrichment
- Detail views render provider data immediately; enrichment patches the selection asynchronously (staleness-guarded)
- Cached in SQLite `tmdb_metadata` (Electron, via DB worker ops `DB_GET/SET_TMDB_METADATA`, plus `DB_GET_TMDB_CACHE_STATS` / `DB_CLEAR_TMDB_METADATA` behind the settings cache panel) or in-memory (PWA); localized via the app language setting. Search-match lookup keys are versioned, and connection startup removes obsolete unversioned rows once through the `migration:tmdb-search-lookup-v2-cache-cleanup:v1` app-state marker.
- Service layer: `libs/services/src/lib/tmdb/`; store glue: `libs/portal/xtream/data-access/src/lib/stores/xtream-tmdb-enrichment.ts` and `libs/portal/stalker/data-access/src/lib/stores/stalker-tmdb-enrichment.ts` (hooked in `withStalkerSelection().setSelectedItem`)
- TMDB attribution (logo + disclaimer) is required and shown in the settings TMDB section and About
- See `docs/architecture/tmdb-metadata-enrichment.md`

**Favorites and Recently Viewed**:

- Per-playlist favorites and global favorites
- Recently viewed tracks watch history

**Internationalization**:

- Uses `@ngx-translate` with 19 language files in `apps/web/src/assets/i18n/`
- Angular Material components that ship their own English strings do **not** go
  through `TranslatePipe` and need an `Intl` provider instead. `MatPaginator` is
  the one that exists: `provideTranslatedPaginator()`
  (`apps/web/src/app/translated-paginator.provider.ts`) supplies
  `MatPaginatorIntl` from the `PAGINATOR.*` keys and re-reads them on
  `onLangChange`. Add the same pattern rather than a hardcoded `aria-label` if
  another Material widget with built-in copy is introduced

## Development Notes

### Environment Detection and Dual-Mode Architecture

The app determines whether it's running in Electron or as a PWA by checking:

```typescript
window.electron; // truthy in Electron, undefined in browser
```

**Why Dual Mode?**
CarbonCast IPTV supports both Electron (desktop app) and PWA (web browser) to provide flexibility:

- **Electron**: Full-featured desktop experience with local database, external player support (MPV/VLC), and native file system access
- **PWA**: Lightweight web version that runs in any browser without installation

**Environment-Specific Behavior**:

- `app.config.ts` - `DataFactory()` selects DataService implementation based on environment
- `app.routes.ts` - Same `/workspace/...` route tree in both environments; guards keep Electron-only routes (e.g. global search) out of the PWA
- Storage layer switches automatically:
    - Electron → SQLite/Drizzle ORM → `~/.iptvnator/databases/iptvnator.db`
    - PWA → IndexedDB → Browser storage
- External player support (MPV/VLC) only available in Electron
- File system operations only available in Electron (uploading playlists from disk)

**Base Href Configuration**:
The app uses different base href values depending on the build target:

- **Development & PWA**: `baseHref="/"` (from `index.html`)
    - Used by: `pnpm run serve:frontend`, `pnpm run build:frontend:pwa`
    - For web servers with proper routing
- **Electron Production**: `baseHref="./"` (overridden in build config)
    - Used by: `pnpm run build:backend`, `pnpm run make:app`
    - Required for `file://` protocol in Electron

Build configurations in `apps/web/project.json`:

- `production`: Electron build with `baseHref="./"`
- `pwa`: Web deployment with `baseHref="/"`
- `development`: Dev mode with `baseHref="/"` from index.html

**Factory Pattern Implementation**:
The factory pattern ensures a single codebase works in both environments without conditional checks scattered throughout the application. All environment-specific logic is encapsulated in the service implementations.

**Build Commit In About**:
CI injects the git commit into `apps/web/src/environments/build-commit.ts` via `tools/build/inject-build-commit.mjs` (same placeholder pattern as the TMDB key inject); `Settings > About` then shows `"<version> (<short-sha>)"`. The semver version itself deliberately stays untouched — a `-sha` suffix would flip electron-updater into prerelease mode and leak into installer/artifact version fields. Local/dev builds keep the placeholder empty and show the plain version.

### Testing Strategy

- **Unit tests**: Jest with `jest-preset-angular` and `ng-mocks`
- **E2E tests**: Playwright testing the web app and Electron app
- Backend tests use standard Jest
- Bug fixes should add focused regression coverage unless there is a documented reason not to.
- Use the impact-based validation policy in `Regression Prevention And Test Updates` to choose targeted unit tests, atomized E2E targets, broad suites, or CDP/manual verification.

### Nx Commands

Use `nx` CLI for better performance:

```bash
pnpm nx run <project>:<target>
# Example: pnpm nx run web:build
# Example: pnpm nx run electron-backend:serve
```

To run multiple projects:

```bash
pnpm nx run-many --target=test --all
```

### Electron Build Process

The Electron backend depends on the web app being built first:

- `electron-backend:build` depends on `web:build`
- Output goes to `dist/apps/electron-backend` (backend) and `dist/apps/web` (frontend)
- Packaging combines both into distributable

### Database Migrations

No formal migration system yet. Schema changes are applied via raw SQL in the `createTables()` function in `libs/shared/database/src/lib/connection.ts` using `CREATE TABLE IF NOT EXISTS`. One-off data migrations run guarded by keys stored in the `appState` table.

### Common Patterns

**IPC Communication**:

1. Define handler in appropriate events file (e.g., `database.events.ts`)
2. Register with `ipcMain.handle()` in the event bootstrap function
3. Expose in preload script via `contextBridge.exposeInMainWorld()`
4. Call from Angular via `window.electron.<methodName>()`

**Adding New Playlist Source**:

1. Add type to `libs/shared/interfaces/src/lib/playlist.interface.ts`
2. Create event handler in `apps/electron-backend/src/app/events/`
3. Add the import flow in `libs/playlist/import/feature/` (add-playlist dialog + per-source import components) and surface it on the dashboard (`libs/workspace/dashboard/`) if needed
4. Update database schema if needed

**State Management**:

- Use NgRx for global application state (M3U playlists, `libs/m3u-state`)
- Use NgRx Signal Store with `signalStoreFeature()` composition for portal/feature state (XtreamStore, StalkerStore)
- Use NgRx signals for reactive data streams

**Focus Indicators**:

- `apps/web/src/styles.scss` defines a single app-wide `:focus-visible` ring
  from the `--app-focus-ring-*` tokens. Do not add `outline: none` to a focus
  state: a blanket reset previously removed the indicator from every control in
  the app, leaving keyboard and assistive-tech users with nothing. Suppressing
  the ring on pointer interaction is already handled by `:focus-visible`
- Custom controls built from bare `<button>`/`<a>` inherit the ring
  automatically. Only override `outline-offset`, and only when a component's own
  focus treatment (e.g. Material's inner indicator) would otherwise double up

**Keyboard Navigation In Long Lists And Grids**:

Any list or grid long enough that tabbing through it is impractical uses a
**roving tabindex**: exactly one item is `tabindex="0"` and the arrows move
between them, so Tab enters and leaves the collection in one press. Three
implementations exist and new ones should follow the nearest:

- `listbox-cursor.ts` (channel lists) — 1D virtualized listbox with
  `aria-activedescendant`
- `grid-card-focus.ts` (portal poster grids) — 2D, row step read from the live
  `grid-template-columns` because the grid is `auto-fill`
- `multi-epg-program-focus.ts` (TV guide) — 2D across channel rows, vertical
  moves pick the neighbour nearest the same point on the timeline

Shared rules: the focused item is stamped with a `data-*` key the controller
queries; focus is applied in a `queueMicrotask` because the tabindex swap lands
on the next change detection; and the collection reports position with
`role="list"` + `aria-posinset`/`aria-setsize` (paginated grids count across
pages, not within the page) or listbox semantics. Do not give a card both
`role="listitem"` and `role="button"` — wrap it.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first when it is available - it has patterns for querying projects, targets, and dependencies. If it is unavailable, use `pnpm nx show projects`, `pnpm nx graph`, and project `project.json` files directly.
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
