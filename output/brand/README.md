# Dimension wordmark — vector review

- `dimension-wordmark-traced.svg`: filled vector paths, transparent background,
  flat white. No embedded raster, font, or external resource. Original 2172 × 724
  canvas, lettering proportions, counters, and spacing retained.
- `dimension-wordmark-comparison.png`: original PNG above, rendered SVG below,
  presented at the same scale on a dark background.
- `trace-report.json`: silhouette comparison at the source resolution.

Source: `public/brand/dimension-wordmark.png`. Traced using Potrace with binary
luminance/alpha threshold 128, alphaMax 0.7, curve optimization tolerance 0.1,
and speck suppression 2. Temporary tracing dependencies were removed afterward.

The original PNG has subtle shading; this SVG traces its silhouette as flat white
shapes. It is a review candidate, not a claim of pixel-identical shading. The
website still uses its existing PNG until the design is approved.
