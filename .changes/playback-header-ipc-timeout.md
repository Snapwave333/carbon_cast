---
type: fix
area: playback
---

A channel no longer gets stuck on a black screen when the desktop app is busy.
Playback waits for the stream's custom request headers to be applied, and if
that wait does not finish quickly the stream now starts with default headers
instead of never starting at all.
