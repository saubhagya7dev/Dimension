import ffmpeg from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

const input = resolve(process.argv[2] || 'public/media/fpv-showreel.mp4');
if (!existsSync(input)) throw new Error(`Video not found: ${input}`);
const output = input.slice(0, -extname(input).length) + '.preview.mp4';
// Keep the original for the viewer. Backgrounds need neither 4K nor an audio track.
const result = spawnSync(ffmpeg, [
  '-hide_banner', '-n', '-i', input, '-map', '0:v:0',
  '-vf', "scale=w='min(1280,iw)':h=-2,fps=30", '-an',
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '26', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', output,
], { stdio: 'inherit' });
process.exit(result.status ?? 1);
