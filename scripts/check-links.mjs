import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
async function htmlFiles(directory) {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name);
    if (item.isDirectory()) files.push(...await htmlFiles(filename));
    else if (filename.endsWith('.html')) files.push(filename);
  }
  return files;
}

const files = await htmlFiles(root);
const failures = [];
let checked = 0;
for (const filename of files) {
  const html = await readFile(filename, 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"\s]+)"/g)) {
    const raw = match[1].replaceAll('&amp;', '&');
    if (/^(?:https?:|mailto:|data:|tel:)/.test(raw)) continue;
    const url = new URL(raw, `https://local.test/${path.relative(root, filename).replaceAll('\\', '/')}`);
    let target = path.join(root, decodeURIComponent(url.pathname));
    try {
      const info = await stat(target);
      if (info.isDirectory()) target = path.join(target, 'index.html');
      if (url.hash && target.endsWith('.html')) {
        const contents = await readFile(target, 'utf8');
        const id = decodeURIComponent(url.hash.slice(1));
        if (!contents.includes(`id="${id}"`)) throw new Error(`missing anchor ${id}`);
      }
      checked++;
    } catch (error) {
      failures.push(`${path.relative(root, filename)} → ${raw}: ${error.message}`);
    }
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log(`Verified ${checked} local links/assets across ${files.length} HTML pages.`);
