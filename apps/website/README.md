# CarbonCast IPTV Website

The website is an Astro static site deployed to GitHub Pages at
`https://snapwave333.github.io/carbon_cast/` by `.github/workflows/deploy-website.yml`
on every push to `main` that touches `apps/website/**`. The `/carbon_cast` base
path comes from `base` in `astro.config.mjs`; internal links are written with
that prefix.

## Design Language

Rules the pages follow. Breaking one is what made the old layout feel
templated, so change them deliberately rather than per-section.

- **One accent.** Teal (`accent-*`) is the only accent on every page. The
  `warm-*` tokens are not in use.
- **One shape scale.** Surfaces are `rounded-xl`, controls are `rounded-lg`,
  nothing is a pill. `.panel` and `.btn-primary` / `.btn-secondary` in
  `src/styles/global.css` encode it.
- **One theme.** The site is dark end to end. No section inverts.
- **Eyebrows are rationed.** At most every other section gets the small
  uppercase mono label. Six in a row is the tell.
- **Real screenshots only.** Sections use files from `public/screenshots/`.
  Do not rebuild product UI out of `div`s or frame the app icon as a preview.
- **No em dashes or en dashes** in visible copy. A hyphen or a second sentence
  does the same job without the machine-written cadence.
- **Motion is opt-in.** `.reveal` elements are only hidden once `BaseLayout`
  adds `reveal-ready` to `<html>`, which it skips for reduced-motion visitors.
  A broken script therefore shows the content rather than a blank page.

## Download Page

`src/pages/download.astro` is the page users land on from every "Download"
control. Its release artifacts live in one place, `src/data/downloads.ts`:

- `LATEST_VERSION` — bump this after cutting a release, then check the asset
  filenames still match what the release published.
- `platforms` — per-OS asset lists, byte sizes, and install steps.
- `CONTAINER_IMAGE` — the GHCR image shown in the self-host section.
- `DEMO_URL` — set to the hosted PWA instance URL to reveal the "Try the hosted
  demo" button. While it is `null` the page shows self-host instructions only.

The hosted demo is deployed from the repo-root `render.yaml` blueprint. See
`docker/README.md` for the image itself.

## Donations

`src/data/support.ts` holds `BUY_ME_A_COFFEE_URL`. Every coffee button — the
footer link on all pages and the support block on the download page — is gated
on it, so the site never ships a donation link until that one value is set.

## Blog Comments

Blog posts render Giscus comments from `apps/website/src/components/GiscusComments.astro`.
Giscus stores comments in GitHub Discussions for `4gray/iptvnator` and maps each page to a discussion by `pathname`, including the GitHub Pages base path such as `/iptvnator/blog/why-external-players-help/`.

The embed is wired to the dedicated `Blog comments` discussion category:

- Repository id: `MDEwOlJlcG9zaXRvcnkyMTMxOTQ3Mzg=`
- Category id: `DIC_kwDODLUX8s4C9eBJ`
- Mapping: `pathname`
- Theme: `transparent_dark`

If the category is recreated, query the new category id:

```bash
gh api graphql \
  -f owner=4gray \
  -f name=iptvnator \
  -f query='query($owner:String!, $name:String!) { repository(owner:$owner, name:$name) { discussionCategories(first:25) { nodes { id name slug isAnswerable } } } }'
```

Then update `data-category-id` in `GiscusComments.astro`.

Moderation happens in GitHub Discussions. Maintainers can hide, delete, lock, or move discussions and comments from the repository Discussions UI.
