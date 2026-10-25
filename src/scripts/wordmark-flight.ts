interface Particle { u: number; v: number; seed: number; phase: number; x: number; y: number; free: boolean; }
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (a: number, b: number, n: number) => {
  const t = clamp((n - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Vector-aligned fragments with a deterministic, reversible scroll clock. */
export async function initWordmarkFlight() {
  const source = document.querySelector<HTMLImageElement>('.orbital-wordmark img');
  const destination = document.querySelector<HTMLElement>('[data-header-wordmark]');
  const target = destination?.querySelector<HTMLImageElement>('img');
  if (!source || !destination || !target) return;
  try { await Promise.all([source.decode(), target.decode()]); } catch { return; }
  // The same SVG path and viewBox render both DOM endpoints and canvas solids.
  // There is no thresholded/recoloured silhouette or stretched intermediate mask.
  let outline: Path2D;
  let vectorWidth = source.naturalWidth;
  let vectorHeight = source.naturalHeight;
  try {
    const response = await fetch(source.currentSrc || source.src);
    if (!response.ok) return;
    const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    const box = svg.documentElement.getAttribute('viewBox')?.split(/\s+/).map(Number);
    if (box?.length === 4) { vectorWidth = box[2]; vectorHeight = box[3]; }
    outline = new Path2D(Array.from(svg.querySelectorAll('path')).map(path => path.getAttribute('d') || '').join(' '));
  } catch { return; }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.className = 'wordmark-flight-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  // Rasterize the vector once at its true aspect ratio for tiny fragment sprites.
  const sample = document.createElement('canvas');
  sample.width = 1600;
  sample.height = Math.round(sample.width * vectorHeight / vectorWidth);
  const sampling = sample.getContext('2d', { willReadFrequently: true });
  if (!sampling) return;
  sampling.drawImage(source, 0, 0, sample.width, sample.height);
  const pixels = sampling.getImageData(0, 0, sample.width, sample.height).data;
  let left = sample.width;
  let right = 0;
  let ignitionY = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const brightness = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (brightness > 160 && pixels[i + 3] > 80) {
      const x = (i / 4) % sample.width;
      if (x < left) { left = x; ignitionY = Math.floor(i / 4 / sample.width); }
      right = Math.max(right, x);
    }
  }
  const particles: Particle[] = [];
  const step = innerWidth <= 600 ? 6 : 4;
  for (let y = 0; y < sample.height; y += step) {
    for (let x = 0; x < sample.width; x += step) {
      // Include partially covered edge cells too, preserving the actual glyph edge.
      let coverage = 0;
      for (let cy = y; cy < Math.min(y + step, sample.height); cy++) {
        for (let cx = x; cx < Math.min(x + step, sample.width); cx++) coverage += pixels[(cy * sample.width + cx) * 4 + 3];
      }
      if (coverage < 30) continue;
      const seed = ((x * 73 + y * 137) % 997) / 997;
      particles.push({ u: (x + step / 2) / sample.width, v: (y + step / 2) / sample.height, seed, phase: clamp((x + step / 2 - left) / Math.max(1, right - left)), x, y, free: seed < .3 });
    }
  }
  if (!particles.length) return;
  document.body.append(canvas);
  let sourceBox = { x: 0, y: 0, width: 1, height: 1 };
  let targetBox = { x: 0, y: 0, width: 1, height: 1 };
  let sourceClip = { x: 0, y: 0, width: 1, height: 1 };
  let targetClip = { x: 0, y: 0, width: 1, height: 1 };
  let viewportWidth = 1;
  let start = 24;
  let end = 420;
  let frame = 0;
  let disposed = false;
  let previousProgress = -1;

  function measure() {
    const s = source!.getBoundingClientRect();
    const d = target!.getBoundingClientRect();
    sourceBox = { x: s.left, y: s.top + scrollY, width: s.width, height: s.height };
    targetBox = { x: d.left, y: d.top, width: d.width, height: d.height };
    const visibleLogo = source!.parentElement!.getBoundingClientRect();
    const headerLogo = destination!.getBoundingClientRect();
    sourceClip = { x: visibleLogo.left, y: visibleLogo.top + scrollY, width: visibleLogo.width, height: visibleLogo.height };
    targetClip = { x: headerLogo.left, y: headerLogo.top, width: headerLogo.width, height: headerLogo.height };
    start = 24;
    end = Math.max(240, Math.min(620, visibleLogo.top + scrollY + visibleLogo.height + 100));
    const ratio = Math.min(devicePixelRatio, 2);
    // innerWidth includes the scrollbar; CSS 100% does not. Match the drawable
    // viewport exactly, otherwise the whole canvas scales at both handoffs.
    viewportWidth = document.documentElement.clientWidth;
    canvas.style.width = `${viewportWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    canvas.width = Math.round(viewportWidth * ratio);
    canvas.height = Math.round(innerHeight * ratio);
    ctx!.setTransform(canvas.width / viewportWidth, 0, 0, canvas.height / innerHeight, 0, 0);
    previousProgress = -1;
    schedule();
  }

  function render() {
    frame = 0;
    if (disposed) return;
    const progress = clamp((scrollY - start) / (end - start));
    if (progress === previousProgress) return;
    previousProgress = progress;
    ctx!.clearRect(0, 0, viewportWidth, innerHeight);
    destination!.dataset.flightProgress = progress.toFixed(3);
    if (reduced.matches) {
      // No particle travel for visitors who request reduced motion.
      source!.style.opacity = progress < .5 ? '1' : '0';
      destination!.style.opacity = progress < .5 ? '0' : '1';
      canvas.hidden = true;
      return;
    }
    // Binary ownership: an endpoint image OR the canvas, never a crossfade.
    source!.style.opacity = progress === 0 ? '1' : '0';
    destination!.style.opacity = progress === 1 ? '1' : '0';
    canvas.hidden = progress === 0 || progress === 1 || document.hidden;
    if (canvas.hidden) return;
    const originY = sourceBox.y - scrollY;
    const departure = clamp(progress / .45);
    const arrival = clamp((progress - .5) / .45);
    const leftU = left / sample.width;
    const spanU = (right - left) / sample.width;

    // Wipe the solid source from left to right. Only the unbroken right-hand
    // letters remain; the departed pixels exist solely as individual particles.
    if (departure < 1) {
      const edge = sourceBox.x + (leftU + departure * spanU) * sourceBox.width;
      ctx!.save();
      ctx!.beginPath();
      ctx!.rect(edge, originY, sourceBox.x + sourceBox.width - edge, sourceBox.height);
      ctx!.clip();
      ctx!.beginPath();
      ctx!.rect(sourceClip.x, sourceClip.y - scrollY, sourceClip.width, sourceClip.height);
      ctx!.clip();
      ctx!.translate(sourceBox.x, originY);
      ctx!.scale(sourceBox.width / vectorWidth, sourceBox.height / vectorHeight);
      ctx!.fillStyle = '#ffffff';
      ctx!.fill(outline, 'evenodd');
      ctx!.restore();
    }
    // Arrival is the inverse breakup: each settled column becomes crisp again.
    if (arrival > 0) {
      const edge = targetBox.x + (leftU + arrival * spanU) * targetBox.width;
      ctx!.save();
      ctx!.beginPath();
      ctx!.rect(targetBox.x, targetBox.y, edge - targetBox.x, targetBox.height);
      ctx!.clip();
      ctx!.beginPath();
      ctx!.rect(targetClip.x, targetClip.y, targetClip.width, targetClip.height);
      ctx!.clip();
      ctx!.translate(targetBox.x, targetBox.y);
      ctx!.scale(targetBox.width / vectorWidth, targetBox.height / vectorHeight);
      ctx!.fillStyle = '#ffffff';
      ctx!.fill(outline, 'evenodd');
      ctx!.restore();
    }
    ctx!.fillStyle = '#f2f1ee';
    for (const p of particles) {
      const local = (progress - p.phase * .45) / .5;
      if (local <= 0 || local >= 1) continue;
      const t = smooth(0, 1, local);
      const inv = 1 - t;
      const sx = sourceBox.x + p.u * sourceBox.width;
      // Each fragment launches where its letter was at the exact detachment
      // scroll position, rather than dragging its origin with later scrolling.
      const detachScroll = start + p.phase * .45 * (end - start);
      const sy = sourceBox.y + p.v * sourceBox.height - detachScroll;
      const tx = targetBox.x + p.u * targetBox.width;
      const ty = targetBox.y + p.v * targetBox.height;
      // An outward impulse makes a dust burst at the advancing letter edge,
      // then collapses into the exact header pixel positions as it settles.
      const burst = Math.sin(Math.PI * Math.min(1, local / .58)) * (1 - smooth(.4, .85, local));
      const radius = (12 + p.seed * 65) * burst;
      const angle = p.seed * Math.PI * 17 + p.v * 35;
      // A minority takes wider wandering routes; seeded turbulence stays exactly
      // reversible, and its envelope vanishes at both attachment points.
      const wander = Math.sin(Math.PI * t) ** 2 * (p.free ? 65 : 14);
      const frequency = 3 + p.seed * 6;
      const x = inv * inv * inv * sx + 3 * inv * inv * t * (sx + 45) + 3 * inv * t * t * (tx + 90) + t * t * t * tx + Math.cos(angle) * radius + Math.sin(t * frequency * 3 + angle) * wander;
      const y = inv * inv * inv * sy + 3 * inv * inv * t * (sy - 55) + 3 * inv * t * t * (ty + 30) + t * t * t * ty + Math.sin(angle) * radius * .8 + Math.cos(t * frequency * 2 + angle) * wander * .7;
      const cellWidth = step / sample.width * sourceBox.width;
      const cellHeight = step / sample.height * sourceBox.height;
      const targetCellWidth = step / sample.width * targetBox.width;
      const targetCellHeight = step / sample.height * targetBox.height;
      const scale = 1 - Math.sin(Math.PI * t) * .45;
      const w = (cellWidth * inv + targetCellWidth * t) * scale;
      const h = (cellHeight * inv + targetCellHeight * t) * scale;
      if (x < -10 || x > viewportWidth + 10 || y < -10 || y > innerHeight + 10) continue;
      ctx!.globalAlpha = 1 - Math.sin(Math.PI * t) * (p.free ? .3 : .12);
      // These are actual SVG-filled fragments, including partially covered edges
      // and counters, not arbitrary square dots over a fading full wordmark.
      ctx!.drawImage(sample, p.x, p.y, Math.min(step, sample.width - p.x), Math.min(step, sample.height - p.y), x - w / 2, y - h / 2, w, h);
    }
    ctx!.globalAlpha = 1;
    // One tiny, scroll-scrubbed ignition at the very first letter edge.
    if (progress > 0 && progress < .075) {
      const ignition = progress / .075;
      const brightness = Math.sin(Math.PI * ignition) ** 2;
      const x = sourceBox.x + leftU * sourceBox.width;
      const y = originY + ignitionY / sample.height * sourceBox.height;
      ctx!.save();
      ctx!.globalCompositeOperation = 'lighter';
      const glow = ctx!.createRadialGradient(x, y, 0, x, y, 7);
      glow.addColorStop(0, `rgba(255,255,245,${brightness})`);
      glow.addColorStop(.25, `rgba(255,210,165,${brightness * .5})`);
      glow.addColorStop(1, 'rgba(255,160,110,0)');
      ctx!.fillStyle = glow;
      ctx!.fillRect(x - 7, y - 7, 14, 14);
      ctx!.strokeStyle = `rgba(255,245,220,${brightness * .8})`;
      ctx!.lineWidth = .6;
      for (let ray = 0; ray < 5; ray++) {
        const angle = ray * 2.4 + .3;
        const length = 2 + ignition * (ray % 2 ? 5 : 8);
        ctx!.beginPath();
        ctx!.moveTo(x + Math.cos(angle) * 1.5, y + Math.sin(angle) * 1.5);
        ctx!.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        ctx!.stroke();
      }
      ctx!.restore();
    }
  }
  function schedule() {
    if (!frame && !disposed) frame = requestAnimationFrame(render);
  }
  function motionChanged() { previousProgress = -1; schedule(); }
  const observer = new ResizeObserver(measure);
  observer.observe(document.querySelector('.site-header')!);
  observer.observe(source.parentElement!);
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('visibilitychange', motionChanged);
  reduced.addEventListener('change', motionChanged);
  void document.fonts.ready.then(measure);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener('resize', measure);
    window.removeEventListener('scroll', schedule);
    document.removeEventListener('visibilitychange', motionChanged);
    reduced.removeEventListener('change', motionChanged);
    canvas.remove();
  }, { once: true });
  measure();
}
