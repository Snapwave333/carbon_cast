---
type: feature
area: agent-control
---

`iptvctl diagnostics screenshot` captures the app window and saves a PNG, so
scripted sessions can see what the app is actually showing. It is served from
the main process, which means it still answers when the interface has stopped
responding — the moment you most want a screenshot.
