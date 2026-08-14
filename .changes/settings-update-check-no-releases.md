---
type: fix
area: settings
---

Opening Settings no longer throws an error in the background when the update
check finds no published release. The check now reports "Update check failed"
instead of failing silently, and it says the same when the network request
itself fails.
