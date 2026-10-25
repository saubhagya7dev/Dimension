interface Particle { u: number; v: number; seed: number; }
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
  sample.width = 600;
  sample.height = Math.round(600 * source.naturalHeight / source.naturalWidth);
  const sampling = sample.getContext('2d', { willReadFrequently: true });
  if (!sampling) return;
  sampling.drawImage(source, 0, 0, sample.width, sample.height);
  const pixels = sampling.getImageData(0, 0, sample.width, sample.height).data;
  const particles: Particle[] = [];
  const step = innerWidth <= 600 ? 4 : 3;
  for (let y = 0; y < sample.height; y += step) {
    for (let x = 0; x < sample.width; x += step) {
      const i = (y * sample.width + x) * 4;
      if (pixels[i + 3] < 80 || pixels[i] < 160 || pixels[i + 1] < 160 || pixels[i + 2] < 160) continue;
      particles.push({ u: x / sample.width, v: y / sample.height, seed: ((x * 73 + y * 137) % 997) / 997 });
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
    source!.style.opacity = String(1 - smooth(0, .22, progress));
    destination!.style.opacity = String(smooth(.78, 1, progress));
    canvas.hidden = progress === 0 || progress === 1 || document.hidden;
    if (canvas.hidden) return;
    const visibility = smooth(0, .13, progress) * (1 - smooth(.85, 1, progress));
    ctx!.fillStyle = '#f2f1ee';
    const scrollCompensation = Math.min(scrollY, end * .35);
    for (const p of particles) {
      // Different departure times make the letters disintegrate in a soft wave.
      const t = smooth(p.u * .12, .82 + p.u * .15, progress);
      const inv = 1 - t;
      const sx = sourceBox.x + p.u * sourceBox.width;
      const sy = sourceBox.y + p.v * sourceBox.height - scrollCompensation;
      const tx = targetBox.x + p.u * targetBox.width;
      const ty = targetBox.y + p.v * targetBox.height;
      const scatter = Math.sin(Math.PI * t);
      const x = inv * inv * inv * sx + 3 * inv * inv * t * (sx - 55) + 3 * inv * t * t * (tx + 100) + t * t * t * tx + (p.seed - .5) * 65 * scatter;
      const y = inv * inv * inv * sy + 3 * inv * inv * t * (sy - 85) + 3 * inv * t * t * (ty + 35) + t * t * t * ty + Math.sin(p.seed * 19) * 27 * scatter;
      const size = (2.1 - t * 1.2) * (.7 + p.seed * .6);
      ctx!.globalAlpha = visibility * (.55 + p.seed * .45);
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
