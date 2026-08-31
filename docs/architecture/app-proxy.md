# Per-app proxy

Routes CarbonCast IPTV's own streaming through a proxy so a region-locked
channel resolves from the proxy's exit country. It is **not** a VPN: nothing
outside this app is affected, and the rest of the machine keeps its normal
route.

Electron only. A browser page cannot choose its own egress, so
`RuntimeCapabilitiesService.supportsProxy` is false in the PWA and the Settings
section is hidden there.

## What is and is not proxied

| Traffic | Proxied |
| --- | --- |
| HLS/DASH manifests and segments in the built-in players | **Yes** — this is what unblocks a geo-restricted stream |
| Anything else the renderer fetches (artwork, TMDB, radio catalogues) | Yes |
| Playlist and EPG downloads issued from the main process | **No** |
| External MPV/VLC, and Embedded MPV | **No** — separate processes with their own network stacks |

The main process fetches playlists and EPG with Node's `fetch`, which does not
consult Chromium's proxy. That is deliberate for now: the geo-block is enforced
at the stream CDN, so proxying the Chromium session is what actually matters,
and leaving playlist/EPG on the direct route avoids pushing large downloads
through a metered exit. Proxying them would mean an undici `ProxyAgent` (HTTP
only) or a new SOCKS dependency.

## Implementation

- Contract, normalization, and rule building:
  `libs/shared/interfaces/src/lib/proxy.interface.ts`
- Main process: `apps/electron-backend/src/app/services/proxy.service.ts`
- Settings UI: `apps/web/src/app/settings/settings-network-section.component.*`
  with `settings-proxy.facade.ts` driving the test button
- Persisted in the **main-process** config store (`PROXY_SETTINGS`), not the
  renderer, because the session must be configured during startup before any
  window loads a stream. `proxyService.restore()` runs in `bootstrapAppEvents`.

### Details that are easy to get wrong

- **`mode: 'direct'` when disabled, not empty rules.** An empty `proxyRules`
  string makes Chromium fall back to the *system* proxy, which is not what
  "off" means here.
- **Sockets are closed after every change.** Chromium keeps connections alive
  across `setProxy`, so without `closeAllConnections()` an already-playing
  stream stays on the old route and the setting looks broken.
- **Credentials never enter the rules string.** Chromium ignores userinfo in
  `proxyRules`, and a URL carrying a password ends up in logs and crash dumps.
  They are supplied through the app-level `login` event instead.
- **Proxy auth is app-scoped, not session-scoped.** Electron surfaces proxy
  authentication only on `app.on('login')`, so testing credentials that differ
  from the saved ones requires the `authOverride` field the service keeps for
  the duration of a probe.
- **Loopback and private ranges are always bypassed** (`ALWAYS_BYPASSED_HOSTS`).
  Routing loopback through a proxy would break the agent-control bridge and the
  remote-control server, and sending private-range requests to a remote proxy
  would leak the shape of the local network.
- **The test uses `Session.fetch`, never the global `fetch`.** Only the former
  goes through Chromium's stack; Node's fetch would ignore the proxy and report
  the direct connection as a pass.
- **The probe runs on a throwaway session** (`session.fromPartition`), so an
  unverified proxy is never installed on the live session mid-playback.

## Test connection

Fetches `https://ipinfo.io/json` through the proxy and reports the exit IP and
country. Chosen because it needs no key and returns the country, which is the
only field that matters for a geo-block. This is the one outbound request the
feature makes to a third party, and it happens only when the user presses the
button.
