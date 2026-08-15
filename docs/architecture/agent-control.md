# Agent Control Architecture

IPTVnator exposes one live, renderer-backed control plane for local agents. It
is consumed by the MCP server and `iptvctl`; neither tool fabricates playlist
files, launches a second app instance, or reports a command as applied before
the running renderer acknowledges it.

## Runtime flow

```text
MCP stdio or iptvctl
        |
apps/agent-control/src/client.mjs
        |
authenticated HTTP /api/agent-control/v1
        |
Electron AgentControlEvents -- IPC --> AgentControlRuntimeService
        |                                    |
        +---- audit + SSE state events <------+-- real Angular stores/media
```

`AgentControlRuntimeService` executes commands through the same NgRx stores,
`SettingsStore`, followed-series service, router, and active built-in media
element used by the GUI. The main process waits up to ten seconds for a
correlation-ID-matched `AGENT_CONTROL_COMMAND_RESULT`; success therefore means
the UI runtime accepted the request, not merely that a request was queued.

## API and result envelope

The bridge is served by the existing remote-control HTTP server when desktop
remote control is enabled. The versioned routes are:

- `GET /health` — unauthenticated liveness only
- `GET /state` — scoped current state
- `GET /events` — Server-Sent Events (`state.changed`, `command.completed`)
- `POST /command` — a safe named operation and parameters
- `GET|POST /tokens`, `POST /tokens/revoke`, `POST /tokens/rotate`

Command responses use a stable envelope: `success`, `operation`, `requested`,
`previousState`, `state`, `timestamp`, `correlationId`, and a structured error
(`code`, `message`, `retryable`) on failure. Requests may safely retry using a
stable correlation ID; the main process retains a bounded completed-result
cache for idempotent retries.

Supported operation families include player transport and volume, channel
selection, EPG refresh/current programme, favorites, followed-series and
auto-switch preferences, safe settings, diagnostics, and internal navigation.
An engine-specific action such as recording, audio-track selection, or PiP
returns `operation-unsupported` when the active engine cannot execute it;
callers must not infer success from an unavailable capability.

`diagnostics.screenshot` is the one exception to the renderer-acknowledgement
rule: it is served entirely from the main process with
`BrowserWindow.capturePage()`. The reason to ask for a screenshot is usually
that the renderer has stopped answering, and a capture gated on the renderer's
acknowledgement would fail in exactly that case. Two constraints follow from it
being reachable over an authenticated HTTP endpoint:

- The file name is generated, never taken from the request. Captures land in
  `<userData>/agent-screenshots/`, timestamped plus a random suffix (two
  captures inside one millisecond would otherwise overwrite each other), and
  the directory is pruned to its newest 40 entries. Accepting a caller-supplied
  path would be an arbitrary file write.
- The absolute path is returned as `file`, not `path`. Every response is passed
  through the credential redactor, whose key pattern includes `path`, so the
  one value the caller needs came back as `[redacted]`.

## Security model

- Every state, event, command, and token-management route requires a bearer
  token with the exact scope required by the operation. `GET /health` leaks no
  account, playlist, or playback details.
- Tokens are persisted only as SHA-256 hashes with label, scopes, creation,
  optional expiry, and revocation timestamp. A valid initial administrator
  token can be supplied through `IPTVNATOR_AGENT_TOKEN` when Electron starts;
  its hash is imported once. `IPTVNATOR_AGENT_TOKEN_EXPIRES_AT` optionally sets
  its expiry.
- Create/rotate return a raw token exactly once to the authenticated caller.
  Raw tokens are never stored, logged, audited, or sent on SSE.
- Reads are limited to 120 requests/minute/token; control and token writes are
  limited to 30 requests/minute/token and return `429` plus `Retry-After`.
- Every command and token lifecycle action is appended as redacted NDJSON in
  Electron `userData/agent-control-audit.ndjson`.
- Recursive redaction masks fields named as credentials, tokens, URLs, stream
  sources, authorizations, or paths. The public state and MCP data adapters
  intentionally expose identifiers and display metadata only—never raw stream
  URLs, portal credentials, playlist source URLs, or file paths.

## MCP and CLI

`apps/mcp-server` retains safe read-only SQLite catalog/EPG queries and forwards
live operations through `apps/agent-control/src/client.mjs`. `apps/iptvctl`
uses that identical client and maps errors to fixed process exit codes:

| Exit | Meaning |
| ---: | --- |
| 0 | command completed |
| 2 | usage error |
| 3 | authentication or authorization failure |
| 4 | bridge or renderer unavailable |
| 5 | requested item not found |
| 6 | conflict |
| 7 | rate limited |
| 8 | remote command failure |
| 10 | internal CLI failure |

`iptvctl events --jsonl` streams the bridge SSE feed as JSON Lines. `--dry-run`
shows a write operation without dispatching it, and `--confirm` explicitly
marks an intentional write for operations that require confirmation.
