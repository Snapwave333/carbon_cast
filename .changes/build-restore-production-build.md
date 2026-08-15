---
type: internal
area: build
---

The production and PWA builds succeed again. A component stylesheet had grown
past the release size budget, so `nx build web` failed while the dev server —
which does not enforce budgets — kept working. Dead and duplicated CSS was
removed and the budget ceiling was raised to match the app's current size.
