# Navigation UX decision: top dock

Date: 2026-08-22

| Decision                                                                             | Status                                          |
| ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Replace the mirrored side rail with a full-width navigation dock above the workspace | Implemented                                     |
| Keep playlist tabs prominent without creating another bar                            | Implemented as the first group in one strip     |
| Preserve the existing routes, active states, tooltips, and Settings access           | Required compatibility contract                 |
| Let `mirrorLayout` continue to affect player/channel layouts                         | Preserved; it no longer moves global navigation |

## Why the rail was replaced

| Previous problem                                                                                                         | Top-dock response                                                                           |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| The default mirrored layout placed global navigation on the right edge, away from the usual reading and scanning origin. | Global navigation now stays above the workspace regardless of the player layout preference. |
| The rail consumed 100 px collapsed and 232 px expanded from channel, guide, and media layouts.                           | The content body now uses the full window width.                                            |
| Global and playlist-local destinations appeared in one vertical stack.                                                   | Playlist tabs lead one horizontal strip, followed by global links after a quiet divider.    |
| Icon-only global destinations required hover discovery or an expansion mode.                                             | Destinations are labelled by default and retain accessible names.                           |
| The glass tile stack read as a detached launcher rather than part of the app's information architecture.                 | The carbon-toned dock is integrated with the shell and uses one restrained active accent.   |

## Layout contract

| Area                 | Behavior                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Brand                | Anchors the bar and routes to Dashboard or Sources according to startup preferences.     |
| Provider context     | Leads the shared strip and preserves primary/secondary provider grouping.                |
| Workspace navigation | Follows provider tabs in the same labelled, horizontally scrolling strip.                |
| Settings             | Remains persistent at the end of the single bar.                                         |
| Narrow windows       | The shared strip scrolls horizontally; brand and Settings remain fixed and reachable.    |
| Window chrome        | The native/custom control clearance stays in the titlebar strip above the dock.          |
| Motion               | Short opacity/translate entry and hover feedback; reduced-motion removes the animations. |

## Visual rules

| Rule         | Implementation                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Accent       | Use `--mat-sys-primary` for the current-destination datum line and active icon. Do not assign separate provider colors. |
| Surfaces     | Use the shell's cool carbon surface tokens, a restrained radial highlight, and tinted depth shadow.                     |
| Active state | Combine a quiet tinted background, outline, active icon, and short underline; do not rely on color alone.               |
| Focus        | Every destination, brand link, and Settings link needs a visible focus ring.                                            |
| Labels       | Keep link names on one line with a bounded width and ellipsis for long translations.                                    |

## Key files

| Concern                           | File                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Shell placement                   | `libs/workspace/shell/feature/src/lib/workspace-shell/workspace-shell.component.scss`                  |
| Dock structure and surface        | `libs/workspace/shell/feature/src/lib/workspace-shell/components/workspace-shell-rail/`                |
| Destination presentation          | `libs/workspace/shell/feature/src/lib/workspace-shell/components/workspace-shell-rail-links/`          |
| Link construction and route state | `libs/workspace/shell/feature/src/lib/workspace-shell/services/workspace-shell-route-state.service.ts` |
| Browser regression coverage       | `apps/web-e2e/src/rail.e2e.ts`                                                                         |
