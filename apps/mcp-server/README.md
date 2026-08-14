# CarbonCast IPTV MCP server

The CarbonCast IPTV Model Context Protocol server speaks stdio JSON-RPC and gives an
agent two deliberately separate surfaces:

| Surface                 | Source                                                    | Availability                   | Safety                                                                       |
| ----------------------- | --------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| Catalog and guide reads | Local SQLite through Node `node:sqlite`                   | App may be closed              | Safe metadata only; no source URLs, credentials, paths, or provider payloads |
| Live control            | Running Electron renderer through `/api/agent-control/v1` | Desktop remote control enabled | Bearer token, scopes, audit log, rate limit, redacted result envelope        |

The server is zero-dependency at runtime. It uses `node:sqlite` rather than
the Electron-ABI-bound `better-sqlite3`, so system Node 22.5+ can query the
local catalogue safely.

## Start

```powershell
$env:IPTVNATOR_AGENT_TOKEN = '<a scoped token>'
node apps/mcp-server/src/main.mjs
```

## Global install

To make the server and the `iptvctl` CLI available to every agent and shell on
the machine, without each one needing to know where this repository lives:

```bash
node tools/global/install-global.mjs
```

This writes `carboncast-mcp` and `iptvctl` shims into a directory already on
`PATH` (it never edits `PATH` itself), and registers an MCP server named
`carboncast` in whichever agent configs exist: Claude Code (`~/.claude.json`),
Claude Desktop, Gemini CLI, and Codex CLI. Every file it touches is backed up
first with a timestamped `.bak`.

Pass `--dry-run` to print the plan without writing anything. Because all paths
are derived from the script's own location, re-run it after moving the
repository to repoint every shim and config.

Catalog reads use `~/.iptvnator/databases/iptvnator.db` by default. Set
`IPTVNATOR_DB_PATH` only when explicitly targeting a different local profile.

For live tools, start Electron with a bootstrap administrator token once:

```powershell
$env:IPTVNATOR_AGENT_TOKEN = '<at least 24 random characters>'
pnpm run serve:backend
```

Enable **Remote Control** in desktop settings so the local server is running.
The bootstrap value is saved only as a hash. Use `agent_tokens_create` to mint
a narrower MCP token and remove the bootstrap environment variable afterwards.

## Tool groups

| Group          | Examples                                                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library        | `list_playlists`, `list_categories`, `list_channels`, `search_channels`, `get_channel`, `list_favorites`, `list_downloads`                                        |
| EPG            | `get_epg_now_next`, `whats_on_now`, `find_now_playing`, `get_epg_schedule`, `epg_current`, `epg_refresh`                                                          |
| Player         | `player_get_state`, `player_play`, `player_pause`, `player_stop`, `player_set_volume`, `player_seek`, `player_set_fullscreen`, `player_toggle_picture_in_picture` |
| Channels       | `channel_list_active`, `channel_switch`, `channel_next`, `channel_previous`                                                                                       |
| Personal state | `favorites_set`, `follows_list`, `follows_set`, `follows_set_auto_switch`                                                                                         |
| System         | `settings_get_live`, `settings_update_live`, `diagnostics_get_live`, `app_navigate`                                                                               |
| Security       | `agent_tokens_list`, `agent_tokens_create`, `agent_tokens_revoke`, `agent_tokens_rotate`                                                                          |

Live control results always include `success`, operation, requested parameters,
previous/new state, a timestamp, correlation ID, and structured retry guidance
on failure. An unsupported engine feature returns a truthful
`operation-unsupported` result rather than pretending it happened.

## MCP configuration

```json
"iptvnator": {
  "enabled": true,
  "command": "node",
  "args": ["C:/Users/chrom/Developer/iptvnator/apps/mcp-server/src/main.mjs"],
  "env": {
    "IPTVNATOR_AGENT_TOKEN": "<scoped token>"
  }
}
```

## Verify

```powershell
node --test apps/agent-control/src/client.test.mjs
node apps/mcp-server/smoke.mjs
```

The smoke script exercises the catalog tools against a local database. Live
tool verification requires the running Electron bridge and a scoped token.

See [Agent Control Architecture](../../docs/architecture/agent-control.md) for
the complete transport, authentication, audit, and event-stream contract.
