# Radio visualizer preview

Looks at, and measures, the radio player's metaball visualizer
(`libs/portal/radio/feature/src/lib/radio-visualizer/`).

```bash
pnpm run viz shots      # screenshot each dock size to tmp/visualizer-preview/
pnpm run viz coverage   # how much of the frame the blobs cover
pnpm run viz trails     # diff motion trails on against off
pnpm run viz perf       # rough per-frame cost, with and without trails
```

## Why this exists

The visualizer is a fragment shader. Unit tests can cover the geometry that
feeds it (`computeOrbPlacements`) but not what it draws, and the in-app browser
preview does not composite, so `requestAnimationFrame` never fires there and the
frame loop never runs at all. Without this tool the only way to judge a change
is to reason about the shader, and the terms interact in ways that do not
survive that.

Every one of these was shipped, invisible in code review, and caught here:

| Symptom | Cause |
| --- | --- |
| Every blob had a grey core | The hue used the raw field, which is unbounded at an orb's centre, so it spun through whole revolutions across two pixels and the blur averaged it out |
| Receding blobs had a dark hole | The depth blend used the raw contribution as its weight, so an orb's own depth won outright at its own centre |
| ...still a dark hole | Depth was also a factor in `alpha`, where every other term has saturated and nothing counterbalanced it |
| The whole picture washed out | Trails composited each frame *over* the faded buffer, which integrates: a static halo at alpha 0.3 settles at 0.79 |
| One blob teleported across the frame | The clinger chased its single nearest neighbour, which flips the instant two are equidistant |

## Reading the numbers

`coverage` is the fraction of the frame covered by solid body, sampled across
time. It is the guard against the flat-wash failure, which crept back in twice
after unrelated tuning — the temperaments make the orbs gather far more than
independent paths did, and prominence made the lead bigger. As a rough guide the
compact strip sits near `0.30` and the large stage near `0.38`; much past `0.5`
and the blobs stop reading as separate bodies.

`trails` must report the lit pixel count **unchanged** between on and off. A
trail adds tails to moving edges; if it also changes how many pixels are lit at
all, it is integrating rather than trailing.

`perf` runs under SwiftShader, a CPU rasterizer, so the absolute milliseconds
mean nothing. It over-weights the field evaluation relative to the memory-bound
fade and blit, so treat the overhead figure as a rough lower bound.

## How it works

`entry.ts` bundles the real renderer and energy model — not a copy — and exposes
`renderFrames`, which drives a genuine frame sequence rather than one shot
(trails only exist across frames). `harness.html` reproduces the dock: the same
background, the same `blur(7px) saturate(1.3)`, the same mask, and a stand-in
transport row so it is obvious whether the blobs read behind real UI. `?raw=1`
strips the presentation and shows the shader's own output, which is what to look
at when diagnosing the shading rather than the composition.
