# Dimension

A creative-company portfolio built with Astro and TypeScript. Fusion Red, original Dimension branding, a filterable nine-project gallery, individual project pages, an FPV cinematics section, and scroll-led motion.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the URL printed by Astro, normally `http://127.0.0.1:4321`.

```sh
npm run check   # Astro and TypeScript diagnostics
npm run build   # Diagnostics + production static output
npm run preview # Preview the production build
npm run check:links # Verify local links and assets in dist after building
```

If Astro cannot access its telemetry configuration directory, set `ASTRO_TELEMETRY_DISABLED=1` in your terminal before running those commands.

## Change the accent

Edit `--accent` at the beginning of `src/styles/global.css`. The original design used **Fusion Red, #ff5e5e**; your current setting takes precedence. Buttons, highlights, the progress ruler and orbital scene all use this variable.

## Orbital landing page

The opening now uses `src/components/OrbitalHero.astro`, with its own stylesheet at `src/styles/orbital-hero.css` and a lazy-loaded Three.js renderer at `src/scripts/orbital-hero.ts`.

- The original Dimension wordmark, headline and actions are accessible HTML above the canvas.
- Artwork comes from `src/data/projects.ts`. Original images automatically replace the concept-sheet cells in the orbit.
- The renderer uses shallow curved planes, three orbital paths, subtle pointer parallax, and the current `--accent` color.
- Orbital rotation also follows scroll position: scrolling down advances the artwork and scrolling up reverses it, with a short smoothing response layered over the slower idle drift.
- Desktop motion runs at a maximum of 30 frames per second, with device pixel ratio capped at 1.5. Rendering and background video pause when the hero leaves the viewport or the browser tab is hidden.
- The **Pause motion** button freezes the orbit, background video and ticker together.
- Mobile (600px and below), reduced-motion users and browsers without WebGL receive a static artwork composition. Mobile does not download the Three.js chunk or autoplay the background film.
- The full portfolio gallery and its links work independently of the optional renderer.

To tune the scene, edit `count`, orbital speeds and ellipse radii in `orbital-hero.ts`. The main graphics runtime is intentionally a separate desktop-only lazy chunk, rather than part of the base page script.

## Add or replace projects

Edit `src/data/projects.ts`. Each entry creates a gallery card and a page at `/work/<slug>/`.

1. Put an original image in `public/images/work/`.
2. Add `image: '/images/work/your-image.webp'` to its project entry.
3. For non-square images, add `aspectRatio: '16 / 9'` or the appropriate ratio, e.g. `'3 / 4'`.
4. Update the title, category, summary, direction and deliverables.
5. Run `npm run build`.

Use one of the categories listed in `filters`, or add a category to that list. `cell` selects a square from the temporary AI concept sheet and is ignored when `image` is set. Concept labels disappear automatically when an original image is provided. The aspect ratio is shared by its card, project page and full-artwork viewer, preserving the complete composition.

**All nine initial project images are AI placeholders**, not claims of completed client work. The site links to the original Notion portfolio and identifies the concept imagery. The original company emblem and wordmark are supplied assets under `public/brand/`.

## Add the FPV video

1. Put your compressed, web-ready video at `public/media/fpv-showreel.mp4`.
2. Change `fpvVideo` in `src/data/site.ts` from `null` to `'/media/fpv-showreel.mp4'`.
3. Optionally replace `fpvPoster` with your own poster image.

The hero uses muted, looping video behind its gradient. The FPV section also plays the film inline beneath a dark left-to-right gradient while visible. Its existing **plus reticle** opens a borderless player with play/pause, seeking, sound and fullscreen controls. Escape, the close button or the surrounding backdrop dismiss the player; the background preview pauses while the popup is open and resumes afterward. Reduced-motion preferences and hidden/offscreen states pause automatic playback. While the video is absent, the poster and a coming-soon label remain visible.

The player is defined in `src/components/FpvPlayer.astro`, styled in `src/styles/fpv-player.css`, and managed by `src/scripts/fpv-film.ts`. The top-left navigation uses only the company emblem; its live light/orbit effect is in `src/styles/brand-effects.css`. Footer branding retains the wordmark.

## Content and contact

- `src/data/site.ts`: email, Instagram, LinkedIn, Notion gallery and video configuration.
- `src/pages/index.astro`: introduction, services, process, about and contact sections.
- `src/components/Brand.astro`: original logo and wordmark presentation.
- `src/scripts/site.ts`: native-scroll progress, section compass, blur reveals, light 3D tilt, filters, menu and dialogs.
- `src/styles/motion.css`: animation timing and reduced-motion support.

Contact actions open an email draft. There is no form backend, tracking integration or CMS to configure. Saubhagya's creator credit is limited to a small footer line.

## Hosting

The static site is generated in `dist/`. Build command: `npm run build`; output directory: `dist`. No server-side runtime is required.

Before publishing on a final domain, add that URL as `site` in `astro.config.mjs`. The layout then generates an absolute social preview URL and canonical metadata. Publication and remote pushes are separate from local commits.

## Asset provenance

- `public/brand/dimension-symbol.png` and `dimension-wordmark.png`: original assets supplied by the owner, preserved unmodified.
- `public/images/artwork-sheet.png` and its WebP copy: generated with the built-in image-generation tool. Prompt: nine equal square concepts in a 3-by-3 sheet, covering monochrome drone hardware photography, an orange cinematic poster, purple technology social design, a blue/yellow gaming thumbnail, gothic apparel, a red FPV event poster, radio-control photography, an educational thumbnail and experimental typography.
- `public/images/fpv-landscape.png` and its WebP copy: generated with the built-in image-generation tool. Prompt: an immersive FPV perspective along rugged coastal cliffs and a winding road at sunset, dark teal ocean, warm red/orange light, realistic cinematic grading, no visible drone and no text. It is illustrative, not actual Dimension footage.

WebP files are optimized encodings of the generated PNG assets. The website serves the smaller WebP versions.

# Scroll performance

Background films use a silent 1280×720, 30 fps `.preview.mp4` sibling when one
exists; the popup keeps the original film. After replacing a local MP4, generate
its matching background with `node scripts/optimize-video.mjs public/media/your-film.mp4`.
The command never overwrites an existing preview: rename that preview before
regenerating it. Rebuild after adding the generated file. The current background
is 9,037,806 bytes versus the 499 MB original (about 98% smaller).

The hero has no video or poster request. Its northern-lights background uses
three soft red/crimson CSS gradient curtains, with only transform animations and
a static star field. One shared layer extends behind the homepage navigation,
studio-label bar, and hero; translucent top bars and softened dividers blend the
section together. The header regains its normal background past the hero. The
backdrop fades into the page at the bottom of the intro. It pauses offscreen, in a hidden tab, or with the hero's
motion control. Reduced-motion mode keeps it static; mobile uses two curtains.
The FPV section and popup film retain their existing video behavior.

Orbital animation follows display refresh, renders at the original capped pixel ratio of 1.5,
and can reduce its buffer further when rendering is persistently expensive.
It still pauses offscreen and in reduced-motion mode. Scroll effects cache layout
on resize/content changes, and the ruler moves with a transform. Original blur-to-sharp
reveals, staggered project entrances, and translucent sticky bars remain enabled.

Headings use the supplied The Bold Font, served locally from
`public/fonts/the-bold-font.otf` with swap loading. Body and technical labels keep
their existing fonts; the original Dimension wordmark design is preserved.

## Wordmark particle transition

On the homepage, scrolling dissolves the large wordmark into white particles and
reassembles it beside the header symbol. Scrolling upward retraces the same path.
Breakup advances left to right with an outward dust impulse; arriving fragments
reassemble into sharp header letters in the same order. The intact letters stay
in the native SVG elements throughout: clip-path reveals only the unbroken source
and settled header portions. They never transfer into a fixed canvas, avoiding
scroll-thread lag and vertical jitter. Departed letters are clipped away rather
than faded behind the particles.
The approved `public/brand/dimension-wordmark.svg` supplies both endpoints and
the fragment atlas. A separate WebGL2 layer draws all fragments in one instanced
GPU batch; trajectories and turbulence run in the vertex shader. Canvas sizing
excludes the scrollbar. No idle rendering loop is used. A bounded 2D fallback
supports devices without WebGL2. Reduced-motion visitors get a simple
logo handoff without flying particles. Project pages show the header lockup directly.

About 30% of fragments use wider, seeded wandering paths; the remainder retain a
tighter flow. Each fragment launches at its own detachment position. All turbulence
vanishes at attachment, so reverse scrolling retraces the same paths. The ignition
spark has been removed.

Implementation: `src/scripts/wordmark-flight.ts`, `src/scripts/particle-field.ts`, and
`src/styles/wordmark-flight.css`. Timing starts after 24px of scroll and finishes
relative to the hero wordmark's measured position. Responsive destinations are
170px on desktop, 120px on mobile, and 100px on narrow screens.

