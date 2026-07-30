---
type: perf
area: web-backend
---

The self-hosted web version now parses TV guide (EPG) data in a background
thread, so the server stays responsive while large XMLTV files are loaded.
