import { existsSync } from 'node:fs';

/** Resolve a local lightweight background sibling without changing the film config. */
export function backgroundVideo(source: string | null): string | null {
  if (!source || !source.startsWith('/') || !source.endsWith('.mp4')) return source;
  const preview = source.replace(/\.mp4$/, '.preview.mp4');
  return existsSync(new URL(`../../public${preview}`, import.meta.url)) ? preview : source;
}
