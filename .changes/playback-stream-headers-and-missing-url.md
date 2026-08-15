---
type: fix
area: playback
---

Channels that need a custom user-agent or referrer now play reliably: the
headers are applied before the player requests the stream instead of racing it,
so the first request is no longer sent with the wrong ones. An item the
provider returns without a stream URL now explains itself instead of showing a
silent black player.
