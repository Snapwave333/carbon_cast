# Free-Channel Catalogue And Playlist Merging

Two related features live here: the **Discover** tab that lets a user import
public IPTV playlists without having one to paste, and the **merge** that
combines several playlists into one.

## Why the catalogue is bundled, not fetched

`libs/playlist/shared/util/src/lib/channel-sources/channel-source-catalog.data.ts`
is a committed snapshot of the public iptv-org index. Fetching it when the
dialog opens would make the tab useless offline and put a network round-trip in
front of the first thing a new user sees.

A snapshot rots, so regeneration is a tool rather than a manual edit:

```bash
node tools/channel-sources/build-catalog.mjs
```

`--check` probes a sample of the URLs and exits non-zero on any dead entry. That
check exists because it caught a real failure during the initial build: the
`i.mjh.nz` per-service playlist paths had moved, and six hand-written entries
would have shipped as 404s.

The generated file is `eslint-disable max-lines` by design — it is data, not
code, and the generator skips files carrying their own disable comment so it
never lands in the `max-lines` baseline.

Curated entries live separately in `channel-source-featured.ts` so regenerating
the country and category slices never clobbers a hand-written description or a
hand-checked EPG URL.

## Attribution is structural

Every entry carries a `provider` with a homepage, rendered on each row. The app
hosts no streams and re-publishes nothing; the catalogue is a set of bookmarks
and the UI has to say so. `provider` is a required field rather than something
inferred from the URL host, so a new entry cannot be added without naming its
source.

## No EPG for most entries

The iptv-org playlists carry no `x-tvg-url`, and the project's EPG GitHub Pages
site is gone. Rather than hardcode guide URLs that would rot the same way, only
entries with a verified guide declare `epgUrls`; everything else relies on the
playlist header (handled already by `resolveM3uEpgUrlSelection`) or the user's
own EPG settings.

## Import path

`ChannelSourceImportService` fetches each source through `RemoteTextService`,
parses it with the same `resolvePlaylistParser` the file and URL imports use,
and then either dispatches one `addPlaylist` per source or merges first.

It deliberately does **not** reuse the `PLAYLIST_PARSE_BY_URL` IPC: merging
needs the parsed items in the renderer before anything is written, and running
both modes through one path keeps them behaving identically apart from the final
grouping.

`addPlaylist` is dispatched per playlist rather than `addManyPlaylists`, because
the single-playlist effect is what fetches the playlist-scoped EPG and navigates
to the import; the bulk action does neither.

A dead mirror fails that one source and is reported in `failures`; it never
aborts the rest of the import.

`RemoteTextService` moved from `libs/portal/radio/data-access` to
`libs/services` when this landed — it was always generic, and podcasts are no
longer its only caller. The old path re-exports it.

## Merging

`mergeParsedPlaylists` in `libs/shared/m3u-utils` is the whole of the merge
logic, and it is pure so it can be tested without a store.

Dedup is by **normalized stream URL only**. Two things follow from that:

- Only the scheme and host are case-folded. The path and query of a stream URL
  are frequently case-sensitive tokens, and lowercasing them breaks playback.
- Channel identity (`tvg-id`) is deliberately *not* a dedup key. Aggregators
  publish several streams per channel — mirrors and quality variants — and
  collapsing them would throw away every backup stream.

Headers are merged by unioning `x-tvg-url` across sources. Keeping only the
first source's header would silently strip the guide from every other slice.

`maxItems` (default 250,000) reports truncation rather than letting a merge of
several country lists hold six figures of channels in memory with no
explanation.

Merging already-imported playlists (`PlaylistMergeService`) is **non-destructive**:
the sources stay exactly as they were. A destructive merge would discard the
per-playlist favourites, watch history and EPG settings attached to each one,
and there is no undo for that. Only M3U playlists can be merged — an Xtream or
Stalker entry is a set of credentials whose content lives in the database behind
a portal session, not in `playlist.items`.

## Content filters

`channel-content-filter.util.ts` hides religious channels and restricts news to
the viewer's country. Both default on.

Both read the provider's `group-title` and never re-classify from the channel
name, matching the rule in `category-normalization.util.ts`. Name matching would
put "Newsmax", "News 12" and "Good News Church TV" in one bucket, and a viewer
cannot tell why a channel vanished.

Two deliberate conservatisms:

- The religious key list is explicit, not a prefix rule. "Christian Rock" is a
  music group and a `startsWith('christ')` test would hide it.
- A news channel whose metadata names no country is **kept**. Most
  single-country playlists omit `tvg-country` entirely, and treating unknown as
  foreign would empty the news group for exactly the users the filter helps.

`homeCountryCode` is seeded from the browser locale's region and is empty when
the locale names none (`en` rather than `en-GB`). An empty value leaves the news
filter inert rather than guessing a country and hiding the user's own news.

## Files

| Path                                                              | Role                                  |
| ----------------------------------------------------------------- | ------------------------------------- |
| `tools/channel-sources/build-catalog.mjs`                         | Regenerates / checks the snapshot     |
| `libs/playlist/shared/util/src/lib/channel-sources/`              | Catalogue data, model, import + merge |
| `libs/playlist/import/feature/src/lib/channel-source-directory/`  | Discover tab UI                       |
| `libs/playlist/import/feature/src/lib/merge-playlists-dialog/`    | Merge dialog                          |
| `libs/shared/m3u-utils/src/lib/merge-playlists.util.ts`           | Pure merge + dedup                    |
| `libs/shared/m3u-utils/src/lib/channel-content-filter.util.ts`    | Religious / local-news filters        |
