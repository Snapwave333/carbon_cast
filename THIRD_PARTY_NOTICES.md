# Third-Party Notices

CarbonCast IPTV includes software from the projects listed below. Their
licenses and copyright notices are preserved.

## IPTVnator

CarbonCast IPTV is a fork of [IPTVnator](https://github.com/4gray/iptvnator).
The upstream project and its contributors are credited under the original
license. CarbonCast IPTV is an independent fork and is not endorsed by the
upstream maintainers.

The upstream license is retained unchanged in [LICENSE.md](./LICENSE.md), and
upstream copyright headers are preserved throughout the source tree.

## Bundled runtimes and dependencies

- **libmpv / mpv** — used by the optional Embedded MPV playback engine. See
  `vendor/embedded-mpv/*/runtime-manifest.json` for the exact staged runtime and
  its provenance, and the generated notices under `vendor/embedded-mpv/*/notices`
  where produced by the packaging pipeline.
- **npm dependencies** — each retains its own license as published on the npm
  registry; see the `node_modules` tree of a given install or the lockfile for
  the exact resolved set.
