---
type: fix
area: agent-control
---

Asking the CLI or MCP server for channels while the TV guide is open no longer
looks like an empty playlist. Those routes don't load the channel list, so the
answer now says so, and switching channels from there explains what to do
instead of reporting the channel as missing.
