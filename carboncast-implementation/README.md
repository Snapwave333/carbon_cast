# CarbonCast IPTV — Claude Code Implementation Pack

A production-oriented branding and migration pack for a forked IPTV application. It contains vector logos, application icons, favicons, splash screens, design tokens, example components, stack-neutral migration instructions, upstream-attribution safeguards, and audits for removing inherited promotional identity.

## Required outcome

1. Rebrand the application as **CarbonCast IPTV**.
2. Use red and carbon fiber as the primary identity; orange and cyan are secondary status colors.
3. Preserve legal notices, licenses, copyright statements, and explicit credit to the original upstream repository.
4. Remove the original project's social-media handles/IDs/links from runtime UI and configuration.
5. Remove donation, funding, sponsor, tip, and contribution functionality plus its related GUI, routes, APIs, configuration, analytics events, and tests.
6. Do not remove unrelated authentication IDs, provider client IDs, channel IDs, EPG IDs, or legal attribution merely because they contain the word `id`.

## Fastest Claude Code workflow

Copy this pack into the repository, then give Claude Code this file as its task:

```text
Read and execute ./carboncast-implementation/CLAUDE_CODE_TASK.md.
Work directly in this repository. Preserve upstream attribution and licensing. Do not leave mockups, dead routes, placeholders, or unused donation/social code.
```

Suggested location inside the target repository:

```text
carboncast-implementation/
```

Run the included audits before and after implementation:

```bash
node carboncast-implementation/scripts/discover-upstream.mjs .
node carboncast-implementation/scripts/audit-original-promotion.mjs .
node carboncast-implementation/scripts/verify-brand-assets.mjs carboncast-implementation
```

On Windows PowerShell:

```powershell
./carboncast-implementation/scripts/run-audits.ps1 -RepoRoot .
```

## Asset map

- `assets/logos/` — master SVG and rendered PNG logo lockups
- `assets/icons/` — desktop, taskbar, PWA, Android, Apple, ICO and ICNS assets
- `assets/favicons/` — browser favicon package and manifest
- `assets/splash/` — desktop, TV, tablet and mobile launch art
- `assets/patterns/` — restrained carbon-fiber tiles
- `assets/reference/` — concept boards for visual intent only
- `tokens/` — CSS, JSON, TypeScript and Tailwind-ready tokens
- `examples/` — React and plain HTML/CSS implementations
- `scripts/` — upstream discovery, promotion audit, asset copy and verification

## Attribution rule

Never invent the original repository URL. `scripts/discover-upstream.mjs` gathers candidates from git remotes, package metadata, README text, and repository history. Claude must verify the correct upstream and place it in:

- the README attribution section;
- `THIRD_PARTY_NOTICES.md` or the project's existing notice file;
- an About/Licenses surface when the application already has one;
- package metadata where supported.

Do not imply that the upstream author endorses CarbonCast IPTV.

## Brand behavior

- **Red:** brand, primary actions, active live state.
- **Orange:** upcoming episodes, scheduled actions, five-second auto-switch countdown, buffering warnings.
- **Cyan:** guide focus, connectivity, current channel location, information.
- **Carbon:** shell, player chrome, rails, splash screens.

The carbon texture must remain quiet. Content readability wins.
