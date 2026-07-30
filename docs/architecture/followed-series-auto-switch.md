# Followed Series and Automatic Episode Switching

## User contract

| Surface            | Contract                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Follow controls    | EPG programme dialogs plus Xtream and Stalker series details expose the same Follow/Following action.                                                                                                                                    |
| Schedule workspace | `/workspace/followed-series` groups upcoming broadcasts by series and episode, sorts by the next airing, and exposes alternatives, priorities, status, details, and per-airing auto-switch controls.                                     |
| Countdown          | A global, non-blocking overlay appears before a switch and offers Switch now, Cancel, and Disable auto-switch. Only its timer and the row-level remaining-time component update every second.                                            |
| Conflicts          | Simultaneous switches use an explicit prompt, series priority, or first-available policy. A prompt blocks the switch until the user chooses.                                                                                             |
| Failure recovery   | Stream probes are bounded to two attempts. A failed primary hands off to mapped alternatives once each, then records and reports a stable failure.                                                                                       |
| Persistence        | Followed series, preferences, schedules, conflicts, and the last 200 outcomes survive app restarts on the current device. IPTVnator has no account-sync subsystem, so cross-device/account synchronization is intentionally not claimed. |

## Ownership

| Layer                   | Owner                                                          | Responsibility                                                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Domain contracts        | `libs/shared/interfaces/src/lib/followed-series.model.ts`      | Versioned persisted state, programme candidates, schedules, conflicts, countdowns, and switch requests.                                                                        |
| Matching and scheduling | `libs/epg/data-access/src/lib/followed-series-*`               | Normalization, stable identities, episode deduplication, channel ranking, reconciliation, heap scheduling, notifications, and persistence.                                     |
| EPG lookahead           | `EPG_DB_FOLLOWED_SERIES_PROGRAMS`                              | Indexed time-range lookup with at most 100 title hints and 10,000 returned rows.                                                                                               |
| Playback handoff        | `apps/web/src/app/services/followed-series-runtime.service.ts` | Builds an all-playlist channel inventory, probes streams, navigates to the owning M3U route, dispatches canonical channel playback, and optionally restores the prior channel. |
| UI                      | `libs/ui/epg/src/lib/followed-series/`                         | Grouped schedule page, preferences, conflict prompt, countdown overlay, and isolated remaining-time updates.                                                                   |

## Data flow

| Phase       | Input                                                    | Output and guardrails                                                                                                                                                   |
| ----------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Follow      | Provider series metadata or an EPG programme             | Stable series identity from source, playlist, provider id, and normalized title.                                                                                        |
| Query       | Followed titles, current time, 14-day lookahead          | A bounded SQLite query uses the programme start index before title/description hint filtering.                                                                          |
| Match       | EPG candidates plus channel mappings                     | Series aliases and stable ids are preferred; punctuation, case, accents, year suffixes, channel prefixes, and common episode formats are normalized.                    |
| Deduplicate | Programme id, season/episode, episode title, description | Equivalent airings become one episode with multiple `BroadcastInstance` alternatives. Absolute ISO timestamps preserve DST transitions.                                 |
| Reconcile   | Previous and refreshed guide snapshots                   | Enabled schedules retain identity when an airing moves, become `schedule-changed`, or become `broadcast-unavailable` when canceled.                                     |
| Schedule    | Enabled schedules                                        | A min-heap arms only the next timer and wakes at most once per minute while idle.                                                                                       |
| Switch      | Countdown completion or Switch now                       | A final EPG refresh runs, unsafe recording/casting states block the handoff, candidates are probed, and the canonical NgRx playback action starts the selected channel. |

## Status model

| Status                  | Meaning                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `off`                   | The airing is visible but will not switch automatically.        |
| `enabled`               | The airing is in the scheduling heap.                           |
| `switching-soon`        | The global countdown is active.                                 |
| `schedule-changed`      | The EPG moved an enabled airing and the new time is armed.      |
| `broadcast-unavailable` | The guide canceled the airing or all mapped streams failed.     |
| `permission-required`   | A browser background switch needs explicit user confirmation.   |
| `currently-playing`     | The canonical playback action reported success.                 |
| `ended`                 | The airing has finished and is excluded from future scheduling. |

## Background and safety rules

| Runtime             | Behavior                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron            | Timers can request playback while the app is unfocused. Recording and casting protections still apply.                                                          |
| Browser/PWA visible | The runtime can perform the normal handoff.                                                                                                                     |
| Browser/PWA hidden  | It never claims a silent background switch. A granted system notification asks the user to focus/confirm; otherwise the schedule becomes `permission-required`. |
| Storage             | Stream URLs and credentials are not written to followed-series state. Channel mappings persist only stable playlist/channel ids and display metadata.           |
| Logs                | Probe failures do not log target URLs or credentials.                                                                                                           |

## Preferences

| Group               | Settings                                                                        |
| ------------------- | ------------------------------------------------------------------------------- |
| Episode selection   | New-only, rerun inclusion, default auto-switch, and next scheduled episode.     |
| Ranking             | Preferred channels, language, video quality, and per-series priority.           |
| Timing              | Early-switch lead and countdown duration, each bounded to 0/1–300 seconds.      |
| Conflicts           | Prompt, priority, or first available.                                           |
| Playback protection | Return to previous channel, disable while recording, and disable while casting. |
| Notifications       | Enablement, timing, new episodes, schedule changes/cancellations, and failures. |

## Verification contract

| Risk            | Required coverage                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Matching drift  | Normalization, stable identity, duplicate guide entries, alternate airings, rerun filtering, and DST-separated timestamps. |
| Scheduler drift | Heap ordering, prompt blocking, deterministic priority resolution, countdown timing, and bounded alternative retry.        |
| Guide refresh   | Moved and canceled airing reconciliation plus XMLTV stable-id/newness parsing.                                             |
| Persistence     | Restart restoration, malformed-state fallback, default migration, and preference bounds.                                   |
| UI integration  | Follow/unfollow accessible state, grouped view sorting, workspace route parsing, Angular build, and EPG UI suite.          |
