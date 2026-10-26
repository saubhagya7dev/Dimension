import { createParticleField, type Fragment, type FlightBox } from './particle-field';

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Native SVG solids + a single GPU particle batch, driven by scroll position. */
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

  const sample = document.createElement('canvas');
  sample.width = 1600;
  sample.height = Math.round(sample.width * source.naturalHeight / source.naturalWidth);
  const sampling = sample.getContext('2d', { willReadFrequently: true });
  if (!sampling) return;
  sampling.drawImage(source, 0, 0, sample.width, sample.height);
  const pixels = sampling.getImageData(0, 0, sample.width, sample.height).data;
  let left = sample.width, right = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] > 80) {
      const x = (i / 4) % sample.width;
      left = Math.min(left, x); right = Math.max(right, x);
    }
  }
  const particles: Fragment[] = [];
  const step = innerWidth <= 600 ? 6 : 4;
  for (let y = 0; y < sample.height; y += step) {
    for (let x = 0; x < sample.width; x += step) {
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
  let field: ReturnType<typeof createParticleField>;
  try { field = createParticleField(canvas, sample, particles, step); } catch { return; }
  document.body.append(canvas);
  let sourceBox: FlightBox = { x: 0, y: 0, width: 1, height: 1 };
  let targetBox: FlightBox = { x: 0, y: 0, width: 1, height: 1 };
  let start = 24, end = 420, frame = 0;
  let disposed = false, previousProgress = -1;
  let renderCost = 0, renderSamples = 0;
  const leftU = left / sample.width, spanU = (right - left) / sample.width;

  function measure() {
    if (disposed) return;
    const s = source!.getBoundingClientRect(), d = target!.getBoundingClientRect();
    sourceBox = { x: s.left, y: s.top + scrollY, width: s.width, height: s.height };
    targetBox = { x: d.left, y: d.top, width: d.width, height: d.height };
    const logo = source!.parentElement!.getBoundingClientRect();
    end = Math.max(240, Math.min(620, logo.top + scrollY + logo.height + 100));
    const width = document.documentElement.clientWidth, height = innerHeight;
    const ratio = Math.min(devicePixelRatio, 2);
    const bufferWidth = Math.round(width * ratio), bufferHeight = Math.round(height * ratio);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      canvas.width = bufferWidth; canvas.height = bufferHeight;
    }
    field.resize(width, height);
    previousProgress = -1;
    schedule();
  }

  function render() {
    const renderStarted = performance.now();
    frame = 0;
    if (disposed) return;
    const progress = clamp((scrollY - start) / (end - start));
    if (progress === previousProgress) return;
    previousProgress = progress;
    destination!.dataset.flightProgress = progress.toFixed(3);
    if (reduced.matches || !field.available) {
      source!.style.clipPath = 'none'; target!.style.clipPath = 'none';
      source!.style.opacity = progress < .5 ? '1' : '0';
      destination!.style.opacity = progress < .5 ? '0' : '1';
      canvas.hidden = true;
      return;
    }
    const departure = clamp(progress / .45), arrival = clamp((progress - .5) / .45);
    // The intact letters never change rendering layers or move in a fixed canvas.
    // Native scrolling owns their Y position; only their visible edge is clipped.
    source!.style.opacity = departure < 1 ? '1' : '0';
    source!.style.clipPath = progress === 0 ? 'none' : `inset(0 0 0 ${(leftU + departure * spanU) * 100}%)`;
    destination!.style.opacity = arrival > 0 ? '1' : '0';
    target!.style.clipPath = progress === 1 ? 'none' : `inset(0 ${(1 - leftU - arrival * spanU) * 100}% 0 0)`;
    canvas.hidden = progress === 0 || progress >= .95 || document.hidden;
    if (canvas.hidden) return;
    field.render({ progress, source: sourceBox, target: targetBox, start, end });
    if (import.meta.env.DEV) {
      renderCost += performance.now() - renderStarted;
      renderSamples++;
      canvas.dataset.renderMs = (renderCost / renderSamples).toFixed(2);
      canvas.dataset.particles = String(particles.length);
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
    disposed = true; cancelAnimationFrame(frame); observer.disconnect();
    window.removeEventListener('resize', measure); window.removeEventListener('scroll', schedule);
    document.removeEventListener('visibilitychange', motionChanged); reduced.removeEventListener('change', motionChanged);
    field.destroy(); canvas.remove();
  }, { once: true });
  measure();
}
