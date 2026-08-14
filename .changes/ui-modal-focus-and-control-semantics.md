---
type: fix
area: ui
---

Modal dialogs — the keyboard-shortcuts overlay and the destructive reset
confirmations — now place keyboard focus inside the dialog instead of leaving
it on the page behind, and the settings backup/reset buttons are explicit
`type="button"` controls so they no longer risk submitting a surrounding form.
A stale pop-out failure alert no longer lingers after the pop-out it referred
to is gone.
