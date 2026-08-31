---
type: fix
area: cli
---
`iptvctl` no longer reports a failed request as a success: an HTTP error from the bridge now exits non-zero with the real reason. Errors print to stderr so `--json` output stays parseable, unknown commands list what the group accepts, and Ctrl-C ends `iptvctl events` cleanly. The bridge now answers URLs with query strings, accepts only loopback callers, and keeps event streams alive.
