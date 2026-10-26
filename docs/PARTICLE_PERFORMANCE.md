# Particle rendering verification

The previous implementation drew each SVG fragment individually in Canvas 2D,
and redrew the intact scrolling letters into that fixed overlay. The new version
keeps both intact logos in their native SVG elements with directional clip-paths.
Only detached fragments use the overlay, in one WebGL2 point-sprite draw call.
The spark was removed. The SVG artwork, particle count, burst, wandering paths,
and reversible scroll timing are preserved on the WebGL2 path.

Local development preview measurements on the same desktop browser:

| Check | Previous | Updated |
| --- | --- | --- |
| Desktop fragments | 8,123 | 8,123 |
| Main-thread particle update / submission | 66.80 ms average in baseline scroll | 0.15–0.40 ms average in revised scroll checks |
| Intact SVG width at scroll Y 144 and 72 | Transferred to canvas | 735.796875 px at both positions |
| Intact SVG document Y at those positions | Transferred to canvas | 216.2261 px at both positions |

These are development measurements of CPU work, not total GPU frame time or
a universal FPS guarantee. The revised timing includes SVG clip updates and GPU
command submission. Dev-only timing and renderer diagnostics are available in
the particle canvas's data attributes; production builds omit timing writes.

The 390px mobile preview uses 3,780 fragments and measured 0.27–0.31 ms CPU
submission averages in these checks, with no horizontal overflow. Header
completion and reverse scrolling were also verified in that viewport.

Particles use a bounded Canvas 2D fallback without WebGL2. A lost GPU context
uses the static logo handoff rather than leaving partially clipped letters.

## Repeated-scroll follow-up

The initial GPU version still calculated each fragment's trajectory six times,
once for every vertex of its quad. The current renderer uses one point vertex
per fragment: 8,123 instead of 48,738 desktop vertices, without removing any
fragments. Static drift directions and a 256-entry timing lookup are computed
once. Both particles and the decorative orbit are capped at 60 updates/second
so high-refresh displays do not multiply the background workload.

An asynchronous GPU fence allows at most one pending particle draw. When busy,
the next animation frame uses the latest scroll position instead of building a
queue of stale draws. The canvas uses opacity at endpoints, retaining its surface
instead of repeatedly toggling display. Initialization is guarded and disposes
the previous instance, including its listeners, buffers, textures, and fence.

### Sustained local test

`tools/qa/particle-scroll.html` drives the real homepage in a 1280×720 iframe:
10 cycles from scroll Y 0 to 600 and back, 900 ms per direction. Raw runs are
saved in `output/preview/particle-repeat-initial.json` and
`output/preview/particle-repeat-final.json`.

- Exactly one particle canvas and two total canvases in every cycle.
- All cycles returned to transition progress 0.000.
- Final run: one frame gap over 50 ms in cycle 1; none in cycles 2–10.
- Final run cycle 10 frame-gap p95: 33.3 ms; initial run cycle 10: 50 ms.
- Initial run cycle 8 p95: 75.1 ms; final run cycle 8: 33.4 ms.

These are animation-frame callback gaps in a local development iframe, not GPU
timer queries or a universal FPS guarantee. They include page/compositor work,
unlike the earlier CPU submission measurements. External machine load can affect
the results. GPU backpressure still occurs, but stays bounded rather than queued.

To repeat: temporarily copy the HTML fixture into `public/particle-scroll-qa.html`,
start the dev server, open that local URL, and click Run. Remove the public copy
after testing; it is not part of the shipped site.
