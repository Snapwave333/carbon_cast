# Claude Code Task: Implement CarbonCast IPTV Branding and Remove Inherited Promotion

Execute this task autonomously in the repository root. Inspect the actual stack before editing. Do not assume React, Electron, Tauri, Android, iOS, or a particular folder layout.

## Non-negotiable requirements

- Rebrand the product as **CarbonCast IPTV** using the supplied assets and tokens.
- Preserve all upstream licenses, copyright notices, author credits, and repository attribution.
- Credit the original repository clearly, using its verified canonical URL.
- Remove inherited social-media handles, account IDs, usernames, invite links, profile links, and promotional buttons from runtime UI and configuration.
- Remove donation/funding/tip/sponsor functionality and its complete GUI surface.
- Remove associated routes, API clients, IPC handlers, backend methods, commands, environment variables, feature flags, analytics events, translations, tests, snapshots, icons, and dead imports.
- Do not remove legal attribution, dependency notices, operational OAuth/client IDs, IPTV channel IDs, EPG IDs, database IDs, or user-account identifiers.
- Do not replace removed donation/social controls with disabled placeholders or empty panels.
- Do not create a new donation or social identity.
- Do not modify behavior unrelated to branding or inherited promotion unless required to restore compilation/tests.

## Phase 1 — Inspect and protect

1. Record `git status`, current branch, remotes, package managers, build commands, test commands, and app targets.
2. Run:
   - `node carboncast-implementation/scripts/discover-upstream.mjs .`
   - `node carboncast-implementation/scripts/audit-original-promotion.mjs .`
3. Read the license, README, package metadata, About screen, settings screen, navigation, footer, menus, API routes, IPC handlers, environment samples, translations, and tests.
4. Identify the verified original upstream repository. Prefer the `upstream` git remote. When absent, compare `origin`, package metadata, README history, license headers, and the earliest commits. Never guess.
5. Create a focused branch when repository policy allows: `chore/carboncast-branding`.

## Phase 2 — Preserve attribution

1. Keep the original license file unchanged unless the license explicitly requires adding a notice.
2. Add or update a visible README section:

   `CarbonCast IPTV is a fork of [Original Project](VERIFIED_URL). The upstream project and its contributors are credited under the original license. CarbonCast IPTV is an independent fork and is not endorsed by the upstream maintainers.`

3. Add the same factual credit to the existing notice/credits mechanism. Prefer `THIRD_PARTY_NOTICES.md` when no notice file exists.
4. Preserve upstream copyright headers.
5. Do not present the original author's social handles or donation links as attribution. A repository link plus license credit is sufficient unless the license requires more.

## Phase 3 — Remove inherited social identity

Remove runtime references belonging to the original project or maintainers, including:

- X/Twitter, Facebook, Instagram, TikTok, YouTube, Telegram, Discord, Reddit, Mastodon, Matrix and similar profile/invite links;
- social usernames, channel names, account IDs, QR codes, follow buttons, community buttons, footer icons, About links, settings entries and splash promotional text;
- hard-coded social metadata in manifests, structured data, Open Graph account fields, installers, desktop menus, mobile drawers, translations and configuration defaults.

Keep links that are genuinely required for legal attribution, security reporting, documentation, release downloads, issue tracking, privacy, terms, or support—unless they are clearly promotional social identity. Replace obsolete support routes with the project repository's issue tracker only when the repository already uses issue-based support.

## Phase 4 — Remove donation functionality and GUI

Delete the full donation/funding feature slice:

- donate, tip, sponsor, fund, support-us, coffee, Patreon, PayPal, Ko-fi, OpenCollective, GitHub Sponsors and equivalent buttons/cards/dialogs/routes;
- payment/deep-link launchers used only by donations;
- donation models, services, API endpoints, IPC events, commands, feature flags, settings, environment keys and secrets;
- donation-specific analytics, telemetry names, translations, snapshots, fixtures and tests;
- navigation gaps, empty sections and dangling separators created by removal.

Do not remove normal paid subscription, billing, purchase, upgrade, entitlement, or account functionality unless inspection proves it exists only to donate to the original project.

## Phase 5 — Implement branding

1. Copy required files from `carboncast-implementation/assets/` into the repository's established public/resource locations. Avoid duplicate asset trees.
2. Use SVG for scalable UI logos; use supplied PNG/ICO/ICNS assets for package metadata and platform icons.
3. Import tokens from `carboncast-implementation/tokens/`. Translate them into the project's native token/theme system rather than layering a competing system.
4. Apply:
   - carbon black shell and player background;
   - carbon panel surfaces for navigation and overlays;
   - red primary actions and active live state;
   - orange upcoming/scheduled/countdown state;
   - cyan EPG focus, connected state and information;
   - white primary text and steel secondary text.
5. Install the new app icon in every target actually present: web/PWA, Windows, macOS, Linux, Android, iOS, Electron, Tauri, Flutter, .NET, Qt, or native packaging.
6. Install favicons and update browser/PWA theme colors.
7. Add the appropriate splash screen. Use real initialization progress when the app supports it; otherwise use a non-blocking static launch image.
8. Replace legacy product name, logo, title, installer name, desktop shortcut name, window title, package display name and metadata without changing identifiers that would break updates unless migration is explicitly handled.
9. Keep the app's functional layout. The branding pass is not permission for an unrelated full UI rewrite.

## Phase 6 — Clean and verify

1. Remove dead imports, unused assets, unused dependencies and unreachable code caused by the feature deletion.
2. Run formatter, type checker, linter, unit tests, integration tests and production build using the repository's own commands.
3. Re-run `audit-original-promotion.mjs`. Review every remaining result manually. Remaining legal credits must be documented as allowed.
4. Verify all assets with `verify-brand-assets.mjs`.
5. Test:
   - cold launch and splash;
   - desktop/taskbar/dock icon;
   - favicon/PWA icon;
   - dark and light logo placement;
   - navigation after donation/social removal;
   - About/credits attribution link;
   - packaging/installer metadata;
   - no broken routes, blank panels or console errors.
6. Update screenshots/snapshots only after confirming the new output is correct.

## Required completion report

Return:

- verified upstream repository URL and where credit was added;
- files changed;
- social identity removed;
- donation code/UI removed;
- branding targets implemented;
- commands run and their results;
- remaining audit matches with justification;
- known limitations, with no fabricated success claims.
