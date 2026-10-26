# Particle rendering verification

The previous implementation drew each SVG fragment individually in Canvas 2D,
and redrew the intact scrolling letters into that fixed overlay. The new version
keeps both intact logos in their native SVG elements with directional clip-paths.
Only detached fragments use the overlay, in one WebGL2 instanced draw call.
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
