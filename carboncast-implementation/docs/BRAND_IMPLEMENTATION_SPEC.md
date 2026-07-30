# CarbonCast IPTV Brand Implementation Specification

## Identity

**Product name:** CarbonCast IPTV  
**Logo concept:** Signal Blade  
**Primary tagline:** Stream more. Live better.  
**Utility line:** Live channels. Fast access.

## Palette

| Token | Hex | Use |
|---|---:|---|
| Carbon Black | `#07090C` | Main shell/player |
| Carbon Panel | `#11161B` | Navigation/cards/overlays |
| Carbon Lifted | `#171E25` | Hovered/elevated surfaces |
| Racing Red | `#E10D1A` | Brand/primary/live |
| Hot Red | `#FF2233` | Focused live emphasis |
| Signal Orange | `#FF6A00` | Upcoming/scheduled/countdown |
| Electric Cyan | `#00D8FF` | Connected/focus/info |
| Paper White | `#F4F7FA` | Primary text/icon core |
| Steel | `#8C98A5` | Secondary text |
| Border | `#26313C` | Dividers/outlines |

## Semantic roles

- `live`: racing red
- `upcoming`: signal orange
- `autoSwitchCountdown`: signal orange
- `connected`: electric cyan
- `guideFocus`: electric cyan
- `danger`: hot red, reserved for destructive actions—not generic live state
- `success`: retain the app's accessible success green if one exists; do not misuse cyan

## Texture

Use carbon fiber only on large shell/splash surfaces. Do not place it behind dense schedules, subtitles, form fields, or channel lists. Use flat panel colors for readability.

## Typography

Use the app's existing bundled/system typography when possible. Recommended fallback:

- Display: Inter/Arial/Helvetica, 800–900
- Interface: Inter/system-ui, 400–700
- Technical values: JetBrains Mono/ui-monospace

Do not add a font download dependency merely to imitate concept-board typography.

## Accessibility

- Minimum body text contrast: WCAG AA.
- Visible keyboard focus ring: 2 px electric cyan with 2 px offset.
- Never communicate live/upcoming/connected state by color alone.
- Respect reduced-motion preferences.
- Keep loading animation under 3 flashes per second.
- Minimum touch target: 44 × 44 CSS px.

## Logo usage

- Dark surfaces: `logo-horizontal-dark.svg` or `logo-mark.svg`.
- Light surfaces: `logo-horizontal-light.svg`.
- Small UI: mark only.
- Minimum mark size: 24 px digital.
- Keep clear space equal to 12.5% of mark width.
- Do not distort, rotate, bevel, recolor or add neon bloom.
