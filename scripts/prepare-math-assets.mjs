import { cp, mkdir } from 'node:fs/promises';

const source = new URL('../node_modules/katex/', import.meta.url);
const target = new URL('../public/math/', import.meta.url);
await mkdir(target, { recursive: true });
await cp(new URL('dist/katex.min.css', source), new URL('katex.min.css', target));
await cp(new URL('dist/fonts/', source), new URL('fonts/', target), { recursive: true });
await cp(new URL('LICENSE', source), new URL('LICENSE.txt', target));
