// Adapted from PersonelPage/scripts/sync-obsidian-blog.mjs.
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile, mkdtemp } from 'node:fs/promises';
import { basename, dirname, extname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir, tmpdir } from 'node:os';
import { parse, stringify } from 'yaml';
import { readPosts, renderMarkdown } from './blog-content.mjs';
import { validateContent } from './archive-content.mjs';

const toPosix = (value) => value.split(sep).join('/');
const isMarkdown = (path) => ['.md', '.mdx'].includes(extname(path).toLowerCase());
const isHidden = (name) => name.startsWith('.');

async function walk(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (isHidden(entry.name) || entry.isSymbolicLink()) continue;
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, fullPath));
    if (entry.isFile()) files.push(toPosix(relative(root, fullPath)));
  }

  return files.sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function stripMarkdown(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function metadataFor(content, sourcePath, sourceStat) {
  const withoutFrontmatter = content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, '');
  const heading = withoutFrontmatter.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title = stripMarkdown(heading ?? basename(sourcePath, extname(sourcePath)));
  const description = withoutFrontmatter
    .split(/\r?\n\s*\r?\n/)
    .map(stripMarkdown)
    .find((paragraph) => paragraph && paragraph !== title && !paragraph.startsWith('```'))
    ?.slice(0, 160) ?? title;
  const sourceDate = sourceStat.birthtimeMs > 0 ? sourceStat.birthtime : sourceStat.mtime;

  return {
    title,
    description,
    date: sourceDate.toISOString().slice(0, 10),
  };
}

function buildLookup(files) {
  const byRelative = new Map();
  const byBasename = new Map();

  for (const file of files) {
    const normalized = posix.normalize(file);
    byRelative.set(normalized.toLocaleLowerCase('en-US'), normalized);
    const key = basename(normalized).toLocaleLowerCase('en-US');
    const matches = byBasename.get(key) ?? [];
    matches.push(normalized);
    byBasename.set(key, matches);
  }

  return { byRelative, byBasename };
}

function resolveLink(target, notePath, lookup, extensions = ['']) {
  const cleanTarget = target.replace(/^\//, '').trim();
  const candidates = [];
  for (const extension of extensions) {
    candidates.push(posix.normalize(posix.join(posix.dirname(notePath), `${cleanTarget}${extension}`)));
    candidates.push(posix.normalize(`${cleanTarget}${extension}`));
  }

  for (const candidate of candidates) {
    const match = lookup.byRelative.get(candidate.toLocaleLowerCase('en-US'));
    if (match) return match;
  }

  for (const extension of extensions) {
    const matches = lookup.byBasename.get(basename(`${cleanTarget}${extension}`).toLocaleLowerCase('en-US'));
    if (matches?.length === 1) return matches[0];
  }

  return undefined;
}


function parseNote(raw) {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n)?/.exec(raw);
  return { data: match ? parse(match[1]) ?? {} : {}, body: match ? raw.slice(match[0].length) : raw };
}
function safePath(root, path) {
  if (typeof path !== 'string' || !path || path.startsWith('.') || path.includes('\\') || path.split('/').some(part => part === '..' || part === '')) throw Error(`非法同步路径：${path}`);
  const full = resolve(root, path);
  if (!full.startsWith(resolve(root) + sep)) throw Error(`非法同步路径：${path}`);
  return full;
}
export async function syncBlog({ source, destination, assets, reservedIds = [] }) {
  source = resolve(source); destination = resolve(destination); assets = resolve(assets);
  if (source === destination || destination.startsWith(source + sep) || source.startsWith(destination + sep)) throw Error('来源和目标目录不能重叠');
  const manifestPath = join(destination, '.obsidian-sync-manifest.json');
  let previous = { version: 1, entries: {}, files: [], assets: [], reservedIds: [] };
  try { previous = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const path of previous.files) safePath(destination, path);
  for (const path of previous.assets) safePath(assets, path);
  const files = await walk(source);
  if (files.some(path => extname(path).toLowerCase() === '.mdx')) throw Error('请将 MDX 改为普通 Markdown；本站不执行笔记中的组件代码。');
  const lookup = buildLookup(files);
  const entries = { ...previous.entries };
  const usedIds = new Set([...reservedIds, ...previous.reservedIds, ...Object.values(entries).map(entry => entry.archiveId)]);
  let existing = [];
  try { existing = await walk(destination); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const path of existing.filter(isMarkdown)) {
    const { data } = parseNote(await readFile(join(destination, path), 'utf8'));
    if (data.archiveId) usedIds.add(data.archiveId);
  }
  let nextId = Math.max(0, ...[...usedIds].map(id => Number(id.replace(/^X-/, ''))).filter(Number.isFinite)) + 1;
  function allocateId() {
    let id;
    do { id = `X-${String(nextId++).padStart(3, '0')}`; } while (usedIds.has(id));
    return id;
  }
  const notes = new Map();
  for (const path of files.filter(isMarkdown)) {
    const raw = await readFile(join(source, path), 'utf8');
    const { data, body } = parseNote(raw);
    if (data.draft === true || data.publish === false) continue;
    const prior = entries[path];
    if (prior && ((data.archiveId && data.archiveId !== prior.archiveId) || (data.slug && data.slug !== prior.slug))) throw Error(`${path}: 已同步文章的 archiveId/slug 不可更改`);
    const archiveId = prior?.archiveId ?? data.archiveId ?? allocateId();
    if (!prior && usedIds.has(archiveId)) throw Error(`${path}: 编号已占用或保留 ${archiveId}`);
    usedIds.add(archiveId);
    const stem = basename(path, '.md');
    const slug = prior?.slug ?? data.slug ?? (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stem) ? stem : `post-${archiveId.toLowerCase()}`);
    const defaults = metadataFor(raw, path, await stat(join(source, path)));
    const category = path.includes('/') ? path.split('/')[0] : '工程文章';
    const metadata = { ...defaults, author: 'rndyt', tags: [], preview: false, kind: 'article', category: category === 'Agent' ? 'AI 实践' : category, ...data, archiveId, slug };
    entries[path] = { archiveId, slug };
    notes.set(path, { metadata, body });
  }
  const warnings = new Set(), usedAssets = new Set();
  function link(target, label, from, image = false) {
    let decoded;
    try { decoded = decodeURIComponent(target); } catch { decoded = target; }
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(decoded)) return `${image ? '!' : ''}[${label}](${target})`;
    const [name, fragment] = decoded.split('#');
    const match = name ? resolveLink(name, from, lookup, ['', '.md']) : from;
    if (match && notes.has(match)) {
      const note = notes.get(match);
      let anchor = '';
      if (fragment) {
        const heading = renderMarkdown(note.body).headings.find(h => h.text === fragment || h.id === fragment);
        if (heading) anchor = `#${heading.id}`;
        else warnings.add(`${from}: 未找到标题 ${target}`);
      }
      return `[${label}](/posts/${note.metadata.slug}/${anchor})`;
    }
    if (match && !isMarkdown(match)) {
      usedAssets.add(match);
      return `${image ? '!' : ''}[${label}](/post-assets/${match.split('/').map(encodeURIComponent).join('/')})`;
    }
    warnings.add(`${from}: 未发布或不存在的目标 ${target}`);
    return label;
  }
  const outputs = new Map();
  for (const [path, note] of notes) {
    // Keep examples in fenced/inline code literal, as in Obsidian.
    const body = note.body.split(/(`{3,}[^\n]*\n[\s\S]*?\n`{3,}|~{3,}[^\n]*\n[\s\S]*?\n~{3,}|`+[^`\n]*`+)/g).map((part, i) => {
      if (i % 2) return part;
      // Convert standard links before wiki links so generated URLs aren't converted twice.
      return part.replace(/(!?)\[([^\]]*)\]\((<[^>]+>|[^\s)]+)\)/g, (_all, image, label, target) => link(target.replace(/^<|>$/g, ''), label, path, !!image))
        .replace(/(!?)\[\[([^\]]+)\]\]/g, (_all, image, value) => {
          const [target, alias] = value.split('|');
          const label = alias && !/^\d+(?:x\d+)?$/.test(alias) ? alias : basename(target.split('#')[0], extname(target.split('#')[0])) || target.split('#')[1] || target;
          return link(target.trim(), label, path, !!image);
        });
    }).join('');
    const output = `obsidian/${note.metadata.slug}.md`;
    if (outputs.has(output)) throw Error(`重复 slug：${note.metadata.slug}`);
    if (existing.includes(output) && !previous.files.includes(output)) throw Error(`拒绝覆盖非同步文件：${output}`);
    outputs.set(output, `---\n${stringify(note.metadata)}---\n\n${body.trim()}\n`);
  }
  for (const path of usedAssets) {
    const target = safePath(assets, path);
    if (!previous.assets.includes(path)) {
      try { await stat(target); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      throw Error(`拒绝覆盖非同步附件：${path}`);
    }
  }
  // Validate the entire proposed corpus before changing published files.
  const staging = await mkdtemp(join(tmpdir(), 'rhine-obsidian-'));
  try {
    for (const path of existing.filter(path => isMarkdown(path) && !previous.files.includes(path))) {
      await mkdir(dirname(join(staging, path)), { recursive: true });
      await copyFile(join(destination, path), join(staging, path));
    }
    for (const [path, content] of outputs) { await mkdir(dirname(join(staging, path)), { recursive: true }); await writeFile(join(staging, path), content); }
    const corpus = await readPosts(pathToFileURL(staging + sep));
    if (!corpus.records.length) throw Error('至少需要一篇已发布文章；保留上次同步结果。');
    validateContent(corpus);
  } finally { await rm(staging, { recursive: true, force: true }); }
  for (const [path, content] of outputs) { const target = safePath(destination, path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, content); }
  for (const path of usedAssets) { const target = safePath(assets, path); await mkdir(dirname(target), { recursive: true }); await copyFile(join(source, path), target); }
  for (const path of previous.files) if (!outputs.has(path)) await rm(safePath(destination, path), { force: true });
  for (const path of previous.assets) if (!usedAssets.has(path)) await rm(safePath(assets, path), { force: true });
  await mkdir(destination, { recursive: true });
  await writeFile(manifestPath, JSON.stringify({ version: 1, entries, files: [...outputs.keys()], assets: [...usedAssets], reservedIds: [...usedIds] }, null, 2) + '\n');
  return { posts: notes.size, assets: usedAssets.size, warnings: [...warnings] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repo = fileURLToPath(new URL('../', import.meta.url));
  const result = await syncBlog({
    source: process.argv[2] ?? process.env.OBSIDIAN_BLOG_DIR ?? join(homedir(), 'Nutstore Files/ObsidianVault/Blog'),
    destination: join(repo, 'content/posts'), assets: join(repo, 'public/post-assets'),
  });
  console.log(`已同步 ${result.posts} 篇文章、${result.assets} 个附件。`);
  for (const warning of result.warnings) console.warn(warning);
  const { exportBlog } = await import('./export-records.mjs');
  await exportBlog();
}
