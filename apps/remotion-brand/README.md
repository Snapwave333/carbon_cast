# remotion-brand

Authoring project for CarbonCast's animated brand assets. It is a **build-time
tool, not a shipped app**: nothing in this folder is bundled into the web app or
the Electron build. Only the rendered asset it produces is committed and
shipped.

It is deliberately not an Nx project — it has no `project.json`, so
`nx run-many` never picks it up and normal builds, lint and test runs ignore it
entirely. Contributors who are not changing an animation never need to touch it.

## Licensing

Remotion is **not** MIT licensed. It is free for individuals and companies of up
to three employees; larger companies need a paid Remotion Company License. That
applies to anyone who runs the render commands below. It does **not** apply to
merely building or using CarbonCast, because the rendered asset is committed and
no Remotion code ships. See <https://remotion.dev/license>.

## Compositions

| ID            | Output                                             | Used by                                      |
| ------------- | -------------------------------------------------- | -------------------------------------------- |
| `LoadingLoop` | `apps/web/src/assets/animations/loading-loop.webp` | Player buffering indicator (shared controls) |

## Working on an animation

```bash
pnpm run brand:studio
```

Opens the Remotion Studio with live reload for previewing and scrubbing.

## Re-rendering the asset

```bash
pnpm run brand:loading-loop
```

That runs two steps, which can also be run separately:

1. `brand:render` — renders the composition to a PNG frame sequence in
   `apps/remotion-brand/out/frames` (PNG because the asset needs an alpha
   channel; it overlays live video).
2. `brand:sprite` — composes those frames into a single-row WebP sprite strip at
   `apps/web/src/assets/animations/loading-loop.webp`.

`out/` is generated and gitignored. **Commit the rendered `.webp`** — it is the
actual shipped artifact, and CI does not run Remotion.

## Why a sprite strip

The consumer animates the strip with a CSS `steps()` transform. `steps()` walks
one axis only, so a single row (30 x 96px frames = 2880x96) animates with one
keyframe and no JavaScript, and needs no `<video>` element.

Two constraints the consumer depends on — changing either means updating
`player-controls.component.scss` to match:

- **Frame count and frame size.** The CSS hardcodes `30` frames at `48px`
  display size (frames are rendered at 2x for crisp high-DPI output).
- **Loop duration.** 30 frames at 24fps is 1.25s, which is the CSS animation
  duration.

Every animated quantity in `LoadingLoop.tsx` completes a whole number of cycles
over `durationInFrames`, which is what lets the last frame join the first
without a visible seam.

The wide bloom behind the arcs is intentionally **not** rendered into the
frames: a full-frame soft gradient dominated the encoded size (126 KB vs 61 KB),
and the consumer reproduces it as a scalable CSS `radial-gradient` on the same
rhythm. Only the tight per-stroke glow is baked in.
