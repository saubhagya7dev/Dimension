# Dimension Display Bold — 1.000

Custom uppercase display typeface derived from the approved alphabet concept.
The portfolio's existing typography and original wordmark have not been changed.

## Font files

- `DimensionDisplay-Bold.ttf`: installable TrueType outlines.
- `DimensionDisplay-Bold.otf`: installable OpenType/CFF outlines.
- `DimensionDisplay-Bold.woff2`: compressed webfont for later selective website use.
- `DimensionDisplay-Bold-1.000.zip`: fonts, editable outlines, previews and reports.
- Family: **Dimension Display**; style/weight: **Bold / 700**.

## Coverage

26 distinct uppercase A–Z glyphs, space, and a missing-character glyph. Lowercase
codepoints map to the uppercase designs, so typing either case produces capitals.
There are no digits, punctuation, accents, or separate lowercase letterforms in
this version; these were not included in the approved concept. Use for selected
display headings, not body copy. Embedding is unrestricted in the font metadata.

## Fidelity and source

`source/approved-alphabet-concept.png` is the approved reference. Each letter was
isolated from its own grid cell and traced into sharp vector paths. Shared row
baselines and scales retain the pointed extensions rather than stretching every
letter into an identical rectangle. `source/glyphs/` contains 26 editable SVG
outlines; `source/glyph-metrics.json` records extraction and font metrics.

The generated concept is a raster reference. These are matched vector silhouettes,
not pixel-identical copies of its edge antialiasing or slight tonal variation.
The comparison image shows approved silhouettes above compiled TTF glyphs. No
third-party typeface supplies the display letterforms.

## Validation and preview

Both font formats are reopened with checksum checks and fully decompiled; all
letters are independently rasterized through FreeType. Basic kerning and aligned
vertical metrics are included. `validation.json` records glyph checks and a
100px silhouette comparison (rasterization/hinting affect that score).

Open `specimen.html` through a local HTTP server to view the real TTF, OTF and
WOFF2 files in a browser. For example, run `python -m http.server 4322 --bind
127.0.0.1 --directory output/typeface` from the project root, then open
`http://127.0.0.1:4322/specimen.html`.

## Rebuild

Create an isolated Python 3.12 environment, install
`tools/typeface/requirements.txt`, and run `tools/typeface/build_font.py` from the
project root. It builds the font files, source SVGs, metrics, validation report
and verification image from the approved reference. Outputs can be regenerated;
keep a copy of manual outline edits before rebuilding.
Run `tools/typeface/package_font.py` afterward to recreate the ZIP bundle.
