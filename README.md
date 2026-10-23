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

Edit `--accent` at the beginning of `src/styles/global.css`. Current accent: **Fusion Red, #ff5e5e**. Buttons, highlights, the progress ruler and decorative elements all use this variable.

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

The hero then uses muted, looping video behind its gradient. The FPV section gains a **Watch the film** button that opens a video dialog with controls. While the video is absent, a cinematic AI poster and a coming-soon label appear; no broken video requests are made. Reduced-motion preferences pause the hero video.

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

