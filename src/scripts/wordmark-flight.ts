interface Particle { u: number; v: number; seed: number; phase: number; }
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (a: number, b: number, n: number) => {
  const t = clamp((n - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** A deterministic image-pixel morph: scroll position is the only animation clock. */
export async function initWordmarkFlight() {
  const source = document.querySelector<HTMLImageElement>('.orbital-wordmark img');
  const destination = document.querySelector<HTMLElement>('[data-header-wordmark]');
  const target = destination?.querySelector<HTMLImageElement>('img');
  if (!source || !destination || !target) return;
  try { await Promise.all([source.decode(), target.decode()]); } catch { return; }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.className = 'wordmark-flight-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  // Read the supplied image once. Ignore its black padding and transparent pixels.
  const sample = document.createElement('canvas');
  sample.width = 1000;
  sample.height = Math.round(600 * source.naturalHeight / source.naturalWidth);
  const sampling = sample.getContext('2d', { willReadFrequently: true });
  if (!sampling) return;
  sampling.drawImage(source, 0, 0, sample.width, sample.height);
  const pixels = sampling.getImageData(0, 0, sample.width, sample.height).data;
  // A transparent silhouette lets the canvas draw intact letter fragments without
  // the PNG's black background or a second fading DOM image behind the dust.
  const silhouette = sampling.createImageData(sample.width, sample.height);
  let left = sample.width;
  let right = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const brightness = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
    silhouette.data[i] = silhouette.data[i + 1] = silhouette.data[i + 2] = 245;
    silhouette.data[i + 3] = Math.round(pixels[i + 3] * smooth(35, 210, brightness));
    if (brightness > 160 && pixels[i + 3] > 80) {
      const x = (i / 4) % sample.width;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  const mask = document.createElement('canvas');
  mask.width = sample.width;
  mask.height = sample.height;
  mask.getContext('2d')!.putImageData(silhouette, 0, 0);
  const particles: Particle[] = [];
  const step = innerWidth <= 600 ? 4 : 3;
  for (let y = 0; y < sample.height; y += step) {
    for (let x = 0; x < sample.width; x += step) {
      const i = (y * sample.width + x) * 4;
      if (pixels[i + 3] < 80 || pixels[i] < 160 || pixels[i + 1] < 160 || pixels[i + 2] < 160) continue;
      particles.push({ u: x / sample.width, v: y / sample.height, seed: ((x * 73 + y * 137) % 997) / 997, phase: (x - left) / Math.max(1, right - left) });
    }
  }
  if (!particles.length) return;
  document.body.append(canvas);
  let sourceBox = { x: 0, y: 0, width: 1, height: 1 };
  let targetBox = { x: 0, y: 0, width: 1, height: 1 };
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
    start = 24;
    end = Math.max(240, Math.min(620, visibleLogo.top + scrollY + visibleLogo.height + 100));
    const ratio = Math.min(devicePixelRatio, 1.5);
    canvas.width = Math.round(innerWidth * ratio);
    canvas.height = Math.round(innerHeight * ratio);
    ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
    previousProgress = -1;
    schedule();
  }

  function render() {
    frame = 0;
    if (disposed) return;
    const progress = clamp((scrollY - start) / (end - start));
    if (progress === previousProgress) return;
    previousProgress = progress;
    ctx!.clearRect(0, 0, innerWidth, innerHeight);
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
    const scrollCompensation = Math.min(scrollY, end * .25);
    const originY = sourceBox.y - scrollCompensation;
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
      ctx!.drawImage(mask, sourceBox.x, originY, sourceBox.width, sourceBox.height);
      ctx!.restore();
    }
    // Arrival is the inverse breakup: each settled column becomes crisp again.
    if (arrival > 0) {
      const edge = targetBox.x + (leftU + arrival * spanU) * targetBox.width;
      ctx!.save();
      ctx!.beginPath();
      ctx!.rect(targetBox.x, targetBox.y, edge - targetBox.x, targetBox.height);
      ctx!.clip();
      ctx!.drawImage(mask, targetBox.x, targetBox.y, targetBox.width, targetBox.height);
      ctx!.restore();
    }
    ctx!.fillStyle = '#f2f1ee';
    for (const p of particles) {
      const local = (progress - p.phase * .45) / .5;
      if (local <= 0 || local >= 1) continue;
      const t = smooth(0, 1, local);
      const inv = 1 - t;
      const sx = sourceBox.x + p.u * sourceBox.width;
      const sy = sourceBox.y + p.v * sourceBox.height - scrollCompensation;
      const tx = targetBox.x + p.u * targetBox.width;
      const ty = targetBox.y + p.v * targetBox.height;
      // An outward impulse makes a dust burst at the advancing letter edge,
      // then collapses into the exact header pixel positions as it settles.
      const burst = Math.sin(Math.PI * Math.min(1, local / .58)) * (1 - smooth(.4, .85, local));
      const radius = (18 + p.seed * 100) * burst;
      const angle = p.seed * Math.PI * 17 + p.v * 35;
      const x = inv * inv * inv * sx + 3 * inv * inv * t * (sx + 45) + 3 * inv * t * t * (tx + 90) + t * t * t * tx + Math.cos(angle) * radius;
      const y = inv * inv * inv * sy + 3 * inv * inv * t * (sy - 55) + 3 * inv * t * t * (ty + 30) + t * t * t * ty + Math.sin(angle) * radius * .8;
      const size = (.65 + p.seed * 1.5) * (1 - t * .55);
      ctx!.globalAlpha = (.3 + p.seed * .7) * (1 - smooth(.92, 1, local));
      ctx!.fillRect(x, y, size, size);
    }
    ctx!.globalAlpha = 1;
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
