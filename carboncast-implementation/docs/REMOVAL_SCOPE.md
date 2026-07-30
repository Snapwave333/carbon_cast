# Inherited Promotion Removal Scope

## Remove

- Social profile handles, account IDs, invite links and QR codes owned by the original project/maintainers.
- Social buttons in About, Settings, footer, sidebars, menus, splash, onboarding and error screens.
- Donation/funding/tip/sponsor buttons and dialogs.
- Donation-only routes, API handlers, deep links, IPC, commands, services, models, flags and environment variables.
- Donation/social-specific telemetry, tests, translations, snapshots and unused assets.

## Preserve

- License-required names and copyright.
- Canonical upstream repository attribution.
- Dependency notices.
- Security, privacy, terms and issue-tracker links that remain valid.
- IPTV channel IDs, EPG IDs, OAuth/client IDs, database IDs and user IDs.
- Normal subscription/billing/upgrade features that sell the application's service rather than solicit donations for the upstream author.

## Review manually

- Generic `support` buttons: may be help, customer service, subscription support or donations.
- `sponsor` labels: may refer to EPG advertising, media metadata or GitHub Sponsors.
- Telegram/Discord integration: may be functional notifications rather than promotional links.
- YouTube URLs: may be playable IPTV content rather than social promotion.
