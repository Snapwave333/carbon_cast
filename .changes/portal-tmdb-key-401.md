---
type: fix
area: portal
---

A TMDB API key pasted with a leading `Bearer ` or wrapped in quotes now works instead of failing with an unexplained error. When TMDB does reject a key, Settings → Metadata (TMDB) makes the next step clear rather than showing a bare "401".
